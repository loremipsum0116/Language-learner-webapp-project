// Port allocation utility for contract tests
const net = require('net');

// Start from a higher port range to avoid common conflicts
// Use a wider range and add process PID for better isolation
let currentPort = 9000 + (process.pid % 1000);
const usedPorts = new Set();

/**
 * Find an available port starting from a given port number
 * @param {number} startPort - Starting port to check
 * @returns {Promise<number>} Available port number
 */
const findAvailablePort = (startPort = currentPort) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
    
    server.on('error', (err) => {
      // Port is busy, try the next one
      if (startPort > 65000) {
        reject(new Error('No available ports found'));
        return;
      }
      findAvailablePort(startPort + 1)
        .then(resolve)
        .catch(reject);
    });
  });
};

/**
 * Get the next available port for Pact tests
 * Increments the port counter to avoid conflicts
 * @returns {Promise<number>} Next available port
 */
const getNextAvailablePort = async () => {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    // Add bigger random offset to avoid predictable conflicts
    currentPort += Math.floor(Math.random() * 50) + 10;
    
    if (usedPorts.has(currentPort)) {
      currentPort += 1;
      attempts++;
      continue;
    }
    
    try {
      const port = await findAvailablePort(currentPort);
      usedPorts.add(port);
      currentPort = port + 10; // Bigger gap between ports
      
      // Clean up old used ports occasionally
      if (usedPorts.size > 50) {
        usedPorts.clear();
      }
      
      return port;
    } catch (error) {
      currentPort += Math.floor(Math.random() * 20) + 5;
      attempts++;
    }
  }
  
  throw new Error(`Could not find available port after ${maxAttempts} attempts`);
};

/**
 * Reset port counter (useful for test isolation)
 */
const resetPortCounter = () => {
  currentPort = 8000;
};

module.exports = {
  findAvailablePort,
  getNextAvailablePort,
  resetPortCounter
};