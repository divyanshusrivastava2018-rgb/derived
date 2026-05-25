# GitHub Pages workflow — manual update

If `git push` is rejected for `.github/workflows/static.yml` (missing `workflow` OAuth scope), apply this in the GitHub UI: **Actions → Deploy static content to Pages → edit workflow**, or push from a PAT with `workflow` scope.

Add before **Upload artifact**:

```yaml
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Build runtime config (production static)
        run: npm run build:runtime-config
        env:
          NODE_ENV: production
          GATE_OFFLINE_SCORING: "0"
          GATE_API_BASE: ${{ secrets.GATE_API_BASE }}
```

Set repository secret **`GATE_API_BASE`** to your Render/API URL (e.g. `https://researchium-xxxx.onrender.com`).
