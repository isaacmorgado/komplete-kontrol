# Skills System - Quick Start Guide

## What is the Skills System?

The Skills System allows you to create reusable AI agent prompts that can be shared across projects and modes. Skills are like specialized "expert modes" for Claude.

## Quick Start

### 1. Create Your First Skill

```bash
# Create a skill directory
mkdir -p ~/.komplete-kontrol/skills/my-skill

# Create the skill file
cat > ~/.komplete-kontrol/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: A helpful description of when to use this skill
---

# My Skill

Instructions for the AI agent on how to use this skill...
EOF
```

### 2. Use Skills in Your App

```javascript
// In the renderer process (DevTools console or component)

// List all available skills
const allSkills = await window.komplete.skills.list();
console.log(allSkills);
// [
//   {
//     name: 'react-debugging',
//     description: 'Expert React debugging...',
//     source: 'global',
//     path: '/Users/.../.komplete-kontrol/skills/react-debugging/SKILL.md'
//   },
//   ...
// ]

// Get a specific skill's content
const skill = await window.komplete.skills.get('react-debugging');
console.log(skill.instructions);
// "You are a React debugging expert. When investigating React issues..."

// List skills for a specific mode
const codeSkills = await window.komplete.skills.list('code');
console.log(codeSkills);
// Only skills available in code mode
```

### 3. Create Mode-Specific Skills

```bash
# Create a skill that only works in "code" mode
mkdir -p ~/.komplete-kontrol/skills-code/typescript-expert

cat > ~/.komplete-kontrol/skills-code/typescript-expert/SKILL.md << 'EOF'
---
name: typescript-expert
description: TypeScript expert for complex type definitions
mode: code
---

# TypeScript Expert

You are a TypeScript expert specializing in:
- Complex type definitions
- Generic types
- Utility types
- Type inference patterns
EOF
```

### 4. Create Project-Specific Skills

```bash
# In your project directory
mkdir -p .komplete-kontrol/skills/project-conventions

cat > .komplete-kontrol/skills/project-conventions/SKILL.md << 'EOF'
---
name: project-conventions
description: Follow our project's coding conventions and patterns
---

# Project Conventions

When working on this project:
- Use functional components with hooks
- Follow the existing file structure
- Write tests for all new features
- Use TypeScript strict mode
EOF
```

## Skill File Format

Every skill must have:
1. A directory named after the skill
2. A `SKILL.md` file with frontmatter

```markdown
---
name: skill-name              # Required (1-64 chars)
description: When to use     # Required (1-1024 chars)
mode: code                   # Optional (mode restriction)
license: MIT                 # Optional (SPDX identifier)
---

# Skill Title (optional)

Instructions for the AI agent...
```

## Naming Rules

- **Length**: 1-64 characters
- **Characters**: lowercase letters, numbers, hyphens only
- **Pattern**: `^[a-z0-9]+(?:-[a-z0-9]+)*$`

Valid examples:
- ✅ `react-debugging`
- ✅ `git-workflow`
- ✅ `typescript-best-practices`
- ✅ `test-helper`

Invalid examples:
- ❌ `React_Debugging` (uppercase)
- ❌ `git workflow` (spaces)
- ❌ `test.helper` (dots)

## Skill Locations

### Priority Order (highest to lowest)

1. **Project skills** - `PROJECT/.komplete-kontrol/skills/`
2. **Global mode-specific** - `~/.komplete-kontrol/skills-MODE/`
3. **Global generic** - `~/.komplete-kontrol/skills/`

### Example Structure

```
~/.komplete-kontrol/
├── skills/                           # Available in all projects
│   ├── react-debugging/
│   │   └── SKILL.md
│   ├── git-workflow/
│   │   └── SKILL.md
│   └── testing/
│       └── SKILL.md
│
├── skills-code/                      # Only in code mode
│   ├── typescript-best-practices/
│   │   └── SKILL.md
│   └── javascript-patterns/
│       └── SKILL.md
│
└── skills-architect/                 # Only in architect mode
    └── system-design/
        └── SKILL.md

my-project/
└── .komplete-kontrol/
    └── skills/                       # Project-specific (highest priority)
        └── project-rules/
            └── SKILL.md
```

