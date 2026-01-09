import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, existsSync } from 'fs'
import tailwindcss from '@tailwindcss/vite'
import { htmlInclude } from './vite-plugin-html-include.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Plugin to copy manifest.json, sitemap.xml, and CHANGELOG.md to dist root
const copyRootFilesPlugin = () => {
  return {
    name: 'copy-root-files',
    closeBundle() {
      const appFilesToCopy = ['manifest.json', 'sitemap.xml']
      const rootFilesToCopy = ['CHANGELOG.md']
      const appDir = resolve(__dirname, 'app')
      const rootDir = __dirname
      const distDir = resolve(__dirname, 'dist')

      // Copy files from app directory
      appFilesToCopy.forEach((file) => {
        const src = resolve(appDir, file)
        const dest = resolve(distDir, file)
        
        if (existsSync(src)) {
          copyFileSync(src, dest)
          console.log(`✓ Copied ${file} to dist root`)
        } else {
          console.warn(`⚠ ${file} not found in app directory`)
        }
      })

      // Copy files from root directory
      rootFilesToCopy.forEach((file) => {
        const src = resolve(rootDir, file)
        const dest = resolve(distDir, file)
        
        if (existsSync(src)) {
          copyFileSync(src, dest)
          console.log(`✓ Copied ${file} to dist root`)
        } else {
          console.warn(`⚠ ${file} not found in root directory`)
        }
      })
    },
  }
}

export default defineConfig({
  base: '/',
  root: resolve(__dirname, 'app'),
  plugins: [
    htmlInclude(),
    tailwindcss(),
    copyRootFilesPlugin(),
  ],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html'),
        'fundamentals/index': resolve(__dirname, 'app/fundamentals/index.html'),
        'fundamentals/logos': resolve(__dirname, 'app/fundamentals/logos.html'),
        'fundamentals/colors': resolve(__dirname, 'app/fundamentals/colors.html'),
        'fundamentals/fonts': resolve(__dirname, 'app/fundamentals/fonts.html'),
        'fundamentals/icons': resolve(__dirname, 'app/fundamentals/icons.html'),
        'fundamentals/guidelines': resolve(__dirname, 'app/fundamentals/guidelines.html'),
        'implementations/index': resolve(__dirname, 'app/implementations/index.html'),
        'implementations/business-cards': resolve(__dirname, 'app/implementations/business-cards.html'),
        'implementations/web-applications': resolve(__dirname, 'app/implementations/web-applications.html'),
        'implementations/email-footer': resolve(__dirname, 'app/implementations/email-footer.html'),
        'implementations/avatars': resolve(__dirname, 'app/implementations/avatars.html'),
        'implementations/github': resolve(__dirname, 'app/implementations/github.html'),
        'implementations/linkedin': resolve(__dirname, 'app/implementations/linkedin.html'),
        impressum: resolve(__dirname, 'app/impressum.html'),
        'google920fd9ad773da353': resolve(__dirname, 'app/google920fd9ad773da353.html'),
      },
    },
  },
  publicDir: resolve(__dirname, 'assets'),
})
