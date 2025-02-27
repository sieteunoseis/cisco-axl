# Cisco AXL Library Dev Guidelines

## Commands
- Build TypeScript: `npm run build`
- Type Check: `npm run type-check`
- Run TS Example: `npm run ts-example`
- Test: `NODE_OPTIONS=--experimental-vm-modules NODE_NO_WARNINGS=1 NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_ENV=test node ./test/tests.js`
- Test WSDL: `NODE_OPTIONS=--experimental-vm-modules NODE_NO_WARNINGS=1 NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_ENV=staging node ./test/wsdl.js`
- Dev environment: `NODE_OPTIONS=--experimental-vm-modules NODE_NO_WARNINGS=1 NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_ENV=development node ./test/tests.js`

## Code Style
- Use camelCase for variable and function names
- Class names should be PascalCase
- Use meaningful function and variable names
- Include JSDoc style comments for classes and methods
- Use Promises for async operations, with proper error handling via try/catch or .catch()
- Use const for variables that won't be reassigned
- Handle errors with proper rejection in Promises
- Use ES6+ features (arrow functions, template literals, etc.)
- Format JSON output for readability
- Keep methods focused on single responsibility
- Create helper functions for repeated operations