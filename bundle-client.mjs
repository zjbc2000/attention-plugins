import { resolve } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function run() {
  // Resolve vite through node's own resolver: pnpm's virtual-store path carries
  // peer suffixes and changes whenever the peer graph changes.
  const { build } = await import('vite');
  const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

  await build({
    configFile: false,
    // The settings panel shows the installed version; baking it in keeps the
    // client bundle free of a runtime package.json read.
    define: {
      __ATTENTION_VERSION__: JSON.stringify(pkg.version),
    },
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
  console.log(`Client bundle built successfully: lib/client.js (v${pkg.version})`);
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
