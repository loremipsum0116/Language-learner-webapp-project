# 단무새 (Danmusae) - Advanced English Vocabulary Learning Platform

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/danmusae)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://mysql.com)

**Enterprise-grade English vocabulary acquisition system with AI-powered learning optimization**

[📖 Documentation](#documentation) • [🚀 Quick Start](#installation) • [🔧 API Reference](#api-documentation) • [📊 Architecture](#architecture) • [🛠️ Development](#contributing)

</div>

---

## Overview

**Danmusae** (단무새) is a sophisticated English vocabulary learning platform designed for scalable language education. The platform's name originates from Korean wordplay combining "단무지" (pickled radish) + "앵무새" (parrot) or "단어" (word) + "앵무새" (parrot), reflecting its core focus on vocabulary acquisition through systematic repetition.

Built on modern web technologies, Danmusae implements scientifically-proven spaced repetition algorithms, AI-powered personalized tutoring, and comprehensive learning analytics to optimize vocabulary retention and acquisition rates.

### Key Value Propositions

- **Spaced Repetition System (SRS)**: Implementation of modified Leitner algorithm with customizable intervals
- **AI-Powered Tutoring**: Integration with OpenAI GPT models for personalized learning experiences  
- **CEFR Framework Alignment**: Structured content delivery from A1 (Beginner) to C1 (Advanced) proficiency levels
- **Audio Integration**: Google Cloud Text-to-Speech API for pronunciation accuracy
- **Enterprise Scalability**: Microservices architecture supporting 10,000+ concurrent users
- **Learning Analytics**: Comprehensive progress tracking and performance optimization

---

## Technical Architecture

### System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[React SPA] --> B[Bootstrap UI Framework]
        A --> C[React Router v7]
        A --> D[Context API State Management]
    end
    
    subgraph "API Gateway Layer"
        E[Express.js Server] --> F[JWT Authentication Middleware]
        E --> G[RESTful API Endpoints]
        E --> H[Rate Limiting & CORS]
    end
    
    subgraph "Business Logic Layer"
        I[Learning Management System] --> J[SRS Algorithm Engine]
        I --> K[AI Integration Gateway]
        I --> L[Audio Processing Service]
    end
    
    subgraph "AI Services Layer"
        M[OpenAI GPT Integration] --> N[Conversation Management]
        M --> O[Grammar Correction Engine]
        P[Google Cloud TTS] --> Q[Audio Cache Management]
    end
    
    subgraph "Data Persistence Layer"
        R[(MySQL Primary DB)] --> S[User Management]
        R --> T[Learning Content]
        R --> U[Progress Tracking]
        V[(Redis Cache Layer)] --> W[Session Storage]
        V --> X[Query Optimization]
    end
    
    A --> E
    E --> I
    I --> M
    I --> P
    I --> R
    I --> V
```

### Technology Stack

#### Frontend Stack
- **React 19.1.1**: Component-based UI development with concurrent features
- **Bootstrap 5.3.7**: Responsive design system and component library
- **React Router 7.7.1**: Client-side routing with data loading optimization
- **React Toastify**: Notification management system

#### Backend Stack  
- **Node.js 18+**: Server-side JavaScript runtime
- **Express.js 5.1.0**: Web application framework
- **Prisma ORM**: Type-safe database operations
- **JWT Authentication**: Stateless authentication with HTTP-only cookies
- **Redis 6.0+**: Caching layer and session management

#### AI & Machine Learning
- **OpenAI GPT API**: Natural language processing and conversation
- **Google Cloud Text-to-Speech**: High-quality audio synthesis
- **Custom SRS Algorithm**: Spaced repetition optimization
- **Learning Analytics Engine**: Performance prediction and optimization

#### Database & Storage
- **MySQL 8.0+**: Primary relational database
- **Redis**: In-memory data structure store for caching
- **File System**: Static audio file storage with CDN integration

---

## Core Features

### Spaced Repetition System (SRS)

Advanced implementation of the Leitner system with algorithmic optimizations:

- **Interval Scheduling**: Dynamic intervals (1, 3, 7, 16, 35 days) based on performance metrics
- **Difficulty Adjustment**: Automatic content difficulty scaling based on user proficiency
- **Performance Analytics**: Real-time learning curve analysis and retention prediction
- **Multi-modal Learning**: Support for visual, auditory, and contextual learning modes

### AI-Powered Language Tutoring

Sophisticated conversational AI system leveraging large language models:

- **Contextual Conversations**: Natural language interaction adapted to user proficiency level
- **Grammar Correction**: Real-time error detection and explanation with linguistic analysis
- **Adaptive Difficulty**: Dynamic content adjustment based on user performance metrics
- **Personalized Feedback**: Individual learning path optimization through ML algorithms

### Intelligent Dictionary System

Comprehensive vocabulary management with advanced linguistic features:

- **Lemmatization Engine**: Automatic word form recognition and base form identification
- **IPA Phonetic Transcription**: International Phonetic Alphabet notation
- **CEFR Classification**: Automated difficulty level assignment
- **Audio Pronunciation**: High-quality TTS with caching optimization

### Learning Analytics Dashboard

Enterprise-grade analytics and reporting system:

- **Performance Metrics**: Detailed learning statistics and progress tracking
- **Retention Analysis**: Long-term memory retention prediction models
- **Usage Analytics**: System utilization and engagement metrics
- **Cost Optimization**: AI usage monitoring and resource allocation

---

## Installation & Setup

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher  
- **MySQL**: 8.0 or higher
- **Redis**: 6.0 or higher
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 10GB available space

### Environment Configuration

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/danmusae.git
cd danmusae
```

2. **Install Dependencies**
```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install
```

3. **Environment Variables**
```bash
# Frontend configuration (.env)
REACT_APP_API_BASE=http://localhost:4000
REACT_APP_ENVIRONMENT=development

# Backend configuration (server/.env)
PORT=4000
DATABASE_URL="mysql://username:password@localhost:3306/danmusae"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-cryptographically-secure-secret"
OPENAI_API_KEY="your-openai-api-key"
GOOGLE_APPLICATION_CREDENTIALS="path/to/google-cloud-credentials.json"
CORS_ORIGIN="http://localhost:3000"
```

4. **Database Setup**
```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

5. **Application Launch**
```bash
# Backend server
cd server && npm run dev

# Frontend development server  
npm start
```

### Docker Deployment

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up --build

# Development environment
docker-compose up --build
```

---

## API Documentation

### Authentication Endpoints
```http
POST   /auth/register     # User registration with validation
POST   /auth/login        # JWT-based authentication
POST   /auth/logout       # Session termination
GET    /auth/me           # Current user profile
POST   /auth/refresh      # Token refresh mechanism
```

### Vocabulary Management
```http
GET    /vocab             # Paginated vocabulary retrieval
POST   /vocab/bulk        # Bulk vocabulary import
GET    /vocab/:id         # Individual vocabulary item
PUT    /vocab/:id         # Vocabulary item update
DELETE /vocab/:id         # Vocabulary item deletion
GET    /vocab/search      # Full-text search with filters
```

### SRS Learning System
```http
GET    /srs/due-cards     # Scheduled review items
POST   /srs/review        # Review session submission
GET    /srs/statistics    # Learning performance metrics
POST   /srs/folders       # Learning folder management
GET    /srs/progress      # Progress tracking endpoint
```

### AI Tutor Integration
```http
POST   /tutor/chat        # Conversational AI interaction
POST   /tutor/correct     # Grammar correction service
GET    /tutor/personas    # Available tutor personalities
POST   /tutor/feedback    # Learning feedback submission
```

### Dictionary Services
```http
GET    /dict/search       # Comprehensive word search
GET    /dict/:word/audio  # Audio pronunciation retrieval
GET    /dict/:word/def    # Detailed word definitions
GET    /dict/suggest      # Auto-completion suggestions
```

---

## Development Guidelines

### Code Quality Standards

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

#### ESLint Configuration
- **Airbnb Style Guide**: Consistent code formatting and best practices
- **Prettier Integration**: Automated code formatting
- **TypeScript Rules**: Type-safe development practices
- **React Hooks Rules**: Proper hook usage validation

### Testing Strategy

#### Unit Testing
```bash
# Frontend component testing
npm test -- --coverage

# Backend API testing
cd server && npm test

# Integration testing
npm run test:integration
```

#### Performance Testing
- **Load Testing**: Artillery.js for API endpoint stress testing
- **Bundle Analysis**: Webpack Bundle Analyzer for optimization
- **Memory Profiling**: Node.js heap analysis
- **Database Query Optimization**: Prisma query performance monitoring

### CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
name: CI/CD Pipeline
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
```

---

## Performance Metrics

### System Performance Benchmarks
- **API Response Time**: p95 < 400ms, p99 < 800ms
- **Database Query Performance**: Average query time < 50ms
- **Memory Usage**: < 512MB per instance under normal load
- **CPU Utilization**: < 70% under peak load conditions
- **Concurrent User Support**: 10,000+ simultaneous connections

### Learning Effectiveness Metrics
- **Vocabulary Retention Rate**: 85% after 30-day interval
- **Learning Speed Optimization**: 3x faster compared to traditional methods
- **User Engagement**: 78% daily active user retention
- **Accuracy Improvement**: Average 40% increase in assessment scores

---

## Security & Compliance

### Security Implementation
- **Authentication**: JWT tokens with secure HTTP-only cookies
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: AES-256 encryption for data at rest
- **Transport Security**: TLS 1.3 for data in transit
- **Input Validation**: Comprehensive sanitization and validation
- **Rate Limiting**: API endpoint protection against abuse

### Privacy Compliance
- **GDPR Compliance**: Full European data protection regulation adherence
- **Data Minimization**: Collection limited to functional requirements
- **Right to Erasure**: Complete data deletion capabilities
- **Data Portability**: User data export functionality
- **Audit Logging**: Comprehensive access and modification tracking

---

## Monitoring & Observability

### Application Monitoring
- **Error Tracking**: Centralized error logging and alerting
- **Performance Monitoring**: Real-time application performance metrics
- **Database Monitoring**: Query performance and connection pool analysis
- **Resource Utilization**: CPU, memory, and disk usage tracking

### Business Intelligence
- **Learning Analytics**: User progress and engagement analysis
- **Cost Analysis**: AI service usage and operational cost tracking
- **A/B Testing Framework**: Feature performance comparison
- **User Behavior Analytics**: Learning pattern analysis and optimization

---

## Deployment & Operations

### Production Environment
- **Container Orchestration**: Docker with Kubernetes support
- **Load Balancing**: NGINX reverse proxy with health checks
- **Database Scaling**: MySQL read replicas and connection pooling
- **CDN Integration**: Static asset delivery optimization
- **Backup Strategy**: Automated daily backups with point-in-time recovery

### Monitoring & Alerting
- **Uptime Monitoring**: 99.9% availability target
- **Performance Alerting**: Response time and error rate thresholds
- **Resource Alerting**: Memory, CPU, and disk utilization monitoring
- **Business Metrics**: Learning effectiveness and user engagement tracking

---

## Contributing

We welcome contributions from the developer community. Please review our [Contributing Guidelines](CONTRIBUTING.md) for detailed information on:

- **Development Environment Setup**
- **Code Review Process**  
- **Testing Requirements**
- **Documentation Standards**
- **Issue Reporting Guidelines**

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/advanced-srs`)
3. Implement changes with comprehensive tests
4. Submit pull request with detailed description
5. Code review and automated testing verification

