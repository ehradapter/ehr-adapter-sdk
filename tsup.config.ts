import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  target: 'es2020',
  outDir: 'lib',
  external: ['axios', 'uuid', 'zod'],
  banner: {
    js: '/* @ehradapter/ehr-adapter-sdk - MIT License - https://ehradapter.com */',
  },
});
