import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Build sırasında commit hash + timestamp damgalar — kullanıcı girdisi yok, execFile shell'siz
const shortSha = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim()
  } catch {
    return 'dev'
  }
})()

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const buildDate = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(shortSha),
    __APP_BUILD_DATE__: JSON.stringify(buildDate),
  },
})
