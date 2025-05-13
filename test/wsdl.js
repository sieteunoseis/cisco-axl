var soap = require("strong-soap").soap;
var WSDL = soap.WSDL;

var method = "applyPhone";

const wsdlOptions = {
  attributesKey: 'attributes',
  valueKey: 'value',
  xmlKey: 'xml',
};

WSDL.open(`./schema/15.0/AXLAPI.wsdl`, wsdlOptions, function (err, wsdl) {
  if (err) {
    console.log(err);
  }

  var operation = wsdl.definitions.bindings.AXLAPIBinding.operations[method];
  // console.log("operation", operation);
  var schemas = wsdl.definitions;
  // console.log("schemas", schemas);
  var schema = wsdl.definitions.schemas['http://www.cisco.com/AXL/API/15.0'];
  // console.log("schema", schema);
  var operName = operation.$name;
  // console.log("operName", operName);
  var part = wsdl.definitions.messages.AXLError.parts;
  // var complexType = schema.complexTypes[method];
  var operationDesc = operation.describe(wsdl);
  console.log("operationDesc", operationDesc);
  var requestElements = operationDesc.input.body.elements[0].elements;

  operationDesc.input.body.elements.map((object) => {
    console.log("object", object);
    var operMatch = new RegExp(object.qname.name, "i");
    if (operName.match(operMatch)) {
      nestedObj(object);
    }
  });
});

const nestedObj = (object) => {
  object.elements.map((object) => {
    if (object.qname.name === "name"){
      console.log(object.qname.name);
      console.log(object);
    }
  });
};
