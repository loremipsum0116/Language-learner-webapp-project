# Contributing to English Mastery

Thank you for your interest in contributing to **English Mastery**! We welcome contributions from developers, educators, linguists, and language learning enthusiasts.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Coding Guidelines](#coding-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community Guidelines](#community-guidelines)

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

### Our Pledge
- **Be respectful**: Treat all community members with respect and kindness
- **Be inclusive**: Welcome contributors from all backgrounds and experience levels  
- **Be constructive**: Provide helpful feedback and suggestions
- **Be patient**: Help newcomers learn and grow

## 🚀 How to Contribute

### 🐛 Bug Reports
Found a bug? Help us fix it:

1. **Search existing issues** to avoid duplicates
2. **Use the bug report template**
3. **Provide detailed information**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, browser, Node version)
   - Screenshots if applicable

### ✨ Feature Requests
Have an idea for improvement?

1. **Check the roadmap** to see if it's already planned
2. **Use the feature request template**
3. **Describe the problem** your feature would solve
4. **Propose a solution** with implementation details
5. **Consider alternatives** and explain why your approach is best

### 🔧 Code Contributions
Ready to code? Here's how:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** following our coding guidelines
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Submit a pull request**

## 🛠 Development Setup

### Prerequisites
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- MySQL 8.0 or higher
- Redis 6.0 or higher
- Git

### Local Setup

1. **Clone your fork**
```bash
git clone https://github.com/YOUR-USERNAME/english-mastery.git
cd english-mastery
```

2. **Install dependencies**
```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server
npm install
```

3. **Set up environment variables**
```bash
# Copy example files
cp .env.example .env
cp server/.env.example server/.env

# Edit the files with your configuration
```

4. **Set up the database**
```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

5. **Start the development servers**
```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
npm start
```

### Development Tools

We recommend using:
- **VS Code** with the following extensions:
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint
  - GitLens
- **Chrome DevTools** for debugging
- **Postman** for API testing

## 📤 Submitting Changes

### Pull Request Process

1. **Update your fork**
```bash
git remote add upstream https://github.com/original-owner/english-mastery.git
git fetch upstream
git checkout main
git rebase upstream/main
```

2. **Create a descriptive branch name**
```bash
git checkout -b feature/add-vocabulary-import
git checkout -b fix/audio-playback-issue
git checkout -b docs/update-api-reference
```

3. **Make atomic commits**
- One logical change per commit
- Write clear, descriptive commit messages
- Use conventional commit format

4. **Write a clear PR description**
- **What** changes you made
- **Why** you made them
- **How** to test the changes
- **Screenshots** for UI changes

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(vocab): add bulk import functionality
fix(audio): resolve playback issues on Safari
docs(api): update authentication endpoints
test(srs): add unit tests for spaced repetition algorithm
```

### Review Process

1. **Automated checks** must pass:
   - Linting (ESLint)
   - Tests (Jest)
   - Build process
   - Security scans

2. **Code review** by maintainers:
   - Code quality and style
   - Test coverage
   - Documentation updates
   - Breaking changes

3. **Testing** on staging environment

4. **Approval** and merge by maintainers

## 🎯 Coding Guidelines

### JavaScript/React Standards

**Code Style:**
- Use Prettier for formatting
- Follow ESLint rules
- Use meaningful variable names
- Keep functions small and focused
- Use JSDoc for complex functions

**React Best Practices:**
- Use functional components with hooks
- Implement proper error boundaries
- Follow React naming conventions
- Use PropTypes or TypeScript for type checking
- Optimize performance with useMemo/useCallback when needed

**Example:**
```javascript
/**
 * Calculates the next review date for SRS cards
 * @param {Object} card - The vocabulary card
 * @param {number} performance - User performance (1-5)
 * @returns {Date} Next review date
 */
const calculateNextReview = (card, performance) => {
  // Implementation here
};
```

### Backend Standards

**API Design:**
- Follow RESTful conventions
- Use consistent error handling
- Implement proper validation
- Add comprehensive logging
- Include API documentation

**Database:**
- Use Prisma migrations
- Follow naming conventions
- Add proper indexes
- Handle transactions correctly

### CSS/Styling

- Use Bootstrap classes when possible
- Follow BEM methodology for custom CSS
- Use CSS variables for theming
- Ensure responsive design
- Test on multiple browsers

## 🧪 Testing Guidelines

### Testing Requirements
- **Unit tests** for utility functions
- **Integration tests** for API endpoints
- **Component tests** for React components
- **E2E tests** for critical user flows

### Running Tests
```bash
# Frontend tests
npm test

# Backend tests
cd server
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Writing Tests

**Good test example:**
```javascript
describe('SRS Algorithm', () => {
  test('should increase interval after successful review', () => {
    const card = { interval: 1, easeFactor: 2.5 };
    const result = calculateNextInterval(card, 4);
    
    expect(result.interval).toBeGreaterThan(1);
    expect(result.nextReview).toBeInstanceOf(Date);
  });
});
```

## 📚 Documentation

### What to Document
- **API endpoints** with examples
- **Component props** and usage
- **Complex algorithms** with explanations
- **Configuration options**
- **Deployment procedures**

### Documentation Standards
- Use clear, concise language
- Include code examples
- Add screenshots for UI changes
- Keep documentation up-to-date
- Use JSDoc for code documentation

## 👥 Community Guidelines

### Getting Help
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas
- **Discord**: For real-time chat (link in README)
- **Email**: For security issues and private matters

### Recognition
We recognize contributors through:
- **Contributors page** on our website
- **GitHub contributor stats**
- **Special mentions** in release notes
- **Contributor of the month** program

### Maintenance
Current maintainers:
- **@maintainer1** - Project Lead
- **@maintainer2** - Frontend Architecture
- **@maintainer3** - Backend & AI

## 🚀 Release Process

### Versioning
We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Schedule
- **Major releases**: Quarterly
- **Minor releases**: Monthly  
- **Patch releases**: As needed

## 🏆 First-Time Contributors

Welcome! Here are some good ways to get started:

### Good First Issues
Look for issues labeled `good-first-issue`:
- Documentation improvements
- UI/UX enhancements  
- Simple bug fixes
- Test additions

### Mentorship
We provide mentorship for new contributors:
- **Pair programming sessions**
- **Code review guidance**
- **Architecture walkthroughs**
- **Career advice**

## 📞 Questions?

Don't hesitate to ask! We're here to help:
- **GitHub Issues**: Technical questions
- **Discord**: Quick questions and chat
- **Email**: Sensitive matters

Thank you for contributing to English Mastery! Together, we're making language learning more accessible and effective for everyone. 🌟