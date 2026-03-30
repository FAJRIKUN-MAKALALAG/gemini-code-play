import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimasi untuk npm run dev pertama kali agar tidak hang/lag
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@monaco-editor/react",
      "react-syntax-highlighter",
      "react-markdown",
      "@supabase/supabase-js",
      "lucide-react"
    ],
  },
  // Optimasi untuk npm run build agar hasil file-nya terpecah kecil-kecil (Chunking)
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          monaco: ["@monaco-editor/react"],
          markdown: ["react-markdown", "react-syntax-highlighter", "remark-gfm"],
          supabase: ["@supabase/supabase-js"],
          ui: ["lucide-react", "clsx", "tailwind-merge"],
        },
      },
    },
    // Mengurangi limit peringatan dari 500kb ke 1000kb agar log build lebih bersih
    chunkSizeWarningLimit: 1000,
  },
}));
