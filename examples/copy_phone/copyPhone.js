const axlService = require("../../index"); // Change this to require("cisco-axl") when using outside this package

/*
Example of how to copy a phone. This is similar to the Super Copy function in CUCM. Just an example of how to do it via AXL.

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
  var opts = {
    clean: true,
    removeAttributes: false,
    dataContainerIdentifierTails: "_data",
  };

  var operation = "getPhone";
  var tags = await service.getOperationTags(operation);
  tags.name = "CSFUSER001";

  var returnPhoneTags = await service.executeOperation(operation, tags, opts);

  operation = "addPhone";
  returnPhoneTags.phone.name = "CSFWORDENJ";
  returnPhoneTags.phone.description = "Test phone added via AXL";
  // Confidential Access Mode	is returned from CUCM via AXL as undefined if not set on the phone we are copying. 
  // We either need to set it to '' or delete it complete. Since we're not using this feature, let's delete it from our JSON.
  delete returnPhoneTags.phone.confidentialAccess;

  await service
    .executeOperation(operation, returnPhoneTags)
    .then((results) => {
      console.log(results);
    })
    .catch((error) => {
      console.log(error);
    });
})();
