# @language-learner/core

Core domain logic and business rules for the Language Learner application.

## Overview

This package contains the pure business logic, domain entities, validation rules, and algorithms that are independent of external frameworks and infrastructure. It follows Clean Architecture principles with clear separation of concerns.

## Architecture

```
src/
├── shared/           # Shared utilities, types, and validators
│   ├── types/       # TypeScript type definitions
│   ├── validators/  # Zod validation schemas
│   └── utils/       # Utility functions
├── domain/          # Core business logic (framework-independent)
│   ├── entities/    # Domain entities
│   ├── services/    # Domain services (SRS algorithm, etc.)
│   └── repositories/ # Repository interfaces
├── application/     # Use cases and application services
│   └── usecases/    # Application use cases
└── infrastructure/ # Infrastructure abstractions
    ├── config/     # Configuration and DI
    └── repositories/ # Repository implementations
```

## Key Features

### 📝 Validation System  
- Comprehensive Zod-based validation schemas
- Type-safe validation with detailed error messages
- Sanitization and security helpers
- Custom validation rules for domain logic

### 🏗️ Clean Architecture
- Framework-independent domain logic
- Dependency inversion with interfaces
- Testable and maintainable code structure
- Clear separation of concerns

### 🔧 Type Safety
- Complete TypeScript coverage
- Shared type definitions across the application
- Type guards and utility types
- Compile-time safety guarantees

## Usage

```typescript
import { 
  validateUser,
  User,
  Vocab,
  ApiResponse 
} from '@language-learner/core';

// Validate user input
const userValidation = validateUser(userData);
if (!userValidation.success) {
  console.error('Validation failed:', userValidation.errors);
}

// Type-safe vocabulary handling
const vocab: Vocab = {
  id: 1,
  lemma: "hello",
  pos: "INTERJECTION",
  levelCEFR: "A1",
  // ... other properties
};
```

## Development

### Build
```bash
npm run build
```

### Test
```bash
npm test
npm run test:coverage
```

### Development Mode
```bash
npm run build:watch
```

## Dependencies

### Runtime Dependencies
- **zod**: Schema validation
- **dayjs**: Date manipulation
- **lodash**: Utility functions

### Development Dependencies
- **TypeScript**: Type checking and compilation
- **Jest**: Testing framework
- **ts-jest**: TypeScript Jest transformer

## Integration

This core package is designed to be consumed by:
- Express.js API server
- React Native mobile app
- Future web applications
- Background job processors

The clean separation ensures business logic can be reused across all platforms while maintaining consistency and reliability.

## Testing Strategy

- **Unit Tests**: All validation logic and utility functions
- **Integration Tests**: Cross-package compatibility testing  
- **Type Safety Tests**: TypeScript compilation and inference testing
- **Coverage Target**: 90%+ for validation and type safety

## Contributing

When adding new features to the core package:

1. Follow Clean Architecture principles
2. Add comprehensive type definitions
3. Include validation schemas where appropriate
4. Write unit tests for all business logic
5. Update this README with new features

## License

MIT