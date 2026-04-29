const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');
const root = __dirname;

const config = {
  entryPoints: [path.join(root, 'src/renderer/app.js')],
  bundle: true,
  outfile: path.join(root, 'src/renderer/bundle.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  define: {
    'process.env.SERVER_URL': JSON.stringify(
      process.env.SERVER_URL || 'ws://localhost:1234'
    ),
  },
};

if (watch) {
  esbuild.context(config).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(config).then(() => {
    console.log('Build complete.');
  });
}
