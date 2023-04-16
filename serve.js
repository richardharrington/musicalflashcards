const esbuild = require('esbuild');
const inlineImage = require('esbuild-plugin-inline-image');

async function makeItSo() {
  const ctx = await esbuild.context({
    entryPoints: ['./src/index.tsx'],
    bundle: true,
    outdir: './public/assets',
    loader: {
      '.ts': 'tsx',
    },
    plugins: [inlineImage()],
  })

  await ctx.watch()

  const serveResult = await ctx.serve({
    servedir: './public',
  });

  console.log(serveResult);
}

makeItSo().catch(() => process.exit(1));
