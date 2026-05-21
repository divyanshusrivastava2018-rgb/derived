# Researchium

GitHub repo: [divyanshusrivastava2018-rgb/derived](https://github.com/divyanshusrivastava2018-rgb/derived).

Static site + Express API (`server/index.js`). Run locally: `npm install` → `npm start` → open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env` for admin and optional YouTube import.

## Bug testing (smoke)

Runs a short-lived server on a random port and checks public APIs, admin login/session, and auth rejection on writes:

```bash
npm test
```

Requires outbound network for the YouTube oEmbed check. Uses temporary admin credentials in the child process only (does not change your `.env`).

## Push to GitHub (fix “Password authentication is not supported”)

GitHub **does not** accept your normal account password for `git push`.

1. Create a **Personal Access Token**: [github.com/settings/tokens](https://github.com/settings/tokens) (enable **repo** access, or fine-grained access to this repository with **Contents: Read and write**).
2. Set a clean remote (no email in the URL):

   ```bash
   git remote set-url origin https://github.com/divyanshusrivastava2018-rgb/derived.git
   ```

3. Push:

   ```bash
   git push -u origin main
   ```

4. When Git asks for credentials:
   - **Username:** your GitHub **username** (e.g. `divyanshusrivastava2018-rgb`) — **not** your Gmail address.
   - **Password:** paste the **token** (the long string from step 1), not your GitHub login password.

Optional — save credentials on this computer only:

```bash
git config --global credential.helper store
```

After one successful push, Git will reuse the stored token.

**SSH instead:** add an SSH key in [GitHub → Settings → SSH keys](https://github.com/settings/keys), then:

```bash
git remote set-url origin git@github.com:divyanshusrivastava2018-rgb/derived.git
git push -u origin main
```

## If push says “fetch first” / “rejected”

The remote may have an extra commit (e.g. GitHub’s initial README). Merge it once:

```bash
git fetch origin
git merge origin/main --allow-unrelated-histories
# resolve any README conflict, then:
git add README.md
git commit -m "Merge remote main"
git push -u origin main
```
