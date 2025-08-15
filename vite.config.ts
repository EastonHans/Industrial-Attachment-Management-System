import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying request:', req.method, req.url, '-> http://localhost:8000' + req.url);
          });
        }
      }
    }
  },
  plugins: [
    react(),
    // Temporarily removed lovable-tagger for debugging
    // mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    commonjsOptions: {
      include: [/jspdf/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['jspdf', 'jszip'],
    esbuildOptions: {
      target: 'esnext'
    }
  }
}));
