# Uploading WaterGridXplr to GitHub

1. Create a new empty repository named **WaterGridXplr** (or any name; if different, edit `base` in `vite.config.ts` to match `/YourRepoName/`).

2. Unzip this package and push:

```bash
cd WaterGridXplr   # or the folder you extracted
git init
git add .
git commit -m "Initial WaterGridXplr — water infrastructure explorer"
git branch -M main
git remote add origin https://github.com/YOUR_USER/WaterGridXplr.git
git push -u origin main
```

3. Enable GitHub Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

4. The included workflow will build and deploy on every push to `main`.

5. Optional: add more GeoJSON under `public/data/` and wire layers in `src/App.tsx`.

No API key is required for the default sample map. Nominatim requests include a proper User-Agent.
