// Create admin user for Railway deployment
const { seedProduction } = require('./seed-production');

seedProduction().catch(console.error);