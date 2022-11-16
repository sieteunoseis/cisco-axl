const axlService = require("../../../index");
const path = require("path");
const fs = require("fs");

/*
This script using json-variables (https://codsen.com/os/json-variables) to add a new phone from a template. 
The AXL "addPhone" operation will either add an existing line or add a new one.
We will be using the "updateLine" to follow behind and update a few of the fields that "addPhone" does not include.

Note: axlService is Promised based, so we using a nested promise. We wait for the "addPhone" promise to be fufilled before calling "updateLine".
*/

// Set up new AXL service (DevNet sandbox credentials: https://devnetsandbox.cisco.com/)
let service = new axlService(
  "cucm01-pub.automate.builders",
  "administrator",
  "h0mel@b",
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
