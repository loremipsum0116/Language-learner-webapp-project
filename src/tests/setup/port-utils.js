// Port allocation utility for contract tests
const net = require('net');

let currentPort = 4000;

/**
 * Find an available port starting from a given port number
 * @param {number} startPort - Starting port to check
 * @returns {Promise<number>} Available port number
 */
const findAvailablePort = (startPort = currentPort) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
    
    server.on('error', () => {
      // Port is busy, try the next one
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
  currentPort += 1;
  const port = await findAvailablePort(currentPort);
  currentPort = port;
  return port;
};

/**
 * Reset port counter (useful for test isolation)
 */
const resetPortCounter = () => {
  currentPort = 4000;
};

module.exports = {
  findAvailablePort,
  getNextAvailablePort,
  resetPortCounter
};