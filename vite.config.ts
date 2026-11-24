import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    assetsDir: "_app",
    chunkSizeWarningLimit: 4096,
    // What the game needs to start ships as one file; lazy parts (the loaders) would otherwise split it into dozens.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: "game", tags: ["$initial"] }] } } },
  },
  server: { host: true },
});
