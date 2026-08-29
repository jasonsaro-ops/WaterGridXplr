# How to put WaterGridXplr on GitHub (correct way)

## Do NOT upload the .zip as one file

If the repo only contains `WaterGridXplr.zip`, the build will fail.
GitHub needs the **extracted project files at the repository root**.

## Option A — GitHub website (easiest)

1. Unzip `WaterGridXplr.zip` on your computer.
2. Open the folder. You should see:
   - `package.json`
   - `package-lock.json`
   - `index.html`
   - `src/`
   - `public/`
   - `.github/workflows/deploy.yml`
3. Create a new empty repo named **exactly** `WaterGridXplr` (no README if possible).
4. On the repo page click **Add file → Upload files**.
5. Drag **all of the extracted files and folders** (not the outer zip) into the browser.
   - Include the hidden `.github` folder (drag the whole folder).
6. Commit to `main`.
7. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
8. Open the **Actions** tab and wait for “Deploy to GitHub Pages” to finish green.
9. Site: `https://YOUR_USERNAME.github.io/WaterGridXplr/`

## Option B — git command line

```bash
unzip WaterGridXplr.zip
cd WaterGridXplr          # or WaterGridXplr/WaterGridXplr if double-nested
# confirm package.json is here:
ls package.json

git init
git add .
git commit -m "WaterGridXplr initial"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/WaterGridXplr.git
git push -u origin main
```

Then enable Pages → Source: **GitHub Actions**.

## Repo layout must look like this

```
WaterGridXplr/          ← GitHub repository root
  package.json
  package-lock.json
  index.html
  vite.config.ts
  src/
  public/
  .github/
    workflows/
      deploy.yml
```

Wrong:

```
WaterGridXplr/
  WaterGridXplr.zip     ← only a zip = broken
```

or

```
WaterGridXplr/
  WaterGridXplr/        ← nested folder = broken
    package.json
```

## If the repo name is not WaterGridXplr

Edit `.github/workflows/deploy.yml` and set:

```yaml
VITE_BASE: /YourExactRepoName/
```

and the same in `vite.config.ts`.
