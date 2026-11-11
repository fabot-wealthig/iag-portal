// Catches a name used but never defined or imported, which `npm run build` does NOT (GOTCHA #57:
// 2026-11-11 a dropped import crashed every payment page in production). ESLint is not a project
// dependency; run it through npx from the frontend worktree and read only the no-undef lines:
//   npx eslint --no-config-lookup -c scripts/undef-check.config.mjs src | grep no-undef
// No output = clean. (Five "Definition for rule 'react-hooks/exhaustive-deps' was not found" lines
// come from inline disable comments and are not findings.)
export default [{
  files: ['**/*.js', '**/*.jsx'],
  languageOptions: {
    ecmaVersion: 'latest', sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', fetch: 'readonly', Intl: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', Promise: 'readonly', Map: 'readonly', Set: 'readonly', AbortController: 'readonly', FormData: 'readonly', Blob: 'readonly', File: 'readonly', atob: 'readonly', btoa: 'readonly', location: 'readonly', history: 'readonly', alert: 'readonly', confirm: 'readonly', requestAnimationFrame: 'readonly', getComputedStyle: 'readonly', matchMedia: 'readonly', crypto: 'readonly', Headers: 'readonly', Response: 'readonly', Request: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', structuredClone: 'readonly', globalThis: 'readonly', process: 'readonly' },
  },
  rules: { 'no-undef': 'error' },
}]
