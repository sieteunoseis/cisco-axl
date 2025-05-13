import * as soap from 'strong-soap';
import * as path from 'path';

const WSDL = soap.soap.WSDL;

const wsdlOptions = {
  attributesKey: "attributes",
  valueKey: "value",
};

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

/**
 * Cisco axlService Service
 * This is a service class that uses fetch and promises to pull AXL data from Cisco CUCM
 *
 * @class axlService
 */
class axlService {
  private _OPTIONS: AXLServiceOptions;

  /**
   * Creates an instance of axlService.
   * @param {string} host - CUCM hostname or IP address
   * @param {string} username - CUCM username with AXL permissions
   * @param {string} password - CUCM password
   * @param {string} version - CUCM version (e.g. "14.0")
   * @memberof axlService
   */
  constructor(host: string, username: string, password: string, version: string) {
    if (!host || !username || !password || !version) throw new TypeError("missing parameters");
    this._OPTIONS = {
      username: username,
      password: password,
      url: path.join(__dirname, `../schema/${version}/AXLAPI.wsdl`),
      endpoint: `https://${host}:8443/axl/`,
      version: version,
    };
  }

  /**
   * Returns a list of available AXL operations
   * @param {string} [filter] - Optional filter to narrow down operations
   * @returns {Promise<string[]>} - Array of operation names
   * @memberof axlService
   */
  returnOperations(filter?: string): Promise<string[]> {
    const options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      soap.soap.createClient(options.url, wsdlOptions, function (err: any, client: any) {
        if (err) {
          reject(err);
          return;
        }

        client.setSecurity(new soap.soap.BasicAuthSecurity(options.username, options.password));
        client.setEndpoint(options.endpoint);

        const description = client.describe();
        const outputArr: string[] = [];

        for (const [, value] of Object.entries(description.AXLAPIService.AXLPort)) {
          outputArr.push((value as any).name);
        }
        
        const sortAlphaNum = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
        const matches = (substring: string, array: string[]) =>
          array.filter((element) => {
            if (element.toLowerCase().includes(substring.toLowerCase())) {
              return true;
            }
            return false;
          });

        if (filter) {
          resolve(matches(filter, outputArr).sort(sortAlphaNum));
        } else {
          resolve(outputArr.sort(sortAlphaNum));
        }

        client.on("soapError", function (err: any) {
          reject(err.root.Envelope.Body.Fault);
        });
      });
    });
  }

  /**
   * Gets the tags required for a specific AXL operation
   * @param {string} operation - The AXL operation name
   * @returns {Promise<any>} - Object containing the required tags
   * @memberof axlService
   */
  getOperationTags(operation: string): Promise<any> {
    const options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      WSDL.open(path.join(__dirname, `../schema/${options.version}/AXLAPI.wsdl`), wsdlOptions, function (err: any, wsdl: any) {
        if (err) {
          reject(err);
          return;
        }
        const operationDef = wsdl.definitions.bindings.AXLAPIBinding.operations[operation];
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
        
        resolve(envelopeBody);
      });
    });
  }

  /**
   * Executes an AXL operation against the CUCM
   * @param {string} operation - The AXL operation to execute
   * @param {any} tags - The tags required for the operation
   * @param {OperationOptions} [opts] - Optional parameters for customizing the operation
   * @returns {Promise<any>} - Result of the operation
   * @memberof axlService
   */
  executeOperation(operation: string, tags: any, opts?: OperationOptions): Promise<any> {
    const options = this._OPTIONS;

    const clean = opts?.clean ?? false;
    const dataContainerIdentifierTails = opts?.dataContainerIdentifierTails ?? "_data";
    const removeAttributes = opts?.removeAttributes ?? false;

    // Let's remove empty top level strings. Also filter out json-variables
    Object.keys(tags).forEach((k) => (tags[k] === "" || k.includes(dataContainerIdentifierTails)) && delete tags[k]);

    return new Promise((resolve, reject) => {
      soap.soap.createClient(options.url, wsdlOptions, function (err: any, client: any) {
        if (err) {
          reject(err);
          return;
        }

        // Get the properly versioned namespace URL
        const namespaceUrl = `http://www.cisco.com/AXL/API/${options.version}`;

        // 1. Set envelope key
        client.wsdl.options = {
          ...client.wsdl.options,
          envelopeKey: "soapenv", // Change default 'soap' to 'soapenv'
        };

        // 2. Define namespaces with the correct version
        client.wsdl.definitions.xmlns.ns = namespaceUrl;

        // Remove ns1 if it exists
        if (client.wsdl.definitions.xmlns.ns1) {
          delete client.wsdl.definitions.xmlns.ns1;
        }

        const customRequestHeader = {
          connection: "keep-alive",
          SOAPAction: `"CUCM:DB ver=${options.version} ${operation}"`,
        };

        client.setSecurity(new soap.soap.BasicAuthSecurity(options.username, options.password));
        client.setEndpoint(options.endpoint);

        client.on("soapError", function (err: any) {
          reject(err.root.Envelope.Body.Fault);
        });

        // Check if the operation function exists
        if (!client.AXLAPIService || !client.AXLAPIService.AXLPort || typeof client.AXLAPIService.AXLPort[operation] !== "function") {
          // For operations that aren't found, try a manual approach
          if (operation.startsWith("apply") || operation.startsWith("reset")) {
            // Determine which parameter to use (name or uuid)
            const operationObj = tags[operation] || tags;

            // Check if uuid or name is provided
            let paramTag, paramValue;

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
                   <${paramTag}>${paramValue}</${paramTag}>
                 </ns:${operation}>
               </soapenv:Body>
             </soapenv:Envelope>`;

            // Use client.request for direct XML request
            (client as any)._request(
              options.endpoint,
              rawXml,
              function (err: any, body: any, response: any) {
                if (err) {
                  reject(err);
                  return;
                }

                // Parse the response
                try {
                  const result = { return: "Success" }; // Default success response
                  resolve(result);
                } catch (parseError) {
                  reject(parseError);
                }
              },
              customRequestHeader
            );

            return;
          } else {
            reject(new Error(`Operation "${operation}" not found`));
            return;
          }
        }

        // Get the operation function - confirmed to exist at this point
        const axlFunc = client.AXLAPIService.AXLPort[operation];

        // Define namespace context with the correct version
        const nsContext = {
          ns: namespaceUrl,
        };

        // Prepare message for specific operations
        let message = tags;

        // Handle operations that start with "apply" or "reset"
        if (operation.startsWith("apply") || operation.startsWith("reset")) {
          const operationKey = operation;

          // If there's a nested structure, flatten it
          if (tags[operationKey]) {
            // Check if uuid or name is provided in the nested structure
            if (tags[operationKey].uuid) {
              message = { uuid: tags[operationKey].uuid };
            } else if (tags[operationKey].name) {
              message = { name: tags[operationKey].name };
            }
            // If neither uuid nor name is provided, try to use any available
            else {
              // Try to use uuid or name from the top level as fallback
              message = tags.uuid ? { uuid: tags.uuid } : { name: tags.name };
            }
          }
        }

        // Execute the operation
        axlFunc(
          message,
          function (err: any, result: any) {
            if (err) {
              reject(err);
              return;
            }
            if (result?.hasOwnProperty("return")) {
              const output = result.return;
              if (clean) {
                cleanObj(output);
              }
              if (removeAttributes) {
                cleanAttributes(output);
              }
              resolve(output);
            } else {
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
 * Cleans an object by removing null, undefined, or empty values
 * @param {any} object - The object to clean
 * @returns {any} - Cleaned object
 */
const cleanObj = (object: any): any => {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      cleanObj(v);
    }
    
    if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
      if (Array.isArray(object)) {
        object.splice(parseInt(k), 1);
      } else {
        delete object[k];
      }
    }
  });
  
  return object;
};

/**
 * Removes attribute fields from an object
 * @param {any} object - The object to clean
 * @returns {any} - Cleaned object
 */
const cleanAttributes = (object: any): any => {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      cleanAttributes(v);
    }
    
    if (v && typeof v === "object" && "attributes" in object) {
      if (Array.isArray(object)) {
        object.splice(parseInt(k), 1);
      } else {
        delete object[k];
      }
    }
  });
  
  return object;
};

export = axlService;