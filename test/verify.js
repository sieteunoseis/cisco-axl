const axlService = require('../dist/index.js');

console.log('Module loaded successfully:', typeof axlService === 'function');
console.log('Module name:', axlService.name);

// Create an instance with dummy values just to verify constructor works
try {
  const service = new axlService('localhost', 'user', 'pass', '15.0');
  console.log('Instance created successfully');
} catch (error) {
  console.error('Error creating instance:', error);
}