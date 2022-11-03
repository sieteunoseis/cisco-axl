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
  console.log(`${spy} Let's first get a list of all the methods.`);
  var methodArr = await service.returnMethods();
  console.log(computer,methodArr);
  console.log(
    `${next}  Now let's get a list of all the methods that include the word 'partition'.`
  );
  var methodFilterArr = await service.returnMethods("partition");
  console.log(computer,methodFilterArr);

  console.log(
    `${cat} Great. Let's add a new route partition via 'addRoutePartition'.`
  );

  var method = "addRoutePartition";

  console.log(
    `${next}  We'll need to get what params to pass to the SOAP client first.`
  );
  var params = await service.getMethodParams(method);
  console.log(computer,params);
  console.log(`${sparkles} Awesome, let's update the name and description fields.`);
  params.routePartition.name = "INTERNAL-PT";
  params.routePartition.description = "Internal directory numbers";
  console.log(computer,params);
  console.log(
    `${next}  Now we will attempt to add the new partition. Function should return an UUID to represent the new partition.`
  );
  await service
    .executeMethod(method, params)
    .then(async (results) => {
      console.log(computer,results);
      console.log(
        `${cat} Great let's get a list of all the partitions on our cluster now. First we'll get the params needed for this call.`
      );

      method = "listRoutePartition";
      params = await service.getMethodParams(method);
      console.log(computer,params);

      console.log(
        `${spy} We want to list all partitions, so we'll be searching for a wildcard (%%) in the name and description fields.`
      );
      params.searchCriteria.name = "%%";
      params.searchCriteria.description = "%%";
      console.log(computer,params);
      console.log(
        `${sparkles} Great, now that we've updated our params, we'll send the AXL request via SOAP.`
      );

      await service
        .executeMethod(method, params)
        .then((results) => {
          console.log(`${list}  Here are a list of all the partitions on our cluster:`);
          results.routePartition.map((str) => {
            var outString = `${check} ${str.name}`;
            console.log(outString);
          });
        })
        .catch((error) => {
          console.log(skull,error);
        });
    })
    .catch((error) => {
      console.log(skull,"Adding a new partition failed", error);
    });
  console.log(finished,"Test all finished. Thanks!");
})();
