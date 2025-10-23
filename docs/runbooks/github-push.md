# Runbook: Publish Trellis Vaults Changes to GitHub

This runbook explains how to take local changes from the `trellis` workspace (such as updates to `AUDIT.md`) and publish them to the main GitHub repository. Follow these steps whenever you need to share new commits with collaborators.

## Prerequisites

- Local git working tree in sync with the `work` branch that tracks the GitHub remote (usually `origin`).
- GitHub personal access token (PAT) or SSH key with push access to the repository.
- `pnpm install` already executed if you plan to run tests before pushing.

## 1. Inspect Local Status

```bash
git status -sb
```

- Review the list of modified/untracked files.
- If there are changes you do **not** want to include in the commit, either revert them (`git checkout -- <file>`) or add them to `.gitignore` as appropriate.

## 2. Run Optional Checks

For documentation-only updates this is optional, but for code changes run the relevant scripts (examples):

```bash
pnpm lint
pnpm test
pnpm contracts:test
```

Document any checks you ran in `LOG.md`.

## 3. Stage Files

Stage the files that should be part of the commit:

```bash
git add AUDIT.md LOG.md
```

Adjust the file list as needed. You can verify the staging area with:

```bash
git status -sb
```

## 4. Commit with Conventional Message

```bash
git commit -m "docs: record audit publication metadata"
```

- Keep the subject under 72 characters.
- Use the conventional commits prefix (`docs:`, `feat:`, `fix:`, etc.).

## 5. Confirm Remote Configuration

Check the remote named `origin` (or configure it if missing):

```bash
git remote -v
```

If the remote is absent, add it. Example using HTTPS with a PAT:

```bash
git remote add origin https://github.com/<your-user>/trellis.git
```

For SSH:

```bash
git remote add origin git@github.com:<your-user>/trellis.git
```

## 6. Sync with Remote Main (Optional but Recommended)

Fetch and rebase on the latest remote `main` to avoid diverging history:

```bash
git fetch origin
# If your local branch is named work and tracks origin/main:
git rebase origin/main
```

Resolve any conflicts, then continue (`git rebase --continue`).

## 7. Push to GitHub

Push your branch (replace `work` with your branch name if different):

```bash
git push origin work
```

To update the `main` branch directly:

```bash
git push origin work:main
```

Only push directly to `main` if your workflow allows it; otherwise open a pull request on GitHub.

## 8. Verify on GitHub

- Visit the repository page to confirm the commit appears on the branch.
- If you opened a PR, ensure status checks pass and request review.

## Troubleshooting

- **Authentication failures:** regenerate your PAT or re-add your SSH key.
- **Non-fast-forward errors:** run `git fetch origin` followed by `git rebase origin/<branch>` and retry the push.
- **Unwanted files in commit:** use `git reset HEAD <file>` to unstage, edit `.gitignore`, then recommit.

Keep the runbook updated as your release process evolves.
