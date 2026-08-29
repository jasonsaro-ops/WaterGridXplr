# Uploading WaterGridXplr to GitHub

## Critical: white screen / main.tsx 404

That error means **the production build did not run**. GitHub Pages was serving source files (or an empty site). Fixes included in this package:

1. **`package-lock.json` is present** so `npm ci` works in Actions.
2. Workflow uses `npm ci` with fallback to `npm install`.
3. Build script is `vite build` (does not fail on optional typecheck).

### Deploy steps

1. Repo name should be **`WaterGridXplr`** (or change `VITE_BASE` in `.github/workflows/deploy.yml` and `vite.config.ts` to `/YourRepoName/`).
2. Push all files including `package-lock.json` and `.github/workflows/deploy.yml`.
3. **Settings → Pages → Source: GitHub Actions** (not “Deploy from a branch”).
4. Open the Actions tab and confirm the **Deploy to GitHub Pages** workflow is green.
5. Site URL: `https://YOUR_USER.github.io/WaterGridXplr/`

### Local production check

```bash
npm install
npm run build
npm run preview
```

You should see a real map, not a white page. `dist/index.html` will reference hashed `/WaterGridXplr/assets/index-….js`, not `main.tsx`.
