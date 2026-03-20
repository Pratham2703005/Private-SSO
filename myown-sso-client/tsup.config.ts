import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom", "next", "crypto"],
    banner: { js: '"use client";' },
  },
  // Server: NO BUNDLING - keep as individual files with 'use server' at top
  {
    entry: {
      "server/start-auth": "src/server/start-auth.ts",
      "server/callback": "src/server/callback.ts",
      "server/validate-session": "src/server/validate-session.ts",
      "server/handle-logout": "src/server/handle-logout.ts",
      server: "src/server/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: ["react", "react-dom", "next", "crypto"],
  },
  {
    entry: { shared: "src/shared/index.ts" },
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: ["react", "react-dom", "next", "crypto"],
  },
]);
