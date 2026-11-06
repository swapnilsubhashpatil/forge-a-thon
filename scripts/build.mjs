import { context } from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["vscode"],
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
