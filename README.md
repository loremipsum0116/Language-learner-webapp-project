# Language Learner Monorepo

A modern monorepo setup for the Language Learner application using pnpm workspaces and Turbo.

## 🏗️ Structure

```
language-learner-web-project/
├── apps/
│   ├── frontend/          # React web application
│   ├── backend/           # Node.js/Express API server
│   └── mobile/            # React Native mobile app
├── packages/
│   └── core/              # Shared utilities and types
├── package.json           # Root package with workspace config
├── pnpm-workspace.yaml    # pnpm workspace configuration
├── turbo.json             # Turbo build configuration
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8+

### Installation

```bash
# Install dependencies for all workspaces
pnpm install

# Install dependencies for specific workspace
pnpm --filter @language-learner/frontend install
```

### Development

```bash
# Start all apps in development mode
pnpm dev

# Start specific app
pnpm --filter @language-learner/frontend dev
pnpm --filter @language-learner/backend dev
pnpm --filter @language-learner/mobile dev
```

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter @language-learner/frontend build
```

### Testing

```bash
# Run tests for all packages
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Database

```bash
# Run database migrations
pnpm db:migrate

# Seed database
pnpm db:seed
```

## 📦 Packages

### Apps

- **@language-learner/frontend**: React web application for language learning
- **@language-learner/backend**: Express.js API server with authentication and content management
- **@language-learner/mobile**: React Native mobile application

### Packages

- **@language-learner/core**: Shared utilities, types, and business logic

## 🛠️ Technology Stack

- **Build System**: Turbo for orchestrated builds
- **Package Manager**: pnpm with workspaces
- **Frontend**: React, React Router, Bootstrap
- **Backend**: Node.js, Express, Prisma, PostgreSQL
- **Mobile**: React Native
- **Testing**: Jest, React Testing Library
- **Code Quality**: ESLint, Prettier, TypeScript

## 📝 Scripts

### Root Level Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps for production |
| `pnpm test` | Run tests for all packages |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Clean build artifacts |

### Workspace-specific Commands

```bash
# Frontend
pnpm --filter @language-learner/frontend dev
pnpm --filter @language-learner/frontend build
pnpm --filter @language-learner/frontend test

# Backend
pnpm --filter @language-learner/backend dev
pnpm --filter @language-learner/backend build
pnpm --filter @language-learner/backend test

# Mobile
pnpm --filter @language-learner/mobile dev
pnpm --filter @language-learner/mobile android
pnpm --filter @language-learner/mobile ios
```

## 🔧 Configuration

### Environment Variables

Each app has its own environment configuration:

- Frontend: `apps/frontend/.env`
- Backend: `apps/backend/.env`
- Mobile: `apps/mobile/.env`

### Turbo Configuration

Build pipeline is configured in `turbo.json` with:
- Dependency-aware task execution
- Intelligent caching
- Parallel execution where possible

## 🤝 Contributing

1. Install dependencies: `pnpm install`
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Run linting: `pnpm lint`
6. Format code: `pnpm format`
7. Commit and push your changes
8. Create a pull request

## 📚 Documentation

- [Turbo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [React Documentation](https://reactjs.org/docs)
- [Express.js Documentation](https://expressjs.com/)
- [React Native Documentation](https://reactnative.dev/docs)