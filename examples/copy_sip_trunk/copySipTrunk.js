const axlService = require("../../index"); // Change this to require("cisco-axl") when using outside this package

/*
Example of how to copy a SIP Trunk. Cisco doesn't have a Super Copy option for this, but we can do it via AXL. 
The new SIP trunk will need to have a new IP address for the destination address. 

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
  // First let's get the tags needed for finding a SIP Trunk
  var operation = "getSipTrunk";
  var tags = await service.getOperationTags(operation);

  // Let's update the returned JSON with the name of the trunk we are trying to copy
  tags.name = "SIPTrunktoCUP";

  // Make a call to AXL to get the information for the trunk we are copying.
  // Note: we will be sending the clean flag to executeOperation. This will remove any keys in our return json that is empty, undefined or null.
  var opts = {
    clean: true,
    removeAttributes: false,
    dataContainerIdentifierTails: "_data",
  };

  var returnTrunk = await service.executeOperation(operation, tags, opts);

  // Update the JSON with our new values
  operation = "addSipTrunk";
  returnTrunk.sipTrunk.name = "SIPTrunktoCUP2";
  returnTrunk.sipTrunk.description = "NEW SIP Trunk";
  returnTrunk.sipTrunk.destinations.destination[0].addressIpv4 = '10.10.20.18';
  returnTrunk.sipTrunk.destinations.destination[0].port = '5060';

  // Confidential Access Mode	is returned from CUCM via AXL as undefined if not set on the phone we are copying. 
  // We either need to set it to '' or delete it complete. Since we're not using this feature, let's delete it from our JSON.
  delete returnTrunk.sipTrunk.confidentialAccess;

  await service
    .executeOperation(operation, returnTrunk)
    .then((results) => {
      console.log("addSipTrunk UUID", results);
    })
    .catch((error) => {
      console.log(error);
    });
})();

