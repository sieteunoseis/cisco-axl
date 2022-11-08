const axlService = require("../index");

// Set up new AXL service
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

(async () => {
  var operation = "addSipTrunk";
  var tags = await service.getOperationTags(operation);
  console.log(tags);
})();
