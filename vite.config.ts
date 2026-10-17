import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "street-league-seo-prerender",
      apply: "build",
      closeBundle() {
        // Runs for both `npm run build` and direct `vite build` Cloudflare commands.
        execFileSync(process.execPath, ["scripts/generate-seo-pages.mjs"], {
          cwd: process.cwd(),
          stdio: "inherit",
        });
      },
    },
  ],
  server: { port: 5173, host: "0.0.0.0" },
});
