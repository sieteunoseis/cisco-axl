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
  params.name = "BOTUSER011";

  var returnPhone = await service.executeMethod(method, params, true);

  method = "addPhone";
  returnPhone.phone.name = "CSFWORDENJ";
  returnPhone.phone.description = "Test phone added via AXL";
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
