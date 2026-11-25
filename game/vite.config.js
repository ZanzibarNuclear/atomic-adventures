/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  test: {
    environment: 'node',
    // Node 26's experimental localStorage getter returns undefined unless
    // --localstorage-file is set. Vitest will not replace an existing global,
    // so jsdom never installs window.localStorage and bare localStorage in
    // useSaveGame stays undefined. Disable the experiment so tests see jsdom.
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.js', 'server/**/*.test.js'],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Vue changes rarely. Keep it out of the game chunk so a
              // content or gameplay deploy does not re-download it.
              name: 'vue',
              test: /node_modules\/(?:@vue\/|vue\/|vue-router\/)/,
              priority: 20,
            },
          ],
        },
      },
    },
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
