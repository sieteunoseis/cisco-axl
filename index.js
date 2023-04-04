const soap = require("strong-soap").soap;
const WSDL = soap.WSDL;
const path = require("path");
const wsdlOptions = {
  attributesKey: "attributes",
  valueKey: "value",
};

/**
 * Cisco axlService Service
 * This is a service class that uses fetch and promises to pull AXL data from Cisco CUCM
 *
 *
 * @class axlService
 */
class axlService {
  constructor(host, username, password, version) {
    this._OPTIONS = {
      username: username,
      password: password,
      url: path.join(__dirname, `/schema/${version}/AXLAPI.wsdl`),
      endpoint: `https://${host}:8443/axl/`,
      version: version,
    };
  }
  returnOperations(filter) {
    var options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      soap.createClient(options.url, wsdlOptions, function (err, client) {
        client.setSecurity(
          new soap.BasicAuthSecurity(options.username, options.password)
        );
        client.setEndpoint(options.endpoint);

        var description = client.describe();

        var outputArr = [];

        for (const [key, value] of Object.entries(
          description.AXLAPIService.AXLPort
        )) {
          outputArr.push(value.name);
        }
        const sortAlphaNum = (a, b) =>
          a.localeCompare(b, "en", { numeric: true });
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
    var options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      WSDL.open(
        path.join(__dirname, `/schema/${options.version}/AXLAPI.wsdl`),
        wsdlOptions,
        function (err, wsdl) {
          if (err) {
            reject(err);
          }
          var operationDef =
            wsdl.definitions.bindings.AXLAPIBinding.operations[operation];
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
        }
      );
    });
  }
  executeOperation(operation, tags, opts) {
    var options = this._OPTIONS;

    var clean = opts?.clean ? opts.clean : false;
    var dataContainerIdentifierTails = opts?.dataContainerIdentifierTails
      ? opts.dataContainerIdentifierTails
      : "_data";
    var removeAttributes = opts?.removeAttributes
      ? opts.removeAttributes
      : false;

    // Let's remove empty top level strings. Also filter out json-variables
    Object.keys(tags).forEach(
      (k) =>
        (tags[k] == "" || k.includes(dataContainerIdentifierTails)) &&
        delete tags[k]
    );

    return new Promise((resolve, reject) => {
      soap.createClient(options.url, wsdlOptions, function (err, client) {
        var customRequestHeader = { connection: "keep-alive" };
        if (err) {
          reject(err);
        }
        client.setSecurity(
          new soap.BasicAuthSecurity(options.username, options.password)
        );
        client.setEndpoint(options.endpoint);

        client.on("soapError", function (err) {
          reject(err.root.Envelope.Body.Fault);
        });

        var axlFunc = client.AXLAPIService.AXLPort[operation];

        axlFunc(
          tags,
          function (err, result) {
            if (err) {
              reject(err);
            }
            if (result?.hasOwnProperty("return")) {
              var output = result.return;
              if (clean) {
                cleanObj(output);
              }
              if (removeAttributes) {
                cleanAttributes(output);
              }
              resolve(output);
            } else {
              reject("No return results");
            }
          },
          null,
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
    if (
      (v && typeof v === "object" && !Object.keys(v).length) ||
      v === null ||
      v === undefined
    ) {
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
