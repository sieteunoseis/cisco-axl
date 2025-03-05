import axlService from '../../src/index';
import { cleanEnv, str, host, makeValidator } from 'envalid';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from the appropriate .env file
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.join(__dirname, '..', '..', 'env', 'development.env') });
} else if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: path.join(__dirname, '..', '..', 'env', 'test.env') });
}

// Validator for CUCM version format
const versionValid = makeValidator(x => {
  if (/.*\..*[^\\]/.test(x)) return x.toUpperCase();
  else throw new Error('CUCM_VERSION must be in the format of ##.#');
});

// Clean and validate environment variables
const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
    default: "development"
  }),
  CUCM_HOSTNAME: host({ 
    desc: "Cisco CUCM Hostname or IP Address.",
    default: "cucm01-pub.automate.builder" 
  }),
  CUCM_USERNAME: str({ 
    desc: "Cisco CUCM AXL Username.",
    default: "perfmon"
  }),
  CUCM_PASSWORD: str({ 
    desc: "Cisco CUCM AXL Password.",
    default: "perfmon"
  }),
  CUCM_VERSION: versionValid({ 
    desc: "Cisco CUCM Version.", 
    example: "12.5",
    default: "15.0"
  })
});

async function main() {
  try {
    // Initialize AXL service using environment variables
    const service = new axlService(
      env.CUCM_HOSTNAME,
      env.CUCM_USERNAME,
      env.CUCM_PASSWORD,
      env.CUCM_VERSION
    );
    
    // Example of adding a route partition
    const operation = "addRoutePartition";
    const tags = {
      routePartition: {
        name: "TYPESCRIPT-PT",
        description: "Created with TypeScript",
        timeScheduleIdName: "",
        useOriginatingDeviceTimeZone: "",
        timeZone: "",
        partitionUsage: "",
      },
    };
    
    console.log("Adding route partition...");
    const result = await service.executeOperation(operation, tags);
    console.log("Route partition added with UUID:", result);
    
    // Example of listing route partitions
    const listOperation = "listRoutePartition";
    const listTags = await service.getOperationTags(listOperation);
    listTags.searchCriteria.name = "%%";
    
    console.log("Listing route partitions...");
    const partitions = await service.executeOperation(listOperation, listTags);
    
    // Display the partitions
    console.log("Route partitions:");
    if (Array.isArray(partitions.routePartition)) {
      partitions.routePartition.forEach((partition: any) => {
        console.log(`- ${partition.name}`);
      });
    } else if (partitions.routePartition) {
      console.log(`- ${partitions.routePartition.name}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();