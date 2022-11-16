const axlService = require("../../../index");
const path = require("path");
const fs = require("fs");

/*

This script will use getPhone to retrieve an existing phone and save as a JSON file. This file can then be edited to use as a template for other operations.

*/

// Set up new AXL service (DevNet sandbox credentials: https://devnetsandbox.cisco.com/)
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

(async () => {
  var operation = "getPhone";
  var tags = await service.getOperationTags(operation);
  tags.name = "SEP112233445566";

  // Options for executeOperation
  var opts = {
    clean: true, // Remove all null and empty tags
    removeAttributes: true // Remove all attributes and uuid's
  };

  var returnPhoneTags = await service
    .executeOperation(operation, tags, opts)
    .catch((error) => {
      console.log(error);
    });

  // Let's add some _data fields that we can use to add variables to our template.
  returnPhoneTags._data = {
    firstName: "Tom",
    lastName: "Smith",
  };

  fs.writeFileSync(
    path.resolve(__dirname, "template.json"),
    JSON.stringify(returnPhoneTags, null, 2),
    (err) => {
      // throws an error, you could also catch it here
      if (err) throw err;
      // success case, the file was saved
      console.log("Template saved!");
    }
  );
})();
