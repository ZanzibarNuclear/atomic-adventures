import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import yaml from '@rollup/plugin-yaml'

// World/story content is authored as YAML (see design/content/story/story-data-format.md).
// The yaml plugin lets us import those files directly as parsed objects.
export default defineConfig({
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
