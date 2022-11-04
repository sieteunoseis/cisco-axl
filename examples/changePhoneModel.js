const axlService = require("../index");

// Set up new AXL service
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

(async () => {
  var method = "getPhone";
  var params = await service.getMethodParams(method);
  console.log(params);
  params.name = "CSFUSER001";

  var returnPhone = await service.executeMethod(method, params, true);
  console.log(JSON.stringify(returnPhone.phone.lines));

  method = "addPhone";
  returnPhone.phone.name = "BOTWORDENJ"; // Update the Phone Name
  returnPhone.phone.description = "Test phone added via AXL"; // Add a description
  returnPhone.phone.product = "Cisco Dual Mode for Android";
  returnPhone.phone.model = "Cisco Dual Mode for Android";
  returnPhone.phone.securityProfileName.value =
    "Cisco Dual Mode for Android - UDP";
  returnPhone.phone.phoneTemplateName.value = "Standard Dual Mode for Android";
  returnPhone.phone.dndOption = "Call Reject";
  returnPhone.phone.lines.line.map((object) => {
    object.maxNumCalls = 2;
    object.busyTrigger = 1;
  });

  delete returnPhone.phone.confidentialAccess; // Either need to set this to '' or delete.
  console.log(returnPhone);

  await service
    .executeMethod(method, returnPhone)
    .then((results) => {
      console.log(results);
    })
    .catch((error) => {
      console.log(error);
    });
})();
