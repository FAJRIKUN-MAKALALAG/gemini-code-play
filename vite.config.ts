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
        // Chunking yang lebih granular
        manualChunks: (id) => {
          // Monaco Editor — load lazy, pisah sendiri
          if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
            return "monaco";
          }
          // Supabase — cukup besar, pisah sendiri
          if (id.includes("@supabase")) {
            return "supabase";
          }
          // React core
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react-core";
          }
          // React Router
          if (id.includes("react-router-dom") || id.includes("react-router/")) {
            return "router";
          }
          // Markdown + Syntax Highlighter (sekarang jauh lebih kecil setelah pakai PrismLight)
          if (id.includes("react-markdown") || id.includes("react-syntax-highlighter") || id.includes("remark")) {
            return "markdown";
          }
          // Radix UI components — pisah agar bisa di-cache lama
          if (id.includes("@radix-ui")) {
            return "radix";
          }
          // Icons — sering dipakai, cache terpisah
          if (id.includes("lucide-react")) {
            return "icons";
          }
          // Semua node_modules lainnya → vendor
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
    // Naikan limit ke 600kb (setelah fix PrismLight, harusnya semua di bawah ini)
    chunkSizeWarningLimit: 600,
  },
}));

