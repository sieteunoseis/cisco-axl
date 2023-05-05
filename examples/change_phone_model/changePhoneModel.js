const axlService = require("../../index"); // Change this to require("cisco-axl") when using outside this package

/*
Ever wanted to change a phone model, but keep the existing one in CUCM? This script will attempt to migrate a phone to the new model.
It uses SQL queries to grab some of the product specific information for the new model.

We will be using axl to "getPhone" information and then make changes before calling the "addPhone" operation.
 - First we will use the "getPhone" operation to return some values for the phone we will be using to copy.
 - Next we will be using a number of SQL query's to validate settings needed for the new phone model 
 - Lastly we will be combining all this information so we can send them via AXL.

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
  
  // Variable needed for script
  var opts = {
    clean: true,
    removeAttributes: false,
    dataContainerIdentifierTails: "_data",
  };

  // What model are we going to convert our phone into?
  // You can get a list of models in CUCM with the SQL query: 'SELECT name from typemodel'
  var convertPhoneType = "Cisco 8865"; // Another example: Cisco Dual Mode for Android
  var phoneNameCopyingFrom = "CSFUSER001";
  var phoneNameCopyingTo = "SEP112233445566"; // Another example: BOTWORDENJ
  var newPhoneDescription = "Test phone added via AXL";

  // We're going to use the getPhone operation to retrieve the settings from the phone we want to copy. First we'll get the JSON arguments needed for our AXL call.
  var operation = "getPhone";
  var tags = await service.getOperationTags(operation);
  // Print out our operation tags
  console.log(tags);
  // Update the name of phone that we want to copy
  tags.name = phoneNameCopyingFrom;

  // Execute the AXL call. We set the true flag to clean the output (removes any blank or undefined settings)
  var returnPhoneTags = await service.executeOperation(operation, tags, opts);

  // Now we're going to add a new phone based on the settings. We will updating a few new settings based on the model we will be converting to.
  operation = "addPhone";
  returnPhoneTags.phone.name = phoneNameCopyingTo; // New phone name that we will be using
  returnPhoneTags.phone.description = newPhoneDescription; // Add a description
  returnPhoneTags.phone.product = convertPhoneType; // Model product and type
  returnPhoneTags.phone.model = convertPhoneType;

  // Next we'll be pulling some of the supported tags for our new phone type. 
  // This may not be all the settings you have to change when converting to a new model, but are the most common that I've run into.

  // Phone button templates are device and protocol specific. 
  // Let's get a list of the templates configured on our cluster that we can use.

  var phoneTemplateSQL = `SELECT model.name AS device, pt.name AS template, p.buttonnum, tf.name AS feature, dp.name AS protocol
  FROM phonetemplate AS pt, phonebutton AS p, typemodel AS model, typefeature AS tf, typedeviceprotocol AS dp
  WHERE pt.pkid = p.fkphonetemplate AND pt.tkmodel = model.enum AND pt.tkdeviceprotocol = dp.enum AND p.tkfeature = tf.enum
  AND model.name='${convertPhoneType}'`;

  operation = "executeSQLQuery";
  tags = await service.getOperationTags(operation);
  tags.sql = phoneTemplateSQL;
  var phoneTemplate = await service.executeOperation(operation, tags);

  // This is for SIP phones.
  // Let's get a list of Security Profiles configured on our cluster that we can use.

  var securityProfileNameSQL = `SELECT model.name AS device, sp.name AS PROFILE
  FROM securityprofile sp
  LEFT OUTER JOIN typemodel AS model ON sp.tkmodel = model.enum
  WHERE (sp.tksecuritypolicy = 4 OR sp.tksecuritypolicy = 99) AND model.name = '${convertPhoneType}'
  ORDER BY model.name`;

  operation = "executeSQLQuery";
  tags = await service.getOperationTags(operation);
  tags.sql = securityProfileNameSQL;
  var securityProfileName = await service.executeOperation(operation, tags);

  //   DND Option can only be set to non-Zero on devices that support the DND feature (in
  //   ProductSupportsFeature table). For those devices that support the feature, only the Ringer Off (0) is
  //   valid, unless a parameter is present in the PSF record. If a parameter value of 1 exists in PSF table, only
  //   Call Reject is valid. If the param value is (2), all options including Use Common Profile (2) are valid.
  //   Dual mode and remote destination profile only support the Call Reject option.

  var dndOptionSQL = `select model.name,dp.name as protocol,p.param from typemodel as model,
  typedeviceprotocol as dp,ProductSupportsFeature as p where p.tkmodel=model.enum and p.
  tkSupportsFeature=(select enum from typesupportsfeature where name='Do Not Disturb')
  and p.tkdeviceprotocol=dp.enum and model.tkclass=(select enum from typeclass where name=
  'Phone')and model.name='${convertPhoneType}' order by model.name`;

  operation = "executeSQLQuery";
  tags = await service.getOperationTags(operation);
  tags.sql = dndOptionSQL;
  var dndOption = await service.executeOperation(operation, tags);

  // Maximum Number of Calls and Busy Trigger (Less than or equal to Max. Calls) values depend on model type.
  // We'll use an SQL query to figure out what values we need for our model type.
  // 200:4:2 (Max calls per device:default max calls per line:default busy trigger).

  var maxBusySQL = `SELECT NAME,param
  FROM typemodel AS model, productsupportsfeature AS p
  WHERE p.tkmodel = model.enum
  AND p.tksupportsfeature = (SELECT enum FROM typesupportsfeature WHERE NAME = 'Multiple Call Display')
  AND model.tkclass = (SELECT enum FROM typeclass WHERE  NAME = 'Phone') AND name='${convertPhoneType}'`;

  operation = "executeSQLQuery";
  tags = await service.getOperationTags(operation);
  tags.sql = maxBusySQL;
  var maxBusy = await service.executeOperation(operation, tags);

  // Let's update our JSON with the necessary values from above. Note some will return multiple values. You may need to loop thru and find the one you want.

  returnPhoneTags.phone.phoneTemplateName.value = phoneTemplate.row[0].template;
  returnPhoneTags.phone.securityProfileName.value = securityProfileName.row[0].profile;

  // Does this phone support DND? If so does it have a param value of 1
  if(dndOption){
    if(dndOption.row[0].param === '1'){
      returnPhoneTags.phone.dndOption = "Call Reject";
    }else{
      returnPhoneTags.phone.dndOption = "Ringer Off";
    }
  }else{
    delete returnPhoneTags.phone.dndOption;
  }

  // Let's split up our values we got back from CUCM. We'll be setting each line to the default for Max Number of Calls and minus one for our Busy Trigger.
  var maxBusyArr = maxBusy.row[0].param.split(':');

  // Loop thru all lines configured and update as needed.

  returnPhoneTags.phone.lines.line.map((object) => {
    object.maxNumCalls = maxBusyArr[2];
    object.busyTrigger = maxBusyArr[2] - 1;
  });

  // Confidential Access Mode	is returned from CUCM via AXL as undefined if not set on the phone we are copying. 
  // We either need to set it to '' or delete it complete. Since we're not using this feature, let's delete it from our JSON.

  delete returnPhoneTags.phone.confidentialAccess;

  // Print out updated JSON before we execute addPhone on CUCM via AXL

  console.log(returnPhoneTags);

  // Let's add our new phone. If successful we should get back a UUID of our new phone.
  operation = "addPhone";
  await service
    .executeOperation(operation, returnPhoneTags)
    .then((results) => {
      console.log("New UUID",results);
    })
    .catch((error) => {
      console.log(error);
    });
})();