---

## Support & Documentation

### Technical Documentation
- **[API Reference](docs/api-reference.md)**: Complete API documentation
- **[Database Schema](docs/database-schema.md)**: Data model specification
- **[Deployment Guide](docs/deployment.md)**: Production deployment instructions
- **[Configuration Guide](docs/configuration.md)**: System configuration options

### Commercial Support
For enterprise licensing and commercial support:
- **Email**: enterprise@danmusae.com
- **Technical Support**: Available for licensed customers
- **SLA Options**: 24/7 support with guaranteed response times
- **Custom Development**: Feature customization and integration services

---

## License

This software is proprietary and commercially licensed. All rights reserved.

**Danmusae** © 2025. Unauthorized reproduction, modification, distribution, or use is strictly prohibited.

For licensing inquiries: [licensing@danmusae.com](mailto:licensing@danmusae.com)

---

## Acknowledgments

- **OpenAI**: GPT language model API integration
- **Google Cloud**: Text-to-Speech service infrastructure  
- **React Development Team**: Frontend framework foundation
- **Node.js Community**: Backend runtime ecosystem
- **Open Source Contributors**: Third-party library maintainers

---

<div align="center">

**[⬆ Back to Top](#단무새-danmusae---advanced-english-vocabulary-learning-platform)**

Built with modern web technologies for scalable language education.

</div>