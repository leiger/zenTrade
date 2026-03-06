---
name: Git Commit Standard
description: A rule to ensure all git commits are written in English and follow the Conventional Commits specification.
---

# Git Commit Standard

When creating git commits for this project, you MUST adhere to the following rules:

1. **Use English**: All commit messages must be written in English.
2. **Conventional Commits**: Follow the formal `Conventional Commits` format: `<type>(<scope>): <subject>`

### Types
You must use one of the following commit types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Subject
- Use the imperative, present tense: "change" not "changed" nor "changes"
- Do not capitalize the first letter
- Do not put a dot (.) at the end of the subject line

### Body (Optional)
- Provide a more detailed description of the change if necessary.
- Use the imperative, present tense.
- Wrap it at 72 characters when possible.

### Example
```text
feat(ui): add new dark mode toggle

Implemented a new toggle switch in the sidebar to allow users to switch between light and dark themes. 
Added next-themes to manage system and user preferences.
```
