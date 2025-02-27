import axlService from '../../src/index';

async function main() {
  try {
    // Initialize AXL service
    const service = new axlService(
      "10.10.20.1",
      "administrator",
      "ciscopsdt",
      "14.0"
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