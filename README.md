# Researchium

GitHub repo: [divyanshusrivastava2018-rgb/derived](https://github.com/divyanshusrivastava2018-rgb/derived).

Static site + Express API (`server/index.js`). Run locally: `npm install` → `npm start` → open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env` for admin and optional YouTube import.

**Streamer dashboard** (Live Classes) uses `Researchium_stream/` at [http://localhost:3000/stream-studio/stream-dashboard.html](http://localhost:3000/stream-studio/stream-dashboard.html) — start the stream API from that folder; see [docs/STREAM-STUDIO.md](docs/STREAM-STUDIO.md).

## Stream Studio Login

Browser sign-in for the stream dashboard (`/stream-studio/stream-dashboard.html` and `studio-lobby.html`) is validated by the main Researchium API (`POST /api/stream/auth/login`). Set these in `.env` locally or in your host’s environment (e.g. Render):

- **`STREAM_STUDIO_EMAIL`** — allowed educator email (e.g. `admin@derived.co.in`)
- **`STREAM_STUDIO_PASSWORD`** — password for that account

On success the server returns a short-lived JWT (signed with **`RESEARCHIUM_MEMBER_SECRET`**), stored in the browser as `sessionStorage.studio_token`. Only users who match both values can open the stream dashboard from the browser. Use a strong password in production; do not commit real credentials to git.

**`Researchium_stream/js/stream-dashboard-page.js`** loads the dashboard UI after `GET /api/stream/auth/verify` succeeds (see the script block at the bottom of `stream-dashboard.html`). Sign out clears session storage and returns to `studio-lobby.html`.

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
