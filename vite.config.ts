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
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Vendor separati: cache più efficace tra un deploy e l'altro.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/](@mui|@emotion|@popperjs|react-transition-group|stylis)[\\/]/.test(id)) return "vendor-mui";
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return "vendor-supabase";
          if (/[\\/]node_modules[\\/]@fortawesome[\\/]/.test(id)) return "vendor-icons";
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, host: "0.0.0.0" },
});
