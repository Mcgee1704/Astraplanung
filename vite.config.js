import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  build: {
    assetsInlineLimit: 2_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 1300,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  plugins: [
    {
      name: 'astraplanung-offline',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        handler(_, bundle) {
          const entry = bundle['index.html'];
          if (!entry) this.error('Die Startseite fehlt.');
          const js = Object.values(bundle).find(
            (file) => file.type === 'chunk' && file.isEntry,
          );
          const css = Object.values(bundle).find((file) =>
            file.fileName.endsWith('.css'),
          );
          const notices = readFileSync(
            new URL('./public/Drittanbieter-Lizenzen.txt', import.meta.url),
            'utf8',
          );
          const html = String(entry.source)
            .replace(
              /<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/,
              () =>
                '<script type="module">' +
                js.code.replace(/<\/script/gi, '<\\/script') +
                '</script>',
            )
            .replace(
              /<link\b[^>]*\brel="stylesheet"[^>]*>/,
              () => '<style>' + String(css.source) + '</style>',
            )
            .replace(
              '</body>',
              () =>
                '<script type="text/plain" id="drittanbieter-lizenzen">' +
                notices.replace(/<\/script/gi, '<\\/script') +
                '</script>\n</body>',
            );
          const worker = readFileSync(
            new URL('./scripts/offline-worker.js', import.meta.url),
            'utf8',
          );
          const version = createHash('sha256')
            .update(js.code)
            .update(String(css.source))
            .update(String(entry.source))
            .update(worker)
            .digest('hex')
            .slice(0, 12);
          const entries = Object.keys(bundle).map((name) => './' + name);
          this.emitFile({
            type: 'asset',
            fileName: 'Astraplanung.html',
            source: html,
          });
          this.emitFile({
            type: 'asset',
            fileName: 'sw.js',
            source: `const buildId = ${JSON.stringify(version)};\nconst shellPaths = ${JSON.stringify(entries)};\n${worker}`,
          });
        },
      },
    },
  ],
});