## Available Modes

- `architect` - System design and architecture
- `code` - Implementation and coding
- `debug` - Debugging and troubleshooting
- `test` - Testing and quality assurance
- `reverse-engineer` - Code analysis and RE
- `ask` - General questions

## Example Skills

### React Debugging Skill

```markdown
---
name: react-debugging
description: Expert React debugging with DevTools patterns
---

# React Debugging

You are a React debugging expert. Follow these steps:

1. Check React DevTools for component state
2. Verify useEffect dependencies
3. Look for missing keys in lists
4. Check for state mutations
5. Use Error Boundaries for graceful errors
```

### Git Workflow Skill

```markdown
---
name: git-workflow
description: Git best practices and conventional commits
---

# Git Workflow

Follow these practices:

## Commit Format
```
type(scope): description

feat(auth): add OAuth login
fix(api): resolve race condition
docs(readme): update installation
```

## Branch Strategy
- main - production
- develop - integration
- feature/* - new features
- bugfix/* - fixes
```

## Hot-Reload

Skills are automatically watched for changes. Edit a `SKILL.md` file and it will be reloaded immediately.

To manually reload:
```javascript
await window.komplete.skills.reload();
```

## Best Practices

1. **Be specific**: Clearly describe when to use the skill
2. **Provide examples**: Show code patterns and examples
3. **Keep focused**: One skill should do one thing well
4. **Use mode restrictions**: Limit skills to appropriate modes
5. **Version control**: Commit skills to your project repo

## Troubleshooting

### Skill not showing up?

1. **Check the name**: Directory name must match frontmatter `name`
2. **Check permissions**: `ls -la ~/.komplete-kontrol/skills/`
3. **Check format**: Ensure valid frontmatter with required fields
4. **Reload manually**: `await window.komplete.skills.reload()`
5. **Check logs**: Look for errors in DevTools console

### Validation errors?

```bash
# Test skill file format
cat ~/.komplete-kontrol/skills/my-skill/SKILL.md | grep "^name:"
# Should output: name: my-skill
```

## Next Steps

1. **Explore example skills**: Check `~/.komplete-kontrol/skills/`
2. **Create custom skills**: Add skills for your workflows
3. **Share skills**: Copy skills between projects
4. **Contribute**: Share useful skills with the community

## API Reference

### `window.komplete.skills.list(mode?: string)`

List all available skills.

**Parameters:**
- `mode` (optional): Filter by mode ('code', 'debug', etc.)

**Returns:** Array of skill metadata

```typescript
const skills = await window.komplete.skills.list();
// [
//   {
//     name: string,
//     description: string,
//     path: string,
//     source: 'global' | 'project',
//     mode?: string,
//     license?: string,
//     compatibility?: string
//   }
// ]
```

### `window.komplete.skills.get(name: string, mode?: string)`

Get full skill content with instructions.

**Parameters:**
- `name`: Skill name
- `mode` (optional): Mode to get skill from

**Returns:** Skill content or null

```typescript
const skill = await window.komplete.skills.get('react-debugging');
// {
//   name: string,
//   description: string,
//   instructions: string,  // <-- Full markdown content
//   path: string,
//   source: 'global' | 'project',
//   ...
// }
```

### `window.komplete.skills.reload(projectPath?: string)`

Reload skills from disk.

**Parameters:**
- `projectPath` (optional): Project path to reload

**Returns:** void

```typescript
await window.komplete.skills.reload();
```

---

**Need help?** Check the full implementation guide: `SKILLS-SYSTEM-IMPLEMENTATION.md`
