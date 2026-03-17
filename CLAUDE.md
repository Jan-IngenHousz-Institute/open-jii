# Claude Code Rules

# Git Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Refactor code" not "Refactored code")
- Include a brief description of the change (50 characters or less)
- conventional commit, the format is: `<type>(<scope>): <description>`
  - `type` can be `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`
  - `scope` is optional and can be the name of the module or component affected
- Never add yourself as a co-author in the commit message. Only add co-authors if someone else contributed to the code change.

## Git Safety

- NEVER force push to main
- NEVER bypass branch protection rules
