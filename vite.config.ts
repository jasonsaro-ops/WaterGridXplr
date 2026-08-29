import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://USER.github.io/WaterGridXplr/
// Set VITE_BASE=/YourRepoName/ if the repo name differs (must end with /).
// For user/org site (username.github.io root) set VITE_BASE=/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/WaterGridXplr/',
})
