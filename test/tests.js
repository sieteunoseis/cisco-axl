const axlService = require("../index");
const emoji = require("node-emoji");

// Set up new AXL service
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

var check = emoji.get("heavy_check_mark");
var cat = emoji.get("smiley_cat");
var skull = emoji.get("skull");
var sparkles = emoji.get("sparkles");
var spy = emoji.get("sleuth_or_spy");
var next = emoji.get("black_right_pointing_double_triangle_with_vertical_bar");
var list = emoji.get("spiral_note_pad");
var computer = emoji.get("computer");
var finished = emoji.get("raised_hand");

(async () => {
  console.log(`${spy} Let's first get a list of all the operations.`);
  var operationArr = await service.returnOperations();
  console.log(computer, "Found", operationArr.length,"operations.");
  const random = Math.floor(Math.random() * operationArr.length);
  console.log(`${spy} Let's pick out out at random operation: '`,operationArr[random],"'");
  console.log(
    `${next}  Now let's get a list of all the operations that include the word 'partition'.`
  );
  var operationFilteredArr = await service.returnOperations("partition");
  console.log(computer, operationFilteredArr);

  console.log(
    `${cat} Great. Let's add a new route partition via 'addRoutePartition' operation.`
  );

  var operation = "addRoutePartition";

  console.log(
    `${next}  We'll need to get what tags to pass to the SOAP client first.`
  );
  var tags = await service.getOperationTags(operation);
  console.log(computer, tags);
  console.log(
    `${sparkles} Magnificent, let's update the name and description fields.`
  );
  tags.routePartition.name = "INTERNAL-PT";
  tags.routePartition.description = "Internal directory numbers";
  console.log(computer, tags);
  console.log(
    `${next}  Now we will attempt to add the new partition. Function should return an UUID to represent the new partition.`
  );
  await service
    .executeOperation(operation, tags)
    .then(async (results) => {
      console.log(computer, results);
      console.log(
        `${cat} Awesome, let's get a list of all the partitions on our cluster now. First we'll get the tags needed for this call.`
      );

      operation = "listRoutePartition";
      tags = await service.getOperationTags(operation);
      console.log(computer, tags);

      console.log(
        `${spy} We want to list all partitions, so we'll be searching for a wildcard (%%) in the name and description fields.`
      );
      tags.searchCriteria.name = "%%";
      tags.searchCriteria.description = "%%";
      console.log(computer, tags);
      console.log(
        `${sparkles} Astounding, now that we've updated our tags, we'll send the AXL request via SOAP.`
      );

      await service
        .executeOperation(operation, tags)
        .then((results) => {
          console.log(
            `${list}  Here are a list of all the partitions on our cluster:`
          );
          results.routePartition.map((str) => {
            var outString = `${check} ${str.name}`;
            console.log(outString);
          });
        })
        .catch((error) => {
          console.log(skull, error);
        });
    })
    .catch((error) => {
      console.log(skull, "Adding a new partition failed", error);
    });
  console.log(finished, "Test all finished. Thanks!");
})();
