import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { readdirSync, existsSync } from 'fs'

// Static pages under chattanooga/ are produced by scripts/generate-pages.mjs
// (run by the build script before vite). Collect them so Vite bundles the CSS
// into each one and they ship as real, crawlable URLs.
function generatedPages (dir, found = {}) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) generatedPages(full, found)
    else if (entry.name === 'index.html') {
      const key = full.replace(resolve(__dirname) + '/', '').replace(/\//g, '_').replace(/\.html$/, '')
      found[key] = full
    }
  }
  return found
}

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        signup: resolve(__dirname, 'signup.html'),
        aftercare: resolve(__dirname, 'aftercare.html'),
        welcome: resolve(__dirname, 'welcome.html'),
        ...generatedPages(resolve(__dirname, 'chattanooga')),
      },
    },
  },
})
