import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGithubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGithubPages ? "/First/" : "/",
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    outDir: isGithubPages ? "../docs" : "dist",
    emptyOutDir: true
  }
});
