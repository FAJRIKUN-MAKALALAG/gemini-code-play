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
  // Pre-bundle deps agar dev server tidak hang saat cold start
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@monaco-editor/react",
      "react-syntax-highlighter",
      "react-markdown",
      "@supabase/supabase-js",
      "lucide-react",
    ],
  },
  build: {
    // Target modern browser — output lebih kecil
    target: "es2020",
    // Matikan sourcemap di production (hemat ~30% ukuran)
    sourcemap: false,
    // Minifikasi CSS lebih agresif
    cssMinify: true,
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
    // Naikan limit ke 600kb (setelah fix PrismLight, harusnya semua di bawah ini)
    chunkSizeWarningLimit: 600,
  },
}));

