import path from 'node:path';
import { defineConfig } from 'tsup';

const here = __dirname;

export default defineConfig({
  entry: { 'widget.built': path.join(here, 'src/entry.ts') },
  format: ['iife'],
  platform: 'browser',
  target: 'es2018',
  outDir: path.join(here, 'dist'),
  outExtension: () => ({ js: '.js' }),
  minify: false,
  sourcemap: false,
  dts: false,
  clean: true,
  splitting: false,
  treeshake: false,
});
