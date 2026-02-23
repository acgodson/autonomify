import { defineConfig } from "tsup";
import { builtinModules } from "module";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  bundle: true,
  noExternal: [/^(?!@aztec|@noir-lang).*/],
  external: [
    ...builtinModules.map(m => `node:${m}`),
    "@aztec/bb.js",
    "@noir-lang/noir_js",
  ],
  platform: "node",
  target: "node20",
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  outExtension: () => ({ js: ".js" }),
  esbuildOptions(options) {
    options.banner = {
      js: "import { createRequire } from 'module';import { fileURLToPath as _fileURLToPath } from 'url';import { dirname as _dirname } from 'path';const require = createRequire(import.meta.url);const __filename = _fileURLToPath(import.meta.url);const __dirname = _dirname(__filename);",
    };
  },
});
