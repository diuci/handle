import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Unocss from 'unocss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '~/': `${src}/`,
      '@hankit/tools': fileURLToPath(new URL('./packages/tools/src/index.ts', import.meta.url)),
    },
  },
  plugins: process.env.TEST
    ? []
    : [
        Vue(),
        AutoImport({
          imports: [
            'vue',
            '@vueuse/core',
          ],
          dts: true,
        }),
        Components({
          dts: true,
        }),
        Unocss(),
      ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('locale'))
            return 'locale'
          if (id.includes('idioms.txt'))
            return 'idioms'
          if (id.includes('polyphones.json'))
            return 'polyphones'
          if (id.includes('verse-pool.json') || id.includes('verse-readings.json'))
            return 'verse'
          if (id.includes('node_modules') && !id.endsWith('.css'))
            return 'vendor'
        },
      },
    },
  },
})
