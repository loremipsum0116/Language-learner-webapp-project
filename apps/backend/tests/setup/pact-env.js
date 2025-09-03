// server/tests/setup/pact-env.js - Pact environment configuration
process.env.PACT_BROKER_BASE_URL = process.env.PACT_BROKER_BASE_URL || 'http://localhost:9292';
process.env.PACT_BROKER_TOKEN = process.env.PACT_BROKER_TOKEN || '';
process.env.PACT_PROVIDER_VERSION = process.env.PACT_PROVIDER_VERSION || '1.0.0';
process.env.PACT_PROVIDER_BRANCH = process.env.PACT_PROVIDER_BRANCH || 'main';

// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/language_learner_test';

console.log('Pact environment variables configured');