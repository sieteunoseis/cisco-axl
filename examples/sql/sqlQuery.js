const axlService = require("../../index"); // Change this to require("cisco-axl") when using outside this package
var fs = require('fs');
var path = require('path');

/*
Example of how to send SQL queries to CUCM via AXL. We can store our queries in ".sql" files, then we can read them in before executing.

Note: axlService is Promised based, so we using a nested promise. We wait for the first promise to be fufilled before calling the nested one.
*/

// Set up new AXL service
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

(async () => {
  // First we'll get the params needed to call executeSQLQuery
  var operation = "executeSQLQuery";
  var tags = await service.getOperationTags(operation);
  console.log(tags);

  // Next we'll read in our SQL file and update tags with the query
  let sql = fs.readFileSync(path.join(__dirname, 'mask.sql'), "utf8");
  tags.sql = sql;
  console.log(tags);

  // Lastly let's execute the query on server
  await service
    .executeOperation(operation, tags)
    .then((results) => {
      console.log(results);
    })
    .catch((error) => {
      console.log(error);
    });
})();