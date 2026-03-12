# Deploy to git.lightepic.com

> Push Oh-My-Claude to the self-hosted Gitea instance at `https://git.lightepic.com/ake/Oh-My-Claude.git`

## First-time Setup

### 1. Add remote

```bash
cd Oh-My-Claude
git remote add lightepic https://git.lightepic.com/ake/Oh-My-Claude.git
```

### 2. Verify remotes

```bash
git remote -v
```

Expected output:

```
lightepic   https://git.lightepic.com/ake/Oh-My-Claude.git (fetch)
lightepic   https://git.lightepic.com/ake/Oh-My-Claude.git (push)
origin      https://github.com/suparerk9x/Oh-My-Claude.git (fetch)
origin      https://github.com/suparerk9x/Oh-My-Claude.git (push)
```

### 3. Push for the first time

```bash
git push lightepic main
```

> If the remote repository is empty, this creates the `main` branch on the server.

## Everyday Push

### Push to lightepic only

```bash
git push lightepic main
```

### Push to both remotes

```bash
git push origin main && git push lightepic main
```

### Push all branches

```bash
git push lightepic --all
```

## Sync from GitHub to Lightepic

If `origin` (GitHub) has newer commits:

```bash
git pull origin main
git push lightepic main
```

## Authentication

Gitea uses HTTPS authentication. On first push, Git will prompt for credentials:

| Field | Value |
|-------|-------|
| Username | Your Gitea username (e.g. `ake`) |
| Password | Your Gitea password or [access token](https://git.lightepic.com/user/settings/applications) |

> **Tip:** Use a **Personal Access Token** instead of password for better security. Generate one at: `https://git.lightepic.com/user/settings/applications`

### Store credentials (optional)

To avoid entering credentials every time:

```bash
git config --global credential.helper store
```

> This stores credentials in plaintext at `~/.git-credentials`. On Windows, consider using `manager` instead:
>
> ```bash
> git config --global credential.helper manager
> ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `remote already exists` | Remote was already added. Run `git remote -v` to verify |
| `Authentication failed` | Check username/password or generate a new access token |
| `Connection refused` | Check if `git.lightepic.com` is reachable: `curl -s https://git.lightepic.com` |
| `rejected (non-fast-forward)` | Remote has commits you don't have. Run `git pull lightepic main` first |

## Remote Summary

| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | `https://github.com/suparerk9x/Oh-My-Claude.git` | Public GitHub repo |
| `lightepic` | `https://git.lightepic.com/ake/Oh-My-Claude.git` | Self-hosted Gitea (private) |
