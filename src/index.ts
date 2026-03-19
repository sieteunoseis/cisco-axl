import * as soap from "strong-soap";
import * as path from "path";
import * as https from "https";
import { URL } from "url";

const WSDL = soap.soap.WSDL;

const wsdlOptions = {
  attributesKey: "attributes",
  valueKey: "value",
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AXLServiceOptions {
  username: string;
  password: string;
  url: string;
  endpoint: string;
  version: string;
}

interface OperationOptions {
  clean?: boolean;
  dataContainerIdentifierTails?: string;
  removeAttributes?: boolean;
}

interface TagMetadata {
  name: string;
  required: boolean;
  nillable: boolean;
  isMany: boolean;
  type: string | null;
  children: { [key: string]: TagMetadata } | null;
}

interface DetailedOperationTags {
  [key: string]: TagMetadata;
}

interface BatchOperation {
  operation: string;
  tags: any;
  opts?: OperationOptions;
}

interface BatchResult {
  operation: string;
  success: boolean;
  result?: any;
  error?: Error;
}

type LogLevel = "error" | "warn" | "info" | "debug";

interface LoggerOptions {
  level?: LogLevel;
  handler?: (level: LogLevel, message: string, data?: any) => void;
}

interface RetryOptions {
  retries?: number;
  retryDelay?: number;
  retryOn?: (error: any) => boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const VALID_VERSIONS = ["11.0", "11.5", "12.0", "12.5", "14.0", "15.0"];

// ─── Custom Error Classes ────────────────────────────────────────────────────

/**
 * Base error class for all AXL-related errors
 */
class AXLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AXLError";
  }
}

/**
 * Thrown when authentication fails (invalid credentials, 401/403)
 */
class AXLAuthError extends AXLError {
  constructor(message: string = "Authentication failed. Check username and password.") {
    super(message);
    this.name = "AXLAuthError";
  }
}

/**
 * Thrown when a requested AXL operation does not exist
 */
class AXLNotFoundError extends AXLError {
  operation: string;
  constructor(operation: string) {
    super(`Operation "${operation}" not found`);
    this.name = "AXLNotFoundError";
    this.operation = operation;
  }
}

/**
 * Thrown when an AXL operation returns a SOAP fault
 */
class AXLOperationError extends AXLError {
  operation: string;
  faultCode?: string;
  faultDetail?: any;
  constructor(message: string, operation: string, faultCode?: string, faultDetail?: any) {
    super(message);
    this.name = "AXLOperationError";
    this.operation = operation;
    this.faultCode = faultCode;
    this.faultDetail = faultDetail;
  }
}

/**
 * Thrown when input parameters fail validation
 */
class AXLValidationError extends AXLError {
  constructor(message: string) {
    super(message);
    this.name = "AXLValidationError";
  }
}

// ─── Logger ──────────────────────────────────────────────────────────────────

/**
 * Internal logger with configurable levels and custom handler support.
 * Default behavior mirrors the previous DEBUG env var approach at the "debug" level.
 */
class Logger {
  private _level: number;
  private _handler: (level: LogLevel, message: string, data?: any) => void;

  constructor(options?: LoggerOptions) {
    this._level = LOG_LEVELS[options?.level ?? this._detectLevel()];
    this._handler = options?.handler ?? Logger._defaultHandler;
  }

  private _detectLevel(): LogLevel {
    const debug = process.env.DEBUG;
    const isDebugEnabled = debug && !["false", "no", "0", "off", "n"].includes(debug.toLowerCase());
    return isDebugEnabled ? "debug" : "error";
  }

