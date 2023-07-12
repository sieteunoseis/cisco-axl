const axlService = require("../index");
const emoji = require("node-emoji");
const { cleanEnv, str, host, makeValidator } = require("envalid");
var path = require('path');

// If not production load the local env file
if(process.env.NODE_ENV === "development"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'development.env') })
}else if(process.env.NODE_ENV === "test"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'test.env') })
}else if(process.env.NODE_ENV === "staging"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'staging.env') })
}

const versionValid = makeValidator(x => {
  if (/.*\..*[^\\]/.test(x)) return x.toUpperCase()
  else throw new Error('CUCM_VERSION must be in the format of ##.#')
})

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  CUCM_VERSION: versionValid({ desc: "Cisco CUCM Version." , example: "12.5" })
});

// Set up new AXL service
let service = new axlService(
  env.CUCM_HOSTNAME,
  env.CUCM_USERNAME,
  env.CUCM_PASSWORD,
  env.CUCM_VERSION
);

var check = emoji.get("heavy_check_mark");
var cat = emoji.get("smiley_cat");
var skull = emoji.get("skull");
var sparkles = emoji.get("sparkles");
var spy = emoji.get("female_detective");
var next = emoji.get("next_track_button");
var list = emoji.get("spiral_notepad");
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
  tags.routePartition.name = "TEST-PARTITION-PT";
  tags.routePartition.description = "Partition for testing purposes. Created by AXL.";
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


  var operation = "removeRoutePartition";
  console.log(
    `${skull}  Now let's remove the partition we just created. We'll need to get what tags to pass to the SOAP client first.`
  );
  var tags = await service.getOperationTags(operation);
  console.log(computer, tags);
  console.log(
    `${sparkles} Magnificent, let's update the name of the partition we wanted to remove.`
  );
  tags.name = "TEST-PARTITION-PT";
  console.log(computer, tags);
  console.log(
    `${next}  Now we will attempt to delete the partition. Function should return an UUID.`
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
            `${list}  Here are an updated list of all the partitions on our cluster (Notice our partition we created in an earlier step is missing):`
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
      console.log(skull, "Deleteing partition failed", error);
    });

  console.log(finished, "Test all finished. Thanks!");
})();
