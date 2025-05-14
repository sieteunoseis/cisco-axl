const soap = require("strong-soap").soap;
const WSDL = soap.WSDL;
const path = require("path");
const https = require("https");
const { URL } = require("url");

const wsdlOptions = {
  attributesKey: "attributes",
  valueKey: "value",
  ns1: "ns",
};

/**
 * Helper function to log debug messages only when DEBUG environment variable is set
 * @param {string} message - The message to log
 * @param {any} [data] - Optional data to log
 */
const debugLog = (message, data) => {
  // Get the DEBUG value, handling case-insensitivity
  const debug = process.env.DEBUG;

  // Check if DEBUG is set and is a truthy value (not 'false', 'no', '0', etc.)
  const isDebugEnabled = debug && !["false", "no", "0", "off", "n"].includes(debug.toLowerCase());

  if (isDebugEnabled) {
    if (data) {
      console.log(`[AXL DEBUG] ${message}`, data);
    } else {
      console.log(`[AXL DEBUG] ${message}`);
    }
  }
};

/**
 * Cisco axlService Service
 * This is a service class that uses fetch and promises to pull AXL data from Cisco CUCM
 *
 * @class axlService
 */
class axlService {
  constructor(host, username, password, version) {
    if (!host || !username || !password || !version) throw new TypeError("missing parameters");
    this._OPTIONS = {
      username: username,
      password: password,
      url: path.join(__dirname, `/schema/${version}/AXLAPI.wsdl`),
      endpoint: `https://${host}:8443/axl/`,
      version: version,
    };
    debugLog(`Initializing AXL service for host: ${host}, version: ${version}`);
  }

  /**
   * Test authentication credentials against the AXL endpoint
   * @returns {Promise<boolean>} - Resolves to true if authentication is successful
   */
  async testAuthentication() {
    try {
      const authSuccess = await this._testAuthenticationDirectly();
      if (!authSuccess) {
        throw new Error("Authentication failed. Check username and password.");
      }
      return true;
    } catch (error) {
      throw new Error(`Authentication test failed: ${error.message}`);
    }
  }

  /**
   * Private method to test authentication using a simple GET request to the AXL endpoint
   * @returns {Promise<boolean>} - Resolves with true if authentication successful, false otherwise
   * @private
   */
  async _testAuthenticationDirectly() {
    const options = this._OPTIONS;
    const url = new URL(options.endpoint);

    return new Promise((resolve) => {
      const authHeader = "Basic " + Buffer.from(`${options.username}:${options.password}`).toString("base64");

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 8443,
        path: url.pathname,
        method: "GET", // Simply use GET instead of POST
        headers: {
          Authorization: authHeader,
          Connection: "keep-alive",
        },
        rejectUnauthorized: false, // For self-signed certificates
      };

      debugLog(`Testing authentication to ${url.hostname}:${url.port || 8443}${url.pathname}`);

      const req = https.request(reqOptions, (res) => {
        debugLog(`Authentication test response status: ${res.statusCode}`);

        // Check status code for authentication failures
        if (res.statusCode === 401 || res.statusCode === 403) {
          debugLog("Authentication failed: Unauthorized status code");
          resolve(false); // Authentication failed
          return;
        }

        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          // Check for the expected success message
          const successIndicator = "Cisco CallManager: AXL Web Service";
          if (responseData.includes(successIndicator)) {
            debugLog("Authentication succeeded: Found success message");
            resolve(true); // Authentication succeeded
          } else if (responseData.includes("Authentication failed") || responseData.includes("401 Unauthorized") || responseData.includes("403 Forbidden")) {
            debugLog("Authentication failed: Found failure message in response");
            resolve(false); // Authentication failed
          } else {
            debugLog("Authentication status uncertain, response did not contain expected messages");
            // If we're not sure, assume it failed to be safe
            resolve(false);
          }
        });
      });

      req.on("error", (error) => {
        console.error("Authentication test error:", error.message);
        resolve(false);
      });

