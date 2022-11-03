# Cisco AXL SOAP Library

Simple library to pull AXL data Cisco CUCM via SOAP. The goal of this project is to make it easier for people to use AXL and to include all functionality of AXL!

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

## Features

* This library uses strong-soap to parse the AXL WSDL file. As a result any AXL function for your specified version is avaliable to use!
* Supports the Promise API
* Returns all results in JSON rather than XML
* Automatically cleans up SQL queries to avoid injection

## Usage

```javascript
const axlService = require("cisco-axl");

let service = new axlService("10.10.20.1", "administrator", "ciscopsdt");

var method = "addRoutePartition";
var params = {
  routePartition: {
    name: 'INTERNAL-PT',
    description: 'Internal directory numbers',
    timeScheduleIdName: '',
    useOriginatingDeviceTimeZone: '',
    timeZone: '',
    partitionUsage: ''
  }
};

service
.executeMethod(method, params)
.then((results) => {
    console.log(`Here are a list of all the partitions on our cluster:`);
    results.routePartition.map((str) => {
        console.log(str.name);
    });
})
.catch((error) => {
    console.log(error);
});
```

## Examples

Check /test/tests.js for more examples.

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)