import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

export default defineConfig(({ mode }) => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const env = loadEnv(mode, currentDir, "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            markdown: ["react-markdown", "remark-gfm", "rehype-highlight", "highlight.js"],
          },
        },
      },
    },
  };
});
