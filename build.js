// TODO:
// 1. Conform this to the style in serve.js
// 2. Optionally, figure out how not to have it alter the same
//    rendered files in development and prod (index.css and index.js).
//    This is not important though.

// build.js
const esbuild = require('esbuild');
const inlineImage = require('esbuild-plugin-inline-image');

esbuild.build({
  entryPoints: ['./src/index.tsx'],
  outfile: './public/assets/index.js',
  minify: true,
  bundle: true,
  loader: {
    '.ts': 'tsx',
  },
  plugins: [inlineImage()],
}).catch(() => process.exit(1));
