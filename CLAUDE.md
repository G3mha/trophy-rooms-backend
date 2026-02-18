# Trophy Rooms Backend - Development Guidelines

## Required Workflow

**IMPORTANT: Always follow this workflow after making code changes.**

### 1. Build

Before committing, always run the build:

```bash
npm run build
```

Fix any TypeScript errors or build failures before proceeding.

### 2. Commit Strategy

Always maximize the number of commits using stacked diffs style:

- Make small, atomic commits - one logical change per commit
- Each commit should be independently meaningful, reviewable, and testable
- Break large features into multiple smaller commits
- Use clear, concise commit messages following conventional commits:
  - `feat:` - new features
  - `fix:` - bug fixes
  - `refactor:` - code restructuring
  - `chore:` - maintenance tasks
  - `docs:` - documentation
- Never combine unrelated changes into a single commit
- Analyze changes and split into logical units

### 3. Push

Always push changes after committing:

```bash
git push origin main
```

## Pre-commit Checklist

- [ ] `npm run build` passes
- [ ] Changes are split into atomic commits
- [ ] Commit messages are clear and follow conventions
- [ ] Changes are pushed to remote
