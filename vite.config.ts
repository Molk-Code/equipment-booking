import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function generateManifest() {
  const dir = path.resolve(__dirname, 'public/bilder')
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
  const manifest: Record<string, string> = {}
  for (const f of files) {
    const name = f.replace(/\.[^.]*$/, '')
    manifest[name] = '/bilder/' + f
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

function bilderManifestPlugin() {
  return {
    name: 'bilder-manifest',
    buildStart() {
      generateManifest()
    },
    configureServer(server: { watcher: { on: (event: string, cb: (file: string) => void) => void } }) {
      const bilderDir = path.resolve(__dirname, 'public/bilder')
      server.watcher.on('add', (file: string) => {
        if (file.startsWith(bilderDir) && !file.endsWith('manifest.json')) {
          generateManifest()
        }
      })
      server.watcher.on('unlink', (file: string) => {
        if (file.startsWith(bilderDir) && !file.endsWith('manifest.json')) {
          generateManifest()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), bilderManifestPlugin()],
})
