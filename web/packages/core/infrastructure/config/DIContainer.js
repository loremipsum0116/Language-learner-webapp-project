// packages/core/infrastructure/config/DIContainer.js

/**
 * Dependency Injection Container
 * Manages dependency registration and resolution for clean architecture
 */
class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a service with its factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function to create service
   * @param {Object} options - Registration options
   * @param {boolean} [options.singleton=false] - Whether to create as singleton
   * @param {string[]} [options.dependencies=[]] - List of dependency names
   */
  register(name, factory, options = {}) {
    const { singleton = false, dependencies = [] } = options;
    
    this.services.set(name, {
      factory,
      singleton,
      dependencies,
      resolved: false
    });
  }

  /**
   * Register a singleton service
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {string[]} dependencies - Dependency names
   */
  registerSingleton(name, factory, dependencies = []) {
    this.register(name, factory, { singleton: true, dependencies });
  }

  /**
   * Register a transient service (new instance each time)
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {string[]} dependencies - Dependency names
   */
  registerTransient(name, factory, dependencies = []) {
    this.register(name, factory, { singleton: false, dependencies });
  }

  /**
   * Resolve a service by name
   * @param {string} name - Service name
   * @returns {*} Resolved service instance
   */
  resolve(name) {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Return singleton if already created
    if (service.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Resolve dependencies
    const dependencies = service.dependencies.map(dep => this.resolve(dep));
    
    // Create service instance
    const instance = service.factory(...dependencies);
    
    // Store singleton
    if (service.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  isRegistered(name) {
    return this.services.has(name);
  }

  /**
   * Get list of registered service names
   * @returns {string[]}
   */
  getRegisteredServices() {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear() {
    this.services.clear();
    this.singletons.clear();
  }

  /**
   * Create a child container that inherits services
   * @returns {DIContainer}
   */
  createChild() {
    const child = new DIContainer();
    
    // Copy services from parent
    for (const [name, service] of this.services) {
      child.services.set(name, { ...service });
    }
    
    // Copy singletons from parent
    for (const [name, instance] of this.singletons) {
      child.singletons.set(name, instance);
    }
    
    return child;
  }
}

module.exports = DIContainer;