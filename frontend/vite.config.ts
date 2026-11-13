import { createReadStream, existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, normalize, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The Source Viewer's PDFs use the standard 14 fonts without embedding them,
 * so pdf.js needs its standard font data. Serve it from pdfjs-dist at
 * /standard_fonts/ in dev and copy it into the build, instead of committing
 * the files to public/.
 */
const pdfjsStandardFonts = (): Plugin => {
  const require = createRequire(import.meta.url)
  const fontsDir = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
  const prefix = '/standard_fonts/'
  return {
    name: 'pdfjs-standard-fonts',
    configureServer(server) {
      server.middlewares.use(prefix, (req, res, next) => {
        const file = normalize(join(fontsDir, decodeURIComponent((req.url ?? '').split('?')[0])))
        if (!file.startsWith(fontsDir + sep) || !existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const name of readdirSync(fontsDir)) {
        this.emitFile({ type: 'asset', fileName: `standard_fonts/${name}`, source: readFileSync(join(fontsDir, name)) })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsStandardFonts()],
})
