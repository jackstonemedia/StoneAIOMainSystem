import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode: _mode}) => {
  return {
    plugins: [
      react({
        // Disable nonce injection — it blocks Cloudflare Turnstile (used by Clerk OAuth)
        babel: { babelrc: false, configFile: false },
      }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    html: {
      // Disable automatic CSP nonce — Turnstile needs to run inline scripts
      cspNonce: undefined,
    },
    server: {
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
