const axlService = require("../../../index"); // Change this to require("cisco-axl") when using outside this package
const { jVar } = require("json-variables");

/*
This script using json-variables (https://codsen.com/os/json-variables) to add a new phone from a template. 
The AXL "addPhone" operation will either add an existing line or add a new one.
We will be using the "updateLine" to follow behind and update a few of the fields that "addPhone" does not include.

Note: axlService is Promised based, so we using a nested promise. We wait for the "addPhone" promise to be fufilled before calling "updateLine".
*/

// Set up new AXL service (DevNet sandbox credentials: https://devnetsandbox.cisco.com/)
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

// Read in the JSON templates
var phoneTemplate = require("./phoneTemplate.json");
var lineTemplate = require("./lineTemplate.json");

(async () => {
  // Use json-variables to update our values from the template values
  const phoneArg = jVar(phoneTemplate);
  const lineArg = jVar(lineTemplate);

  // Call the first operation: "addPhone" with the jVar updated json
  service
    .executeOperation("addPhone", phoneArg)
    .then((results) => {
      // Print out the UUID for the successful "addPhone" call
      console.log("addPhone UUID", results);
      // Call the second operation: "update" with the jVar updated json
      service
        .executeOperation("updateLine", lineArg)
        .then((results) => {
          // Print out the UUID for the successful "updateLine" call
          console.log("updateLine UUID", results);
        })
        .catch((error) => {
          console.log(error);
        });
    })
    .catch((error) => {
      console.log(error);
    });
})();
