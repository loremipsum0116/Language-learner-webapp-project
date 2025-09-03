// packages/core/infrastructure/config/ContainerSetup.js
const DIContainer = require('./DIContainer');
const { prisma } = require('../../../lib/prismaClient');

// Domain Services
const SrsAlgorithmService = require('../../domain/services/SrsAlgorithmService');

// Application Use Cases
const GetVocabularyListUseCase = require('../../application/usecases/GetVocabularyListUseCase');
const ProcessSrsReviewUseCase = require('../../application/usecases/ProcessSrsReviewUseCase');

// Infrastructure Repositories
const PrismaVocabRepository = require('../repositories/PrismaVocabRepository');
// Note: Other repositories would be imported here as they're implemented

/**
 * Set up the dependency injection container with all services
 * @returns {DIContainer}
 */
function setupContainer() {
  const container = new DIContainer();

  // === Infrastructure Layer ===
  
  // Database client (singleton)
  container.registerSingleton('prismaClient', () => prisma);

  // Repositories (singletons)
  container.registerSingleton(
    'vocabRepository',
    (prismaClient) => new PrismaVocabRepository(prismaClient),
    ['prismaClient']
  );

  // TODO: Add other repositories as they're implemented
  // container.registerSingleton(
  //   'srsCardRepository', 
  //   (prismaClient) => new PrismaSrsCardRepository(prismaClient),
  //   ['prismaClient']
  // );
  // 
  // container.registerSingleton(
  //   'userRepository',
  //   (prismaClient) => new PrismaUserRepository(prismaClient),
  //   ['prismaClient']
  // );

  // === Domain Layer ===
  
  // Domain Services (singletons)
  container.registerSingleton('srsAlgorithmService', () => new SrsAlgorithmService());

  // === Application Layer ===
  
  // Use Cases (transient - new instance for each request)
  container.registerTransient(
    'getVocabularyListUseCase',
    (vocabRepository) => new GetVocabularyListUseCase(vocabRepository),
    ['vocabRepository']
  );

  container.registerTransient(
    'processSrsReviewUseCase',
    (srsCardRepository, vocabRepository, userRepository) => 
      new ProcessSrsReviewUseCase(srsCardRepository, vocabRepository, userRepository),
    ['srsCardRepository', 'vocabRepository', 'userRepository']
  );

  // === External Services ===
  
  // Add external service registrations here (email, storage, etc.)
  // container.registerSingleton('emailService', () => new EmailService(config));
  // container.registerSingleton('storageService', () => new StorageService(config));

  console.log('[DI] Container setup completed with services:', container.getRegisteredServices());
  
  return container;
}

/**
 * Get a pre-configured container instance (singleton)
 */
let containerInstance = null;
function getContainer() {
  if (!containerInstance) {
    containerInstance = setupContainer();
  }
  return containerInstance;
}

/**
 * Reset container (useful for testing)
 */
function resetContainer() {
  containerInstance = null;
}

module.exports = {
  setupContainer,
  getContainer,
  resetContainer
};