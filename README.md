# Cisco AXL SOAP Library

A Javascript library to pull AXL data Cisco CUCM via SOAP. The goal of this project is to make it easier for people to use AXL and to include all functionality of AXL. This library utilizes [strong-soap](https://www.npmjs.com/package/strong-soap) to read Cisco's WSDL file. As a result this library can use any function in the schema for the version that you specify.

Administrative XML (AXL) information can be found at:
[Administrative XML (AXL) Reference](https://developer.cisco.com/docs/axl/#!axl-developer-guide).

## Installation

Using npm:

```javascript
npm i -g npm
npm i --save cisco-axl
```

## Requirements

This package uses the built in Fetch API of Node. This feature was first introduced in Node v16.15.0. You may need to enable expermential vm module. Also you can disable warnings with an optional enviromental variable.

Also if you are using self signed certificates on Cisco VOS products you may need to disable TLS verification. This makes TLS, and HTTPS by extension, insecure. The use of this environment variable is strongly discouraged. Please only do this in a lab enviroment.

Suggested enviromental variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Debugging

You can enable debug logging by setting the `DEBUG` environment variable to any truthy value (except 'false', 'no', '0', 'off', or 'n'). When enabled, debug logs will show detailed information about authentication tests and operations being executed.

```env
DEBUG=true
```

Debug logs will be prefixed with `[AXL DEBUG]` and include information such as:
- Authentication test attempts and responses
- Operations being executed
- API responses

This is especially helpful when troubleshooting authentication issues or unexpected API behavior.

## Features

- This library uses strong-soap to parse the AXL WSDL file. As a result any AXL function for your specified version is avaliable to use!
- Supports the Promise API. Can chain procedures together or you could use Promise.all() to run multiple "get" operations at the same time.
- Returns all results in JSON rather than XML. Function has options to remove all blank or empty fields from JSON results via optional clean parameter.
- Support for [json-variables](https://codsen.com/os/json-variables). The executeOperation function will recognize the dataContainerIdentifierTails from json-variables and remove them from your call. This avoids any SOAP fault issues from having extra information in call. See examples folder for use case.
- TypeScript support with type definitions for better developer experience and code reliability
- Authentication testing with the testAuthentication method to verify credentials before executing operations
- Debug logging capabilities to help troubleshoot API interactions by setting the DEBUG environment variable

## Usage

```javascript
const axlService = require("cisco-axl");

let service = new axlService("10.10.20.1", "administrator", "ciscopsdt","14.0");

var operation = "addRoutePartition";
var tags = {
  routePartition: {
    name: "INTERNAL-PT",
    description: "Internal directory numbers",
    timeScheduleIdName: "",
    useOriginatingDeviceTimeZone: "",
    timeZone: "",
    partitionUsage: "",
  },
};

service
  .executeOperation(operation, tags)
  .then((results) => {
    console.log("addRoutePartition UUID", results);
  })
  .catch((error) => {
    console.log(error);
  });
```

## Methods

- new axlService(options: obj)
- axlService.testAuthentication()
- axlService.returnOperations(filter?: string)
- axlService.getOperationTags(operation: string)
- axlService.executeOperation(operation: string,tags: obj, opts?: obj)

### new axlService(options)

Service constructor for methods. Requires a JSON object consisting of hostname, username, password and version.

```node
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");
```

### service.testAuthentication() ⇒ Returns promise

Tests the authentication credentials against the AXL endpoint. Returns a promise that resolves to `true` if authentication is successful, or rejects with an error if authentication fails.

```node
service.testAuthentication()
  .then((success) => {
    console.log('Authentication successful');
  })
  .catch((error) => {
    console.error('Authentication failed:', error.message);
  });
```

### service.returnOperations(filter?) ⇒ Returns promise

Method takes optional argument to filter results. No argument returns all operations. Returns results via Promise.

| Method           | Argument | Type   | Obligatory | Description                         |
| :--------------- | :------- | :----- | :--------- | :---------------------------------- |
| returnOperations | filter   | string | No         | Provide a string to filter results. |

### service.getOperationTags(operation) ⇒ Returns promise

Method requires passing an AXL operation. Returns results via Promise.

| Method           | Argument  | Type   | Obligatory | Description                                                              |
| :--------------- | :-------- | :----- | :--------- | :----------------------------------------------------------------------- |
| getOperationTags | operation | string | Yes        | Provide the name of the AXL operation you wish to retrieve the tags for. |

### service.executeOperation(operation,tags,opts?) ⇒ Returns promise

Method requires passing an AXL operation and JSON object of tags. Returns results via Promise.

Current options include:
| option | type | description |
| :--------------------------- | :------ | :---------------------------------------------------------------------------------- |
| clean | boolean | Default: **false**. Allows method to remove all tags that have no values from return data. |
| removeAttributes | boolean | Default: **false**. Allows method to remove all attributes tags return data. |
| dataContainerIdentifierTails | string | Default: **'\_data'**. executeOperation will automatically remove any tag with the defined string. This is used with json-variables library. |

Example:

```node
var opts = {
  clean: true,
  removeAttributes: false,
  dataContainerIdentifierTails: "_data",
};
```

| Method           | Argument  | Type   | Obligatory | Description                                                |
| :--------------- | :-------- | :----- | :--------- | :--------------------------------------------------------- |
| executeOperation | operation | string | Yes        | Provide the name of the AXL operation you wish to execute. |
| executeOperation | tags      | object | Yes        | Provide a JSON object of the tags for your operation.      |
| executeOperation | opts      | object | No         | Provide a JSON object of options for your operation.       |

## Examples

Check **examples** folder for different ways to use this library. Each folder should have a **README** to explain about each example.

You can also run the **tests.js** against Cisco's DevNet sandbox so see how each various method works.

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/).

## json-variables support

At a tactical level, json-variables program lets you take a plain object (JSON files contents) and add special markers in any value which you can then reference in a different path.

This library will recoginize json-variables **\*\_data** keys in the tags and delete before executing the operation.

Example:

```node
var lineTemplate = {
  pattern: "%%_extension_%%",
  routePartitionName: "",
  alertingName: "%%_firstName_%% %%_lastName_%%",
  asciiAlertingName: "%%_firstName_%% %%_lastName_%%",
  description: "%%_firstName_%% %%_lastName_%%",
  _data: {
    extension: "1001",
    firstName: "Tom",
    lastName: "Smith",
  },
};

const lineTags = jVar(lineTemplate);

service
  .executeOperation("updateLine", lineTags)
  .then((results) => {
    console.log(results);
  })
  .catch((error) => {
    console.log(error);
  });
```

Note: If you need to change the variables key you can so via options in both the json-variables and with executeOperations.

Example:

```node
...
const lineTags = jVar(lineTemplate,{ dataContainerIdentifierTails: "_variables"});

service.executeOperation("updateLine", lineTags,{ dataContainerIdentifierTails: "_variables"})
...
```

## Limitations

Currently there is an issue with strong-soap regarding returning nillable values for element tags. These values show if a particular tags is optional or not. Once resolved a method will be added to return tags nillable status (true or false).

## TypeScript Support

This library includes TypeScript declarations to provide type safety and improved developer experience.

### TypeScript Usage

```typescript
import axlService from 'cisco-axl';

const service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

async function getPartitions() {
  try {
    const operation = "listRoutePartition";
    const tags = await service.getOperationTags(operation);
    tags.searchCriteria.name = "%%";
    
    const result = await service.executeOperation(operation, tags);
    return result.routePartition;
  } catch (error) {
    console.error("Error fetching partitions:", error);
    throw error;
  }
}
```

See the `examples/typescript` directory for more TypeScript examples.

## TODO

- Add more promised based examples, particularly a Promise.All() example.
- Add example for reading in CSV and performing a bulk exercise with variables.
- Add example for saving SQL output to CSV.

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[Buy Me a Coffee](https://www.buymeacoffee.com/automatebldrs)
