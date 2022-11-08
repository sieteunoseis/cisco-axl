const { jVar } = require("json-variables");
const axlService = require("../../../index");

/*
Every wanted to change an exsiting phone from one user to another user? This script will help you do that as well as updating all the display,
line text labels, etc for the new user.

This script using json-variables (https://codsen.com/os/json-variables) to update a phone from a template.

We will be updating a phone from an existing user to a new user. This is a common MACD change for help desks.
 - First we will use the "getUser" operation to return some values for the user we will be using to replace the existing user.
 - Next we will take those values and update some of templates values.
 - Next we will use jVar to merge those values for us so we can send them via AXL.

Note: axlService is Promised based, so we using a nested promise. We wait for the first promise to be fufilled before calling the nested one.
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

// Set up the tags for our "getUser" call. We are interested in getting the first and last name to use in our template later.

var deviceToUpdate = {
  deviceName: "CSFUSER005",
  extension: "1005"
};

// User to update phone value to

var getUserJSON = {
  userid: "user03",
  returnedTags: {
    firstName: "",
    lastName: "",
  },
};

(async () => {
  // Call getUser operation and store in the userInfo variable
  var userInfo = await service
    .executeOperation("getUser", getUserJSON)
    .catch((error) => {
      console.log(error);
    });

  // Let's update our variable data with the information that we got back from our AXL call
  phoneTemplate._data.firstName = userInfo.user.firstName;
  phoneTemplate._data.lastName = userInfo.user.lastName;
  phoneTemplate._data.userid = getUserJSON.userid;
  phoneTemplate._data.deviceName = deviceToUpdate.deviceName;
  phoneTemplate._data.extension = deviceToUpdate.extension;
  lineTemplate._data.firstName = userInfo.user.firstName;
  lineTemplate._data.lastName = userInfo.user.lastName;
  lineTemplate._data.extension = deviceToUpdate.extension;

  // Use json-variables to update our values from the template values
  const phoneTags = jVar(phoneTemplate);
  const lineTags = jVar(lineTemplate);

  // Call the first operation: "updatePhone" with the jVar updated json
  service
    .executeOperation("updatePhone", phoneTags)
    .then((results) => {
      // Print out the UUID for the successful "updatePhone" call
      console.log("updatePhone UUID", results);
      // Call the second operation: "updateLine" with the jVar updated json
      service
        .executeOperation("updateLine", lineTags)
        .then((results) => {
          // Print out the UUID for the successful "updateLine" call
          console.log("updateLine UUID", results);
          // Lastly let's update our user with the controlled device and set the primary ex
          var updateUserJSON = {
            userid: getUserJSON.userid,
            associatedDevices: {
              device: [deviceToUpdate.deviceName],
            },
            primaryExtension: { pattern: deviceToUpdate.extension, routePartitionName: '' }
          };
          service
            .executeOperation("updateUser", updateUserJSON)
            .then((results) => {
              // Print out the UUID for the successful "updateUser" call
              console.log("updateUser UUID", results);
            })
            .catch((error) => {
              console.log(error);
            });
        })
        .catch((error) => {
          console.log(error);
        });
    })
    .catch((error) => {
      console.log(error);
    });
})();
