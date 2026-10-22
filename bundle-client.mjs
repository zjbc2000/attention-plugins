import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function run() {
  // Resolve vite through node's own resolver: pnpm's virtual-store path carries
  // peer suffixes and changes whenever the peer graph changes.
  const { build } = await import('vite');

  await build({
    configFile: false,
    build: {
      outDir: resolve(__dirname, 'lib'),
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/client/index.ts'),
        formats: ['cjs'],
        fileName: () => 'client.js',
      },
      rollupOptions: {
        external: [
          'react',
          'react/jsx-runtime',
          'react-dom',
          '@deepseek-ai/cordis'
        ],
        output: {
          banner: "window.__ModuleLoader__.load({ id: 'attention-plugins', factory: (require) => {\nvar module = { exports: {} };\nvar exports = module.exports;\n",
          footer: "\nreturn module.exports;\n} });",
        },
      },
    },
  });
  console.log('Client bundle built successfully: lib/client.js');
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
