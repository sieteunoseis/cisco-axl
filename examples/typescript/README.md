# TypeScript Example

This example demonstrates how to use the cisco-axl library with TypeScript.

## Prerequisites

- Node.js v16.15.0 or later
- TypeScript installed globally: `npm install -g typescript`

## Running the Example

1. Build the project first:
   ```
   npm run build
   ```

2. Update the example.ts file with your CUCM server details:
   ```typescript
   const service = new axlService(
     "your-cucm-hostname",
     "username",
     "password",
     "14.0" // CUCM version
   );
   ```

3. Run the example:
   ```
   npx ts-node example.ts
   ```

## Features Demonstrated

- TypeScript type definitions
- Async/await syntax with proper error handling
- Adding a route partition
- Listing route partitions

## TypeScript Benefits

- Static type checking
- Better IDE autocompletion
- Improved documentation with JSDoc comments
- More maintainable codebase