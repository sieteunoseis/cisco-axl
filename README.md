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

### Logging

You can configure logging via the constructor options or the `DEBUG` environment variable.

**Environment variable (simple):**

```env
DEBUG=true
```

**Constructor options (advanced):**

```javascript
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0", {
  logging: {
    level: "info",  // "error" | "warn" | "info" | "debug"
    handler: (level, message, data) => {
      // Custom log handler — send to your logging framework, file, etc.
      myLogger[level](message, data);
    }
  }
});

// Change level at runtime
service.setLogLevel("debug");
```

Log levels: `error` < `warn` < `info` < `debug`. Default level is `error` (or `debug` if `DEBUG` env var is truthy).

## Features

- Uses strong-soap to parse the AXL WSDL file — any AXL function for your specified version is available
- Promise-based API with async/await support
- Returns JSON, with optional cleaning of empty/null fields and attribute removal
- [json-variables](https://codsen.com/os/json-variables) support for template-based operations
- TypeScript support with full type definitions
- ESM and CommonJS dual-package support
- Custom error classes (`AXLAuthError`, `AXLOperationError`, `AXLNotFoundError`, `AXLValidationError`)
- Retry mechanism with exponential backoff for transient network errors
- Batch operations with concurrency control (`executeBatch`)
- Convenience methods for common CRUD operations (`getItem`, `listItems`, `addItem`, `updateItem`, `removeItem`)
- SQL query/update helpers (`executeSqlQuery`, `executeSqlUpdate`)
- Detailed tag metadata including required/nillable/type info (`getOperationTagsDetailed`)
- Configurable logging with levels and custom handlers
- SOAP client caching for improved performance
- Input parameter validation with descriptive error messages
- Authentication testing with the `testAuthentication` method

## Usage

```javascript
const axlService = require("cisco-axl");

let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

// Low-level: executeOperation
var tags = {
  routePartition: {
    name: "INTERNAL-PT",
    description: "Internal directory numbers",
  },
};

service
  .executeOperation("addRoutePartition", tags)
  .then((results) => {
    console.log("addRoutePartition UUID", results);
  })
  .catch((error) => {
    console.log(error);
  });

// Convenience methods (v1.5.0+)
await service.addItem("RoutePartition", { name: "INTERNAL-PT", description: "Internal" });
await service.listItems("RoutePartition");
await service.getItem("RoutePartition", "INTERNAL-PT");
await service.updateItem("RoutePartition", "INTERNAL-PT", { description: "Updated" });
await service.removeItem("RoutePartition", "INTERNAL-PT");

// SQL queries
await service.executeSqlQuery("SELECT name FROM routepartition");

// Batch operations
const results = await service.executeBatch([
  { operation: "getRoutePartition", tags: { name: "INTERNAL-PT" } },
  { operation: "getRoutePartition", tags: { name: "EXTERNAL-PT" } },
], 5); // concurrency limit
```

## Methods

### Core

- `new axlService(host, username, password, version, options?)`
- `service.testAuthentication()`
- `service.returnOperations(filter?)`
- `service.getOperationTags(operation)`
- `service.getOperationTagsDetailed(operation)`
- `service.executeOperation(operation, tags, opts?)`
- `service.executeBatch(operations, concurrency?)`
- `service.setLogLevel(level)`

### Convenience

- `service.getItem(itemType, identifier, opts?)`
- `service.listItems(itemType, searchCriteria?, returnedTags?, opts?)`
- `service.addItem(itemType, data, opts?)`
- `service.updateItem(itemType, identifier, updates, opts?)`
- `service.removeItem(itemType, identifier, opts?)`
- `service.executeSqlQuery(sql)`
- `service.executeSqlUpdate(sql)`

### new axlService(host, username, password, version, options?)

Service constructor. Requires hostname, username, password, and version. Optional configuration for logging and retry behavior.

```node
// Basic usage
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

// With options
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0", {
  logging: { level: "info" },
  retry: { retries: 3, retryDelay: 1000 }  // exponential backoff for transient errors
});
```

Supported versions: `11.0`, `11.5`, `12.0`, `12.5`, `14.0`, `15.0`

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

### service.getOperationTagsDetailed(operation) ⇒ Returns promise

Method requires passing an AXL operation. Returns detailed metadata for each tag including whether it is required, nillable, an array type, and its XSD type. Child elements are returned recursively.

| Method                   | Argument  | Type   | Obligatory | Description                                                              |
| :----------------------- | :-------- | :----- | :--------- | :----------------------------------------------------------------------- |
| getOperationTagsDetailed | operation | string | Yes        | Provide the name of the AXL operation you wish to retrieve the tags for. |

Each tag in the returned object has the following structure:

| Property | Type             | Description                                       |
| :------- | :--------------- | :------------------------------------------------ |
| name     | string           | Tag name                                          |
| required | boolean          | Whether the tag is required (based on minOccurs)  |
| nillable | boolean          | Whether the tag accepts null values               |
| isMany   | boolean          | Whether the tag can appear multiple times (array) |
| type     | string \| null   | XSD type name (e.g. "string", "XRoutePartition")  |
| children | object \| null   | Nested tag metadata, or null for leaf elements    |

Example:

```javascript
service.getOperationTagsDetailed("addRoutePartition").then((tags) => {
  console.log(tags.routePartition.required);         // true
  console.log(tags.routePartition.children.name.nillable); // true
  console.log(tags.routePartition.children.name.type);     // "string"
});
```

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

### service.executeBatch(operations, concurrency?) ⇒ Returns promise

Executes multiple AXL operations in parallel with concurrency control. Returns an array of `BatchResult` objects in the same order as the input.

```javascript
const results = await service.executeBatch([
  { operation: "getPhone", tags: { name: "SEP001122334455" } },
  { operation: "getPhone", tags: { name: "SEP556677889900" } },
  { operation: "getLine", tags: { pattern: "1001", routePartitionName: "INTERNAL-PT" } },
], 3); // max 3 concurrent requests

results.forEach((r) => {
  if (r.success) {
    console.log(`${r.operation}: OK`, r.result);
  } else {
    console.log(`${r.operation}: FAILED`, r.error.message);
  }
});
```

### Convenience Methods

These methods simplify common CRUD operations. The `itemType` parameter is the PascalCase AXL type (e.g. `"Phone"`, `"Line"`, `"RoutePartition"`).

```javascript
// Get a single item by name or UUID
await service.getItem("Phone", "SEP001122334455");
await service.getItem("Phone", { uuid: "abc-123" });

// List items with search criteria
await service.listItems("RoutePartition");  // all partitions
await service.listItems("Phone", { name: "SEP%" });  // filtered

// Add a new item
await service.addItem("RoutePartition", { name: "NEW-PT", description: "New partition" });

// Update an existing item
await service.updateItem("Phone", "SEP001122334455", { description: "Updated" });

// Remove an item
await service.removeItem("RoutePartition", "NEW-PT");

// SQL operations
const rows = await service.executeSqlQuery("SELECT name, description FROM routepartition");
await service.executeSqlUpdate("UPDATE routepartition SET description='test' WHERE name='NEW-PT'");
```

## Error Handling

All errors extend the base `AXLError` class. You can catch specific error types:

```javascript
const { AXLAuthError, AXLNotFoundError, AXLOperationError, AXLValidationError } = require("cisco-axl");

try {
  await service.executeOperation("getPhone", { name: "INVALID" });
} catch (error) {
  if (error instanceof AXLAuthError) {
    console.log("Bad credentials");
  } else if (error instanceof AXLNotFoundError) {
    console.log("Operation not found:", error.operation);
  } else if (error instanceof AXLOperationError) {
    console.log("SOAP fault:", error.message, error.faultCode);
  } else if (error instanceof AXLValidationError) {
    console.log("Invalid input:", error.message);
  }
}
```

## Retry Configuration

Transient network errors (ECONNRESET, ETIMEDOUT, etc.) can be automatically retried with exponential backoff:

```javascript
let service = new axlService("10.10.20.1", "admin", "pass", "14.0", {
  retry: {
    retries: 3,        // max retry attempts (default: 0 = disabled)
    retryDelay: 1000,  // base delay in ms, doubles each attempt (default: 1000)
    retryOn: (error) => {
      // Custom function to determine if error is retryable (optional)
      return error.message.includes("ECONNRESET");
    }
  }
});
```

## ESM Support

This library supports both CommonJS and ES modules:

```javascript
// CommonJS
const axlService = require("cisco-axl");

// ESM
import axlService from "cisco-axl";
import { AXLAuthError, AXLOperationError } from "cisco-axl";
```

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

~~Currently there is an issue with strong-soap regarding returning nillable values for element tags.~~ As of v1.5.0, the `getOperationTagsDetailed()` method works around the strong-soap limitation by accessing raw WSDL element metadata to return `required`, `nillable`, `isMany`, and `type` information for each tag.

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

- Add example for reading in CSV and performing a bulk exercise with variables.
- Add example for saving SQL output to CSV.

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[Buy Me a Coffee](https://www.buymeacoffee.com/automatebldrs)
