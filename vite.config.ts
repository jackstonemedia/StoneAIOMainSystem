import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode: _mode}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '.') },
        { find: /^react$/, replacement: path.resolve(__dirname, 'src/shims/react-shim.ts') },
        { find: /^use-sync-external-store(\/shim)?\/with-selector(\.js)?$/, replacement: path.resolve(__dirname, 'src/shims/use-sync-external-store-with-selector.ts') },
        { find: /^use-sync-external-store(\/shim)?(\/index(\.js)?)?$/, replacement: path.resolve(__dirname, 'src/shims/use-sync-external-store-shim.ts') },
      ],
      dedupe: [
        'react', 'react-dom', 'react-dom/client',
        'react/jsx-runtime', 'react/jsx-dev-runtime',
        'react-router-dom',
        '@tanstack/react-query',
        '@tanstack/query-core',
        'motion', 'motion/react',
        'react-grid-layout',
        'react-resizable',
      ],
    },
    optimizeDeps: {
      holdUntilCrawlEnd: true,
      force: false, // set to true temporarily to bust cache if hooks crash
      entries: ['./index.html', './src/main.tsx'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@clerk/clerk-react',
        'react-router-dom',
        '@tanstack/react-query',
        '@tiptap/react',
        '@tiptap/starter-kit',
        '@radix-ui/react-dialog',
        '@radix-ui/react-label',
        '@radix-ui/react-select',
        '@radix-ui/react-slot',
        'lucide-react',
        'axios',
        'zustand',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        'date-fns',
        'motion',
        'motion/react',
        '@hello-pangea/dnd',
        '@xyflow/react',
        'nanoid',
        'swr',
        'retell-client-js-sdk',
        'react-grid-layout',
        'react-resizable',
        '@google/genai',
        'zod',
      ],
      exclude: ['@templatical/editor', '@templatical/renderer'],
    },
    html: {
      // Disable automatic CSP nonce — Turnstile needs to run inline scripts
      cspNonce: undefined,
    },
    server: {
      host: true,
      port: 5173,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true
        }
      }
    },
  };
});

