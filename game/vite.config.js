/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
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