  private static _defaultHandler(level: LogLevel, message: string, data?: any): void {
    const prefix = `[AXL ${level.toUpperCase()}]`;
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  setLevel(level: LogLevel): void {
    this._level = LOG_LEVELS[level];
  }

  error(message: string, data?: any): void {
    if (this._level >= LOG_LEVELS.error) this._handler("error", message, data);
  }
  warn(message: string, data?: any): void {
    if (this._level >= LOG_LEVELS.warn) this._handler("warn", message, data);
  }
  info(message: string, data?: any): void {
    if (this._level >= LOG_LEVELS.info) this._handler("info", message, data);
  }
  debug(message: string, data?: any): void {
    if (this._level >= LOG_LEVELS.debug) this._handler("debug", message, data);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escapes special XML characters in a string to prevent XML injection
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for XML inclusion
 */
const escapeXml = (str: string): string => {
  if (!str) return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Determines if an error is transient (network/timeout) and worth retrying
 */
const isTransientError = (error: any): boolean => {
  if (error instanceof AXLAuthError || error instanceof AXLValidationError || error instanceof AXLNotFoundError) {
    return false;
  }
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("enotfound") ||
    msg.includes("epipe") ||
    msg.includes("network")
  );
};

/**
 * Sleeps for the specified number of milliseconds
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ─── axlService Class ────────────────────────────────────────────────────────

/**
 * Cisco axlService Service
 * This is a service class that uses fetch and promises to pull AXL data from Cisco CUCM
 *
 * @class axlService
 */
class axlService {
  private _OPTIONS: AXLServiceOptions;
  private _soapClient: any | null = null;
  private _soapClientPromise: Promise<any> | null = null;
  private _wsdl: any | null = null;
  private _wsdlPromise: Promise<any> | null = null;
  private _log: Logger;
  private _retryOptions: Required<RetryOptions>;

  /**
   * Creates an instance of axlService.
   * @param {string} host - CUCM hostname or IP address
   * @param {string} username - CUCM username with AXL permissions
   * @param {string} password - CUCM password
   * @param {string} version - CUCM version (e.g. "14.0")
   * @param {object} [options] - Optional configuration
   * @param {LoggerOptions} [options.logging] - Logging configuration
   * @param {RetryOptions} [options.retry] - Retry configuration for transient errors
   * @memberof axlService
   */
  constructor(
    host: string,
    username: string,
    password: string,
    version: string,
    options?: { logging?: LoggerOptions; retry?: RetryOptions }
  ) {
    // Validate required parameters
    if (!host || typeof host !== "string") {
      throw new AXLValidationError("host is required and must be a non-empty string");
    }
    if (!username || typeof username !== "string") {
      throw new AXLValidationError("username is required and must be a non-empty string");
    }
    if (!password || typeof password !== "string") {
      throw new AXLValidationError("password is required and must be a non-empty string");
    }
    if (!version || typeof version !== "string") {
      throw new AXLValidationError("version is required and must be a non-empty string");
    }
    if (!VALID_VERSIONS.includes(version)) {
      throw new AXLValidationError(`Invalid version "${version}". Supported versions: ${VALID_VERSIONS.join(", ")}`);
    }

    this._log = new Logger(options?.logging);
    this._retryOptions = {
      retries: options?.retry?.retries ?? 0,
      retryDelay: options?.retry?.retryDelay ?? 1000,
      retryOn: options?.retry?.retryOn ?? isTransientError,
    };

    this._OPTIONS = {
      username: username,
      password: password,
      url: path.join(__dirname, `../schema/${version}/AXLAPI.wsdl`),
      endpoint: `https://${host}:8443/axl/`,
      version: version,
    };
    this._log.debug(`Initializing AXL service for host: ${host}, version: ${version}`);
  }

  /**
   * Gets or creates the cached SOAP client
   * @returns {Promise<any>} - Configured SOAP client
   * @private
   */
  private _getClient(): Promise<any> {
    if (this._soapClient) {
      return Promise.resolve(this._soapClient);
    }

    if (this._soapClientPromise) {
      return this._soapClientPromise;
    }

    const options = this._OPTIONS;
    this._log.debug(`Creating and caching SOAP client for ${options.url}`);

    this._soapClientPromise = new Promise((resolve, reject) => {
      soap.soap.createClient(options.url, wsdlOptions, (err: any, client: any) => {
        if (err) {
          this._log.error(`SOAP client creation error: ${err.message || "Unknown error"}`, err);
          this._soapClientPromise = null;
          reject(err);
          return;
        }

        // Configure the client once
        const namespaceUrl = `http://www.cisco.com/AXL/API/${options.version}`;

        client.wsdl.options = {
          ...client.wsdl.options,
          envelopeKey: "soapenv",
        };

        client.wsdl.definitions.xmlns.ns = namespaceUrl;

        if (client.wsdl.definitions.xmlns.ns1) {
          delete client.wsdl.definitions.xmlns.ns1;
        }

        client.setSecurity(new soap.soap.BasicAuthSecurity(options.username, options.password));
        client.setEndpoint(options.endpoint);

        this._soapClient = client;
        this._log.debug("SOAP client created and cached successfully");
        resolve(client);
      });
    });

    return this._soapClientPromise;
  }

  /**
   * Gets or creates the cached WSDL instance
   * @returns {Promise<any>} - Parsed WSDL object
   * @private
   */
  private _getWsdl(): Promise<any> {
    if (this._wsdl) {
      return Promise.resolve(this._wsdl);
    }

    if (this._wsdlPromise) {
      return this._wsdlPromise;
    }

    const options = this._OPTIONS;
    const wsdlPath = path.join(__dirname, `../schema/${options.version}/AXLAPI.wsdl`);
    this._log.debug(`Opening and caching WSDL file: ${wsdlPath}`);

    this._wsdlPromise = new Promise((resolve, reject) => {
      WSDL.open(wsdlPath, wsdlOptions, (err: any, wsdl: any) => {
        if (err) {
          this._log.error(`WSDL error occurred: ${err.message || "Unknown error"}`, err);
          this._wsdlPromise = null;
          reject(err);
          return;
        }

        this._wsdl = wsdl;
        this._log.debug("WSDL parsed and cached successfully");
        resolve(wsdl);
      });
    });

    return this._wsdlPromise;
  }

  /**
   * Wraps an async operation with retry logic for transient errors
   * @param {Function} fn - The async function to execute
   * @returns {Promise<any>} - Result from the function
   * @private
   */
  private async _withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const { retries, retryDelay, retryOn } = this._retryOptions;
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < retries && retryOn(error)) {
          const delay = retryDelay * Math.pow(2, attempt);
          this._log.warn(`Transient error on attempt ${attempt + 1}/${retries + 1}, retrying in ${delay}ms: ${(error as Error).message}`);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Set the log level at runtime
   * @param {LogLevel} level - The log level ("error" | "warn" | "info" | "debug")
   * @memberof axlService
   */
  setLogLevel(level: LogLevel): void {
    this._log.setLevel(level);
  }

  /**
   * Test authentication credentials against the AXL endpoint
   * @returns {Promise<boolean>} - Resolves to true if authentication is successful
   * @memberof axlService
   */
  async testAuthentication(): Promise<boolean> {
    try {
      const authSuccess = await this._testAuthenticationDirectly();
      if (!authSuccess) {
        throw new AXLAuthError();
      }
      return true;
    } catch (error) {
      if (error instanceof AXLAuthError) throw error;
      throw new AXLAuthError(`Authentication test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Private method to test authentication using a simple GET request to the AXL endpoint
   * @returns {Promise<boolean>} - Resolves with true if authentication successful, false otherwise
   * @private
   */
  private async _testAuthenticationDirectly(): Promise<boolean> {
    const options = this._OPTIONS;
    const url = new URL(options.endpoint);

    return new Promise<boolean>((resolve) => {
      const authHeader = "Basic " + Buffer.from(`${options.username}:${options.password}`).toString("base64");

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 8443,
        path: url.pathname,
        method: "GET",
        headers: {
          Authorization: authHeader,
          Connection: "keep-alive",
        },
        rejectUnauthorized: false,
      };

      this._log.debug(`Testing authentication to ${url.hostname}:${url.port || 8443}${url.pathname}`);

      const req = https.request(reqOptions, (res) => {
        this._log.debug(`Authentication test response status: ${res.statusCode}`);

        if (res.statusCode === 401 || res.statusCode === 403) {
          this._log.debug("Authentication failed: Unauthorized status code");
          resolve(false);
          return;
        }

        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          const successIndicator = "Cisco CallManager: AXL Web Service";
          if (responseData.includes(successIndicator)) {
            this._log.debug("Authentication succeeded: Found success message");
            resolve(true);
          } else if (responseData.includes("Authentication failed") || responseData.includes("401 Unauthorized") || responseData.includes("403 Forbidden")) {
            this._log.debug("Authentication failed: Found failure message in response");
            resolve(false);
          } else {
            this._log.debug("Authentication status uncertain, response did not contain expected messages");
            resolve(false);
          }
        });
      });

      req.on("error", (error) => {
        this._log.error("Authentication test error:", error.message);
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Returns a list of available AXL operations
   * @param {string} [filter] - Optional filter to narrow down operations
   * @returns {Promise<string[]>} - Array of operation names
   * @memberof axlService
   */
  async returnOperations(filter?: string): Promise<string[]> {
    this._log.debug(`Getting available operations${filter ? ` with filter: ${filter}` : ""}`);

    const client = await this._getClient();
    const description = client.describe();
    const outputArr: string[] = [];

    for (const [, value] of Object.entries(description.AXLAPIService.AXLPort)) {
      outputArr.push((value as any).name);
    }

    const sortAlphaNum = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
    const matches = (substring: string, array: string[]) =>
      array.filter((element) => element.toLowerCase().includes(substring.toLowerCase()));

    if (filter) {
      return matches(filter, outputArr).sort(sortAlphaNum);
    } else {
      return outputArr.sort(sortAlphaNum);
    }
  }

  /**
   * Gets the tags required for a specific AXL operation
   * @param {string} operation - The AXL operation name
   * @returns {Promise<any>} - Object containing the required tags
   * @memberof axlService
   */
  async getOperationTags(operation: string): Promise<any> {
    if (!operation || typeof operation !== "string") {
      throw new AXLValidationError("operation is required and must be a non-empty string");
    }

    this._log.debug(`Getting tags for operation: ${operation}`);

    const wsdl = await this._getWsdl();
    const operationDef = wsdl.definitions.bindings.AXLAPIBinding.operations[operation];
    if (!operationDef) {
      throw new AXLNotFoundError(operation);
    }

    const operName = operationDef.$name;
    const operationDesc = operationDef.describe(wsdl);
    const envelopeBody: any = {};

    operationDesc.input.body.elements.map((object: any) => {
      const operMatch = new RegExp(object.qname.name, "i");
      envelopeBody[object.qname.name] = "";

      if (object.qname.name === "searchCriteria") {
        const output = nestedObj(object);
        envelopeBody.searchCriteria = output;
      }

      if (object.qname.name === "returnedTags") {
        const output = nestedObj(object);
        envelopeBody.returnedTags = output;
      }

      if (operName.match(operMatch)) {
        const output = nestedObj(object);
        envelopeBody[object.qname.name] = output;
      }
    });

    return envelopeBody;
  }

  /**
   * Gets detailed tag metadata for a specific AXL operation, including required and nillable status.
   * This method provides richer information than getOperationTags() by inspecting the raw WSDL
   * schema elements for minOccurs, nillable, maxOccurs, and type information.
   * @param {string} operation - The AXL operation name
   * @returns {Promise<DetailedOperationTags>} - Object containing detailed tag metadata
   * @memberof axlService
   */
  async getOperationTagsDetailed(operation: string): Promise<DetailedOperationTags> {
    if (!operation || typeof operation !== "string") {
      throw new AXLValidationError("operation is required and must be a non-empty string");
    }

    this._log.debug(`Getting detailed tags for operation: ${operation}`);

    const wsdl = await this._getWsdl();
    const operationDef = wsdl.definitions.bindings.AXLAPIBinding.operations[operation];
    if (!operationDef) {
      throw new AXLNotFoundError(operation);
    }

    const operationDesc = operationDef.describe(wsdl);
    const result: DetailedOperationTags = {};

    operationDesc.input.body.elements.forEach((element: any) => {
      result[element.qname.name] = buildTagMetadata(element);
    });

    return result;
  }

  /**
   * Executes an AXL operation against the CUCM
   * @param {string} operation - The AXL operation to execute
   * @param {any} tags - The tags required for the operation
   * @param {OperationOptions} [opts] - Optional parameters for customizing the operation
   * @returns {Promise<any>} - Result of the operation
   * @memberof axlService
   */
  async executeOperation(operation: string, tags: any, opts?: OperationOptions): Promise<any> {
    if (!operation || typeof operation !== "string") {
      throw new AXLValidationError("operation is required and must be a non-empty string");
    }
    if (!tags || typeof tags !== "object") {
      throw new AXLValidationError("tags is required and must be an object");
    }

    return this._withRetry(() => this._executeOperationOnce(operation, tags, opts));
  }

  /**
   * Executes multiple AXL operations in parallel with optional concurrency control
   * @param {BatchOperation[]} operations - Array of operations to execute
   * @param {number} [concurrency=5] - Maximum number of concurrent operations
   * @returns {Promise<BatchResult[]>} - Array of results in the same order as input
   * @memberof axlService
   */
  async executeBatch(operations: BatchOperation[], concurrency: number = 5): Promise<BatchResult[]> {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new AXLValidationError("operations must be a non-empty array");
    }
    if (concurrency < 1) {
      throw new AXLValidationError("concurrency must be at least 1");
    }

    this._log.info(`Executing batch of ${operations.length} operations (concurrency: ${concurrency})`);

    const results: BatchResult[] = new Array(operations.length);
    let index = 0;

    const runNext = async (): Promise<void> => {
      while (index < operations.length) {
        const i = index++;
        const op = operations[i];
        try {
          const result = await this.executeOperation(op.operation, op.tags, op.opts);
          results[i] = { operation: op.operation, success: true, result };
        } catch (error) {
          results[i] = { operation: op.operation, success: false, error: error as Error };
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, operations.length) }, () => runNext());
    await Promise.all(workers);

    const succeeded = results.filter((r) => r.success).length;
    this._log.info(`Batch complete: ${succeeded}/${operations.length} succeeded`);

    return results;
  }

  // ─── Convenience Methods ─────────────────────────────────────────────────

  /**
   * Gets a single item by operation name and identifier.
   * Shorthand for getOperationTags + setting name/uuid + executeOperation.
   * @param {string} itemType - The AXL item type (e.g. "Phone", "Line", "RoutePartition")
   * @param {string | { name?: string; uuid?: string }} identifier - The name or uuid, or an object with one
   * @param {OperationOptions} [opts] - Optional parameters
   * @returns {Promise<any>} - The item data
   * @memberof axlService
   */
  async getItem(itemType: string, identifier: string | { name?: string; uuid?: string }, opts?: OperationOptions): Promise<any> {
    const operation = `get${itemType}`;
    const tags = await this.getOperationTags(operation);

    if (typeof identifier === "string") {
      tags.name = identifier;
    } else {
      if (identifier.uuid) tags.uuid = identifier.uuid;
      else if (identifier.name) tags.name = identifier.name;
    }

    return this.executeOperation(operation, tags, opts);
  }

  /**
   * Lists items matching a search pattern.
   * Shorthand for getOperationTags + setting searchCriteria + executeOperation.
   * @param {string} itemType - The AXL item type (e.g. "Phone", "Line", "RoutePartition")
   * @param {object} [searchCriteria] - Search criteria key/value pairs (defaults to %% wildcard on all fields)
   * @param {object} [returnedTags] - Specific tags to return (defaults to all)
   * @param {OperationOptions} [opts] - Optional parameters
   * @returns {Promise<any>} - The list results
   * @memberof axlService
   */
  async listItems(itemType: string, searchCriteria?: Record<string, string>, returnedTags?: Record<string, string>, opts?: OperationOptions): Promise<any> {
    const operation = `list${itemType}`;
    const tags = await this.getOperationTags(operation);

    // Apply search criteria
    if (searchCriteria) {
      Object.assign(tags.searchCriteria, searchCriteria);
    } else if (tags.searchCriteria) {
      // Default: wildcard on all search fields
      Object.keys(tags.searchCriteria).forEach((k) => {
        tags.searchCriteria[k] = "%%";
      });
    }

    // Apply returned tags filter
    if (returnedTags) {
      tags.returnedTags = returnedTags;
    }

    return this.executeOperation(operation, tags, opts);
  }

  /**
   * Adds an item via AXL.
   * Shorthand for executeOperation with "add{itemType}" and provided data.
   * @param {string} itemType - The AXL item type (e.g. "Phone", "Line", "RoutePartition")
   * @param {object} data - The item data to add
   * @param {OperationOptions} [opts] - Optional parameters
   * @returns {Promise<any>} - The result (typically a UUID)
   * @memberof axlService
   */
  async addItem(itemType: string, data: Record<string, any>, opts?: OperationOptions): Promise<any> {
    const operation = `add${itemType}`;
    // Build tags with the item type key wrapping the data (e.g. { routePartition: { name: "..." } })
    const itemKey = itemType.charAt(0).toLowerCase() + itemType.slice(1);
    const tags: any = {};
    tags[itemKey] = data;

    return this.executeOperation(operation, tags, opts);
  }

  /**
   * Updates an existing item via AXL.
   * @param {string} itemType - The AXL item type (e.g. "Phone", "Line", "RoutePartition")
   * @param {string | { name?: string; uuid?: string }} identifier - The name or uuid
   * @param {object} updates - The fields to update
   * @param {OperationOptions} [opts] - Optional parameters
   * @returns {Promise<any>} - The result
   * @memberof axlService
   */
  async updateItem(itemType: string, identifier: string | { name?: string; uuid?: string }, updates: Record<string, any>, opts?: OperationOptions): Promise<any> {
    const operation = `update${itemType}`;
    const itemKey = itemType.charAt(0).toLowerCase() + itemType.slice(1);
    const tags: any = {};
    tags[itemKey] = { ...updates };

    if (typeof identifier === "string") {
      tags[itemKey].name = identifier;
    } else {
      if (identifier.uuid) tags[itemKey].uuid = identifier.uuid;
      else if (identifier.name) tags[itemKey].name = identifier.name;
    }

    return this.executeOperation(operation, tags, opts);
  }

  /**
   * Removes an item via AXL.
   * @param {string} itemType - The AXL item type (e.g. "Phone", "Line", "RoutePartition")
   * @param {string | { name?: string; uuid?: string }} identifier - The name or uuid
   * @param {OperationOptions} [opts] - Optional parameters
   * @returns {Promise<any>} - The result
   * @memberof axlService
   */
  async removeItem(itemType: string, identifier: string | { name?: string; uuid?: string }, opts?: OperationOptions): Promise<any> {
    const operation = `remove${itemType}`;
    const tags: any = {};

    if (typeof identifier === "string") {
      tags.name = identifier;
    } else {
      if (identifier.uuid) tags.uuid = identifier.uuid;
      else if (identifier.name) tags.name = identifier.name;
    }

    return this.executeOperation(operation, tags, opts);
  }

  /**
   * Executes an AXL SQL query
   * @param {string} sql - The SQL query to execute
   * @returns {Promise<any>} - The query results
   * @memberof axlService
   */
  async executeSqlQuery(sql: string): Promise<any> {
    if (!sql || typeof sql !== "string") {
      throw new AXLValidationError("sql is required and must be a non-empty string");
    }
    return this.executeOperation("executeSQLQuery", { sql });
  }

  /**
   * Executes an AXL SQL update
   * @param {string} sql - The SQL update statement to execute
   * @returns {Promise<any>} - The update results
   * @memberof axlService
   */
  async executeSqlUpdate(sql: string): Promise<any> {
    if (!sql || typeof sql !== "string") {
      throw new AXLValidationError("sql is required and must be a non-empty string");
    }
    return this.executeOperation("executeSQLUpdate", { sql });
  }

  // ─── Private: Single Operation Execution ─────────────────────────────────

  /**
   * Internal single-attempt operation execution (called by _withRetry wrapper)
   * @private
   */
  private async _executeOperationOnce(operation: string, tags: any, opts?: OperationOptions): Promise<any> {
    this._log.debug(`Preparing to execute operation: ${operation}`);
    const options = this._OPTIONS;

    const clean = opts?.clean ?? false;
    const dataContainerIdentifierTails = opts?.dataContainerIdentifierTails ?? "_data";
    const removeAttributes = opts?.removeAttributes ?? false;

    // Clone tags to avoid mutating the caller's object
    let workingTags = JSON.parse(JSON.stringify(tags));

    // Remove empty top level strings and json-variables identifiers
    this._log.debug("Cleaning input tags from empty values and json-variables");
    Object.keys(workingTags).forEach((k) => {
      if (workingTags[k] === "" || k.includes(dataContainerIdentifierTails)) {
        this._log.debug(`Removing tag: ${k}`);
        delete workingTags[k];
      }
    });

    const client = await this._getClient();
    const namespaceUrl = `http://www.cisco.com/AXL/API/${options.version}`;

    return new Promise((resolve, reject) => {
      const customRequestHeader = {
        connection: "keep-alive",
        SOAPAction: `"CUCM:DB ver=${options.version} ${operation}"`,
      };

      client.on("soapError", (err: any) => {
        this._log.debug("SOAP error event triggered");
        if (err.root?.Envelope?.Body?.Fault) {
          const fault = err.root.Envelope.Body.Fault;
          const faultString = fault.faultstring || fault.faultString || "";
          this._log.debug(`SOAP fault detected: ${faultString}`, fault);

          if (typeof faultString === "string" && (faultString.includes("Authentication failed") || faultString.includes("credentials") || faultString.includes("authorize"))) {
            reject(new AXLAuthError());
          } else {
            reject(new AXLOperationError(faultString || "SOAP fault", operation, fault.faultcode, fault.detail));
          }
        } else {
          reject(err);
        }
      });

      // Check if the operation function exists
      if (!client.AXLAPIService || !client.AXLAPIService.AXLPort || typeof client.AXLAPIService.AXLPort[operation] !== "function") {
        this._log.debug(`Operation '${operation}' not found in AXL API, attempting alternative approach`);
        if (operation.startsWith("apply") || operation.startsWith("reset")) {
          this._log.debug(`Using manual XML approach for ${operation} operation`);
          const operationObj = workingTags[operation] || workingTags;

          let paramTag: string, paramValue: string;

          if (operationObj.uuid) {
            paramTag = "uuid";
            paramValue = operationObj.uuid;
          } else {
            paramTag = "name";
            paramValue = operationObj.name;
          }

          const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
             <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${namespaceUrl}">
               <soapenv:Header/>
               <soapenv:Body>
                 <ns:${operation}>
                   <${paramTag}>${escapeXml(paramValue)}</${paramTag}>
                 </ns:${operation}>
               </soapenv:Body>
             </soapenv:Envelope>`;

          this._log.debug(`Sending manual XML request for ${operation}`, { paramTag, paramValue });
          (client as any)._request(
            options.endpoint,
            rawXml,
            (err: any, body: any, response: any) => {
              if (err) {
                this._log.error(`Error in manual XML request: ${err.message || "Unknown error"}`);
                reject(err);
                return;
              }

              if (response && (response.statusCode === 401 || response.statusCode === 403)) {
                reject(new AXLAuthError());
                return;
              }

              if (body && typeof body === "string" && (body.includes("Authentication failed") || body.includes("401 Unauthorized") || body.includes("403 Forbidden") || body.includes("HTTP Status 401") || body.includes("HTTP Status 403"))) {
                reject(new AXLAuthError());
                return;
              }

              try {
                if (body && body.includes("Fault")) {
                  const faultMatch = /<faultstring>(.*?)<\/faultstring>/;
                  const match = body.match(faultMatch);
                  if (match && match[1]) {
                    const faultString = match[1];
                    if (faultString.includes("Authentication failed") || faultString.includes("credentials") || faultString.includes("authorize")) {
                      reject(new AXLAuthError());
                    } else {
                      reject(new AXLOperationError(faultString, operation));
                    }
                  } else {
                    reject(new AXLOperationError("Unknown SOAP fault occurred", operation));
                  }
                } else {
                  this._log.debug(`Operation ${operation} completed successfully via manual XML`);
                  resolve({ return: "Success" });
                }
              } catch (parseError) {
                reject(parseError);
              }
            },
            customRequestHeader
          );

          return;
        } else {
          reject(new AXLNotFoundError(operation));
          return;
        }
      }

      const axlFunc = client.AXLAPIService.AXLPort[operation];
      this._log.debug(`Found operation function: ${operation}`);

      const nsContext = {
        ns: namespaceUrl,
      };

      let message = workingTags;

      // Handle operations that start with "apply" or "reset"
      if (operation.startsWith("apply") || operation.startsWith("reset")) {
        const operationKey = operation;
        if (workingTags[operationKey]) {
          if (workingTags[operationKey].uuid) {
            message = { uuid: workingTags[operationKey].uuid };
          } else if (workingTags[operationKey].name) {
            message = { name: workingTags[operationKey].name };
          } else {
            if (workingTags.uuid) {
              message = { uuid: workingTags.uuid };
            } else {
              message = { name: workingTags.name };
            }
          }
        }
      }

      this._log.debug(`Executing operation: ${operation}`);

      // Create a sanitized copy of the message for logging
      let logMessage = JSON.parse(JSON.stringify(message));
      if (logMessage.password) logMessage.password = "********";
      this._log.debug(`Message for operation ${operation}:`, logMessage);

      axlFunc(
        message,
        (err: any, result: any, rawResponse: any) => {
          if (err) {
            this._log.debug(`Error in operation ${operation}: ${err.message || "Unknown error"}`);
            if (err.message && (err.message.includes("Authentication failed") || err.message.includes("401 Unauthorized") || err.message.includes("403 Forbidden") || err.message.includes("credentials"))) {
              reject(new AXLAuthError());
              return;
            }

            if (err.response && (err.response.statusCode === 401 || err.response.statusCode === 403)) {
              reject(new AXLAuthError());
              return;
            }

            reject(err);
            return;
          }

          this._log.debug(`Operation ${operation} executed successfully`);

          if (rawResponse && typeof rawResponse === "string") {
            // Detect auth failures in raw response (CUCM returns HTML error pages for 401/403)
            if (
              rawResponse.includes("Authentication failed") ||
              rawResponse.includes("401 Unauthorized") ||
              rawResponse.includes("403 Forbidden") ||
              rawResponse.includes("HTTP Status 401") ||
              rawResponse.includes("HTTP Status 403")
            ) {
              this._log.debug(`Authentication failure detected in raw response for ${operation}`);
              reject(new AXLAuthError());
              return;
            }

            // Detect non-SOAP responses (e.g., HTML error pages) when result is null
            if (!result && rawResponse.includes("<html>")) {
              this._log.debug(`Received HTML error page instead of SOAP response for ${operation}`);
              const titleMatch = rawResponse.match(/<title>\s*(.*?)\s*<\/title>/i);
              const descMatch = rawResponse.match(/<b>\s*Description:\s*<\/b>\s*(.*?)\s*<\/p>/i);
              const errorMsg = descMatch?.[1] || titleMatch?.[1] || "Server returned an HTML error page instead of a SOAP response";
              reject(new AXLOperationError(errorMsg, operation));
              return;
            }
          }

          if (result?.hasOwnProperty("return")) {
            const output = result.return;

            if (clean) {
              cleanObj(output);
            }
            if (removeAttributes) {
              cleanAttributes(output);
            }

            this._log.debug(`Operation ${operation} completed with return data`);
            resolve(output);
          } else {
            this._log.debug(`Operation ${operation} completed without return data`);
            resolve(result || { return: "Success" });
          }
        },
        nsContext,
        customRequestHeader
      );
    });
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Creates a nested object from WSDL elements
 * @param {any} object - The WSDL object to process
 * @returns {any} - Processed object
 */
const nestedObj = (object: any): any => {
  const operObj: any = {};

  object.elements.map((object: any) => {
    operObj[object.qname.name] = "";

    if (Array.isArray(object.elements) && object.elements.length > 0) {
      const nestName = object.qname.name;
      operObj[nestName] = {};
      const nestObj = nestedObj(object);
      operObj[nestName] = nestObj;
    }
  });

  const isEmpty = Object.keys(operObj).length === 0;

  if (isEmpty) {
    return "";
  } else {
    return operObj;
  }
};

/**
 * Builds detailed tag metadata from a WSDL element descriptor, including
 * required, nillable, type, and isMany information.
 * @param {any} element - The WSDL element descriptor
 * @returns {TagMetadata} - Detailed metadata for the tag
 */
const buildTagMetadata = (element: any): TagMetadata => {
  const name = element.qname?.name || "";
  const nillable = element.isNillable === true;
  const isMany = element.isMany === true;
  const type = element.type ? (element.type.name || element.type.toString()) : null;

  let required = true;
  const rawElement = element.refOriginal || element;
  if (rawElement.$minOccurs !== undefined) {
    required = parseInt(rawElement.$minOccurs, 10) > 0;
  } else if (nillable) {
    required = false;
  }

  let children: { [key: string]: TagMetadata } | null = null;
  if (Array.isArray(element.elements) && element.elements.length > 0) {
    children = {};
    element.elements.forEach((child: any) => {
      children![child.qname.name] = buildTagMetadata(child);
    });
  }

  return { name, required, nillable, isMany, type, children };
};

/**
 * Cleans an object by removing null, undefined, or empty values
 * @param {any} object - The object to clean
 * @returns {any} - Cleaned object
 */
const cleanObj = (object: any): any => {
  if (Array.isArray(object)) {
    for (let i = object.length - 1; i >= 0; i--) {
      const v = object[i];
      if (v && typeof v === "object") {
        cleanObj(v);
      }
      if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
        object.splice(i, 1);
      }
    }
  } else {
    Object.entries(object).forEach(([k, v]) => {
      if (v && typeof v === "object") {
        cleanObj(v);
      }
      if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
        delete object[k];
      }
    });
  }

  return object;
};

/**
 * Removes "attributes" fields from an object recursively
 * @param {any} object - The object to clean
 * @returns {any} - Cleaned object
 */
const cleanAttributes = (object: any): any => {
  if (Array.isArray(object)) {
    object.forEach((item) => {
      if (item && typeof item === "object") {
        cleanAttributes(item);
      }
    });
  } else if (object && typeof object === "object") {
    if ("attributes" in object) {
      delete object.attributes;
    }
    Object.values(object).forEach((v) => {
      if (v && typeof v === "object") {
        cleanAttributes(v);
      }
    });
  }

  return object;
};

// ─── Exports ─────────────────────────────────────────────────────────────────

// Export the service as default + named error classes
export = Object.assign(axlService, {
  AXLError,
  AXLAuthError,
  AXLNotFoundError,
  AXLOperationError,
  AXLValidationError,
});
