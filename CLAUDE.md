# CLAUDE.md

## Commits

- Keep one logical change in one commit. While iterating on a change (for example, fixing CI until it passes), amend the existing commit with `git commit --amend` instead of stacking follow-up "fix" commits.
- Only start a new commit when the work is a separate, independently meaningful change.
- If the amended commit was already pushed to a feature branch, update it with `git push --force-with-lease`. Never force-push `main`.
- Commit messages follow Conventional Commits (enforced by commitlint) and drive semantic-release changelogs, so a clean history means a clean changelog.
