import packageInfo from './package.json' with { type: 'json' };
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './src/shared/sources.ts';

const firefox = process.env.BROWSER === 'firefox';
const icons = { 16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png', 128: 'icon-128.png' };

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Content Triage',
  version: packageInfo.version,
  description: packageInfo.description,
  icons,
  action: {
    default_title: 'Content Triage',
    default_icon: icons,
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [
    // Page world, one per site: reuses the signed-in session to read and edit the list.
    ...SOURCES.map(({ id, host }) => ({
      matches: [`https://${host}/*`],
      js: [`src/sources/${id}/page.iife.ts`],
      world: 'MAIN' as const,
    })),
    { matches: SOURCES.map(({ host }) => `https://${host}/*`), js: ['src/content/index.tsx'] },
  ],
  web_accessible_resources: [
    { resources: ['src/player/index.html'], matches: ['https://www.youtube.com/*'] },
  ],
  ...(firefox && {
    browser_specific_settings: {
      // Kept from the YouTube-only releases so installed copies keep updating.
      gecko: {
        id: 'youtube-triage@arhunsaday',
        strict_min_version: '142.0',
        data_collection_permissions: { required: ['none'] },
      },
    },
  }),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest, browser: firefox ? 'firefox' : 'chrome' })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      linkedom: fileURLToPath(new URL('./src/sources/x/linkedom.ts', import.meta.url)),
    },
  },
  build: {
    outDir: firefox ? 'dist-firefox' : 'dist',
    // Framed by cards on youtube.com; nothing in the manifest points at it.
    rollupOptions: { input: { player: 'src/player/index.html' } },
  },
  server: { port: 5174, strictPort: true },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
