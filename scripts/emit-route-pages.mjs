import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// GitHub Pages has no SPA rewrite: a request for a client-side route is a real
// HTTP 404 rescued only by the JS in public/404.html. Humans never notice;
// scanners, spam filters and link checkers stop at the 404 and read it as
// cloaking. Writing dist/<route>/index.html makes each route a genuine 200.
// Every path that is emailed to a person belongs in this list.
const ROUTES = [
  'login',
  'portal',
  'set-password',
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const source = join(dist, 'index.html')

if (!existsSync(source)) {
  console.error('emit-route-pages: dist/index.html missing - run vite build first')
  process.exit(1)
}

for (const route of ROUTES) {
  const dir = join(dist, route)
  mkdirSync(dir, { recursive: true })
  copyFileSync(source, join(dir, 'index.html'))
}

console.log(`emit-route-pages: wrote ${ROUTES.length} route pages`)
