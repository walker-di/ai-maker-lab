/// <reference types="vitest/config" />
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  optimizeDeps: {
    include: [
      '@lucide/svelte/icons/code-2',
      '@lucide/svelte/icons/eye',
      '@lucide/svelte/icons/eye-off',
      '@lucide/svelte/icons/file-search',
      '@lucide/svelte/icons/globe',
      '@lucide/svelte/icons/image',
      '@lucide/svelte/icons/info',
      '@lucide/svelte/icons/map-pinned',
      '@lucide/svelte/icons/radar',
      '@lucide/svelte/icons/search',
      '@lucide/svelte/icons/sparkles',
      '@lucide/svelte/icons/square-terminal',
      '@lucide/svelte/icons/waypoints',
      '@lucide/svelte/icons/x',
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          }
        }
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,js}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          },
          setupFiles: ['./src/lib/test-setup.ts'],
        }
      }
    ]
  }
});