      // Since it's a GET request, we just end it without writing any data
      req.end();
    });
  }

  returnOperations(filter) {
    debugLog(`Getting available operations${filter ? ` with filter: ${filter}` : ''}`);
    var options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      debugLog(`Creating SOAP client for ${options.url}`);
      soap.createClient(options.url, wsdlOptions, function (err, client) {
        if (err) {
          debugLog(`SOAP error occurred: ${err.message || 'Unknown error'}`, err);
          reject(err);
          return;
        }
        client.setSecurity(new soap.BasicAuthSecurity(options.username, options.password));
        client.setEndpoint(options.endpoint);

        var description = client.describe();

        var outputArr = [];

        for (const [key, value] of Object.entries(description.AXLAPIService.AXLPort)) {
          outputArr.push(value.name);
        }

        const sortAlphaNum = (a, b) => a.localeCompare(b, "en", { numeric: true });
        const matches = (substring, array) =>
          array.filter((element) => {
            if (element.toLowerCase().includes(substring.toLowerCase())) {
              return true;
            }
          });

        if (filter) {
          resolve(matches(filter, outputArr).sort(sortAlphaNum));
        } else {
          resolve(outputArr.sort(sortAlphaNum));
        }

        client.on("soapError", function (err) {
          reject(err.root.Envelope.Body.Fault);
        });
      });
    });
  }

  getOperationTags(operation) {
    debugLog(`Getting tags for operation: ${operation}`);
    var options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      const wsdlPath = path.join(__dirname, `/schema/${options.version}/AXLAPI.wsdl`);
      debugLog(`Opening WSDL file: ${wsdlPath}`);
      WSDL.open(wsdlPath, wsdlOptions, function (err, wsdl) {
        if (err) {
          debugLog(`WSDL error occurred: ${err.message || 'Unknown error'}`, err);
          reject(err);
        }
        var operationDef = wsdl.definitions.bindings.AXLAPIBinding.operations[operation];
        var operName = operationDef.$name;
        var operationDesc = operationDef.describe(wsdl);
        var envelopeBody = {};
        operationDesc.input.body.elements.map((object) => {
          var operMatch = new RegExp(object.qname.name, "i");
          envelopeBody[object.qname.name] = "";
          if (object.qname.name === "searchCriteria") {
            let output = nestedObj(object);
            envelopeBody.searchCriteria = output;
          }
          if (object.qname.name === "returnedTags") {
            let output = nestedObj(object);
            envelopeBody.returnedTags = output;
          }
          if (operName.match(operMatch)) {
            let output = nestedObj(object);
            envelopeBody[object.qname.name] = output;
          }
        });
        resolve(envelopeBody);
      });
    });
  }

  /**
   * Executes an AXL operation against the CUCM
   * @param {string} operation - The AXL operation to execute
   * @param {Object} tags - The tags required for the operation
   * @param {Object} [opts] - Optional parameters for customizing the operation
   * @returns {Promise<any>} - Result of the operation
   */
  async executeOperation(operation, tags, opts) {
    debugLog(`Preparing to execute operation: ${operation}`);
    const options = this._OPTIONS;

    // First test authentication
    debugLog(`Testing authentication before executing operation: ${operation}`);
    const authSuccess = await this._testAuthenticationDirectly();
    if (!authSuccess) {
      debugLog(`Authentication failed for operation: ${operation}`);
      throw new Error("Authentication failed. Check username and password.");
    }
    debugLog("Authentication successful, proceeding with operation");

    const clean = opts?.clean ?? false;
    const dataContainerIdentifierTails = opts?.dataContainerIdentifierTails ?? "_data";
    const removeAttributes = opts?.removeAttributes ?? false;

    // Let's remove empty top level strings. Also filter out json-variables
    debugLog("Cleaning input tags from empty values and json-variables");
    Object.keys(tags).forEach((k) => {
      if (tags[k] == "" || k.includes(dataContainerIdentifierTails)) {
        debugLog(`Removing tag: ${k}`);
        delete tags[k];
      }
    });

    return new Promise((resolve, reject) => {
      debugLog(`Creating SOAP client for operation: ${operation}`);
      soap.createClient(options.url, wsdlOptions, function (err, client) {
        if (err) {
          debugLog(`SOAP client creation error: ${err.message || 'Unknown error'}`, err);
          reject(err);
          return;
        }

        // Get the properly versioned namespace URL
        const namespaceUrl = `http://www.cisco.com/AXL/API/${options.version}`;
        debugLog(`Using AXL namespace: ${namespaceUrl}`);

        // 1. Set envelope key
        debugLog("Setting envelope key to 'soapenv'");
        client.wsdl.options = {
          ...client.wsdl.options,
          envelopeKey: "soapenv", // Change default 'soap' to 'soapenv'
        };

        // 2. Define namespaces with the correct version
        debugLog(`Setting namespace 'ns' to: ${namespaceUrl}`);
        client.wsdl.definitions.xmlns.ns = namespaceUrl;

        // Remove ns1 if it exists
        if (client.wsdl.definitions.xmlns.ns1) {
          debugLog("Removing 'ns1' namespace");
          delete client.wsdl.definitions.xmlns.ns1;
        }

        var customRequestHeader = {
          connection: "keep-alive",
          SOAPAction: `"CUCM:DB ver=${options.version} ${operation}"`,
        };

        client.setSecurity(new soap.BasicAuthSecurity(options.username, options.password));
        client.setEndpoint(options.endpoint);

        client.on("soapError", function (err) {
          debugLog("SOAP error event triggered");
          // Check if this is an authentication error
          if (err.root?.Envelope?.Body?.Fault) {
            const fault = err.root.Envelope.Body.Fault;
            const faultString = fault.faultstring || fault.faultString || "";
            debugLog(`SOAP fault detected: ${faultString}`, fault);

            if (typeof faultString === "string" && (faultString.includes("Authentication failed") || faultString.includes("credentials") || faultString.includes("authorize"))) {
              debugLog("Authentication error detected in SOAP fault");
              reject(new Error("Authentication failed. Check username and password."));
            } else {
              debugLog("Non-authentication SOAP fault");
              reject(fault);
            }
          } else {
            debugLog("Unstructured SOAP error", err);
            reject(err);
          }
        });

        // Check if the operation function exists
        if (!client.AXLAPIService || !client.AXLAPIService.AXLPort || typeof client.AXLAPIService.AXLPort[operation] !== "function") {
          debugLog(`Operation '${operation}' not found in AXL API, attempting alternative approach`);
          // For operations that aren't found, try a manual approach
          if (operation.startsWith("apply") || operation.startsWith("reset")) {
            debugLog(`Using manual XML approach for ${operation} operation`);
            // Determine which parameter to use (name or uuid)
            const operationObj = tags[operation] || tags;
            // Check if uuid or name is provided
            let paramTag, paramValue;

            if (operationObj.uuid) {
              paramTag = "uuid";
              paramValue = operationObj.uuid;
              debugLog(`Using uuid parameter: ${paramValue}`);
            } else {
              paramTag = "name";
              paramValue = operationObj.name;
              debugLog(`Using name parameter: ${paramValue}`);
            }

            const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
             <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${namespaceUrl}">
               <soapenv:Header/>
               <soapenv:Body>
                 <ns:${operation}>
                   <${paramTag}>${paramValue}</${paramTag}>
                 </ns:${operation}>
               </soapenv:Body>
             </soapenv:Envelope>`;

            debugLog(`Executing manual XML request for operation: ${operation}`);

            // Use client.request for direct XML request
            debugLog(`Sending manual XML request to ${options.endpoint}`, { operation, paramTag, paramValue });
            client._request(
              options.endpoint,
              rawXml,
              function (err, body, response) {
                if (err) {
                  debugLog(`Error in manual XML request: ${err.message || 'Unknown error'}`, err);
                  reject(err);
                  return;
                }

                // Check for authentication failures in the response
                if (response && (response.statusCode === 401 || response.statusCode === 403)) {
                  debugLog(`Authentication failed in manual request. Status code: ${response.statusCode}`);
                  reject(new Error("Authentication failed. Check username and password."));
                  return;
                }

                if (body && typeof body === "string" && (body.includes("Authentication failed") || body.includes("401 Unauthorized") || body.includes("403 Forbidden"))) {
                  debugLog(`Authentication failed in manual request. Found auth failure text in body.`);
                  reject(new Error("Authentication failed. Check username and password."));
                  return;
                }
                
                debugLog(`Manual XML request response received. Size: ${body ? body.length : 0} bytes`);
                

                // Parse the response
                try {
                  // Don't automatically assume success
                  if (body && body.includes("Fault")) {
                    debugLog("Fault detected in manual XML response");
                    // Try to extract the fault message
                    const faultMatch = /<faultstring>(.*?)<\/faultstring>/;
                    const match = body.match(faultMatch);
                    if (match && match[1]) {
                      const faultString = match[1];
                      debugLog(`Extracted fault string: ${faultString}`);
                      if (faultString.includes("Authentication failed") || faultString.includes("credentials") || faultString.includes("authorize")) {
                        debugLog("Authentication failure detected in fault string");
                        reject(new Error("Authentication failed. Check username and password."));
                      } else {
                        debugLog(`Operation failed with fault: ${faultString}`);
                        reject(new Error(faultString));
                      }
                    } else {
                      debugLog("Unknown SOAP fault format, couldn't extract fault string");
                      reject(new Error("Unknown SOAP fault occurred"));
                    }
                  } else {
                    debugLog(`Operation ${operation} completed successfully via manual XML`);
                    const result = { return: "Success" }; // Only report success if no errors found
                    resolve(result);
                  }
                } catch (parseError) {
                  debugLog(`Error parsing manual XML response: ${parseError.message || 'Unknown error'}`, parseError);
                  reject(parseError);
                }
              },
              customRequestHeader
            );

            return;
          } else {
            debugLog(`Operation "${operation}" not found and cannot be handled via manual XML`);
            reject(new Error(`Operation "${operation}" not found`));
            return;
          }
        }

        // Get the operation function - confirmed to exist at this point
        var axlFunc = client.AXLAPIService.AXLPort[operation];
        debugLog(`Found operation function: ${operation}`);

        // Define namespace context with the correct version
        const nsContext = {
          ns: namespaceUrl,
        };

        // Prepare message for specific operations
        let message = tags;

        // Handle operations that start with "apply" or "reset"
        if (operation.startsWith("apply") || operation.startsWith("reset")) {
          debugLog(`Special message handling for ${operation} operation`);
          const operationKey = operation;

          // If there's a nested structure, flatten it
          if (tags[operationKey]) {
            debugLog(`Found nested structure for ${operationKey}`);
            // Check if uuid or name is provided in the nested structure
            if (tags[operationKey].uuid) {
              debugLog(`Using uuid from nested structure: ${tags[operationKey].uuid}`);
              message = { uuid: tags[operationKey].uuid };
            } else if (tags[operationKey].name) {
              debugLog(`Using name from nested structure: ${tags[operationKey].name}`);
              message = { name: tags[operationKey].name };
            }
            // If neither uuid nor name is provided, try to use any available
            else {
              // Try to use uuid or name from the top level as fallback
              if (tags.uuid) {
                debugLog(`Using uuid from top level: ${tags.uuid}`);
                message = { uuid: tags.uuid };
              } else {
                debugLog(`Using name from top level: ${tags.name}`);
                message = { name: tags.name };
              }
            }
          } else {
            debugLog(`No nested structure found for ${operationKey}, using tags directly`);
          }
        }

        debugLog(`Executing operation: ${operation}`);

        // Create a sanitized copy of the message for logging
        let logMessage = JSON.parse(JSON.stringify(message));
        // Remove any sensitive data if present
        if (logMessage.password) logMessage.password = '********';
        debugLog(`Preparing message for operation ${operation}:`, logMessage);

        // Execute the operation
        axlFunc(
          message,
          function (err, result, rawResponse, soapHeader, rawRequest) {
            if (err) {
              debugLog(`Error in operation ${operation}: ${err.message || 'Unknown error'}`);
              // Check if this is an authentication error
              if (err.message && (err.message.includes("Authentication failed") || err.message.includes("401 Unauthorized") || err.message.includes("403 Forbidden") || err.message.includes("credentials"))) {
                debugLog(`Authentication failure detected in operation error message`);
                reject(new Error("Authentication failed. Check username and password."));
                return;
              }

              // Check if the error response indicates authentication failure
              if (err.response && (err.response.statusCode === 401 || err.response.statusCode === 403)) {
                debugLog(`Authentication failure detected in response status code: ${err.response.statusCode}`);
                reject(new Error("Authentication failed. Check username and password."));
                return;
              }

              debugLog(`Operation ${operation} failed with error`, err);
              reject(err);
              return;
            }
            
            debugLog(`Operation ${operation} executed successfully`);

            // Check the raw response for auth failures (belt and suspenders approach)
            if (rawResponse && typeof rawResponse === "string" && (rawResponse.includes("Authentication failed") || rawResponse.includes("401 Unauthorized") || rawResponse.includes("403 Forbidden"))) {
              debugLog(`Authentication failure detected in raw response`);
              reject(new Error("Authentication failed. Check username and password."));
              return;
            }

            if (result?.hasOwnProperty("return")) {
              var output = result.return;
              debugLog(`Operation returned data with 'return' property`);
              
              if (clean) {
                debugLog(`Cleaning empty/null values from output`);
                cleanObj(output);
              }
              if (removeAttributes) {
                debugLog(`Removing attribute fields from output`);
                cleanAttributes(output);
              }
              
              debugLog(`Operation ${operation} completed successfully with return data`);
              resolve(output);
            } else {
              debugLog(`Operation ${operation} completed successfully without return data`);
              resolve(result || { return: "Success" });
            }
          },
          nsContext,
          customRequestHeader
        );
      });
    });
  }
}

const nestedObj = (object) => {
  var operObj = {};
  object.elements.map((object) => {
    operObj[object.qname.name] = "";
    if (Array.isArray(object.elements) && object.elements.length > 0) {
      var nestName = object.qname.name;
      operObj[nestName] = {};
      var nestObj = nestedObj(object);
      operObj[nestName] = nestObj;
    }
  });
  const isEmpty = Object.keys(operObj).length === 0;
  if (isEmpty) {
    operObj = "";
    return operObj;
  } else {
    return operObj;
  }
};

const cleanObj = (object) => {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      cleanObj(v);
    }
    if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
      if (Array.isArray(object)) {
        object.splice(k, 1);
      } else {
        delete object[k];
      }
    }
  });
  return object;
};

const cleanAttributes = (object) => {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      cleanAttributes(v);
    }
    if (v && typeof v === "object" && "attributes" in object) {
      if (Array.isArray(object)) {
        object.splice(k, 1);
      } else {
        delete object[k];
      }
    }
  });
  return object;
};

module.exports = axlService;
