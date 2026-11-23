/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.js'],
    // Node 26 defines a localStorage getter that returns undefined unless
    // --localstorage-file is set. Vitest then skips jsdom's storage. The
    // save tests need the jsdom implementation.
    execArgv: ['--no-experimental-webstorage'],
  },
  // energy-sim-wasm (web target) loads the companion .wasm via import.meta.url
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['energy-sim-wasm'],
  },
  plugins: [
    vue(),
    yaml(),
    {
      name: 'yaml-hot-reload',
      handleHotUpdate({ file, server }) {
        if (file.endsWith('.yaml')) {
          server.ws.send({ type: 'full-reload' })
          return []
        }
      },
    },
  ],
})
