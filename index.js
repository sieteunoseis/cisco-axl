var soap = require("strong-soap").soap;
var XMLHandler = soap.XMLHandler;
var xmlHandler = new XMLHandler();
var WSDL = soap.WSDL;

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
      url: `./schema/${version}/AXLAPI.wsdl`,
      endpoint: `https://${host}:8443/axl/`,
      version: version,
    };
  }
  returnMethods(filter) {
    var options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      soap.createClient(options.url, {}, function (err, client) {
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
  getMethodParams(method) {
    var options = this._OPTIONS;
    return new Promise((resolve, reject) => {
      WSDL.open(
        `./schema/${options.version}/AXLAPI.wsdl`,
        {},
        function (err, wsdl) {
          if (err) {
            reject(err);
          }
          var operation =
            wsdl.definitions.bindings.AXLAPIBinding.operations[method];
          var operName = operation.$name;
          var operationDesc = operation.describe(wsdl);
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
  executeMethod(method, params) {
    var options = this._OPTIONS;
    var cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != "")
    );
    return new Promise((resolve, reject) => {
      soap.createClient(options.url, {}, function (err, client) {
        client.setSecurity(
          new soap.BasicAuthSecurity(options.username, options.password)
        );
        client.setEndpoint(options.endpoint);

        client.on("soapError", function (err) {
          reject(err.root.Envelope.Body.Fault);
        });

        var axlFunc = client.AXLAPIService.AXLPort[method];

        axlFunc(
          cleanParams,
          function (
            err,
            result,
            envelope,
            rawResponse,
            soapHeader,
            rawRequest
          ) {
            if (err) {
              reject(err);
            }
            resolve(result.return);
          }
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

module.exports = axlService;
