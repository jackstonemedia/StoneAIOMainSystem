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
      {
        name: 'use-sync-external-store-shim',
        resolveId(id: string) {
          if (/^use-sync-external-store\/shim(\/index(\.js)?)?$/.test(id)) {
            return path.resolve(__dirname, 'src/shims/use-sync-external-store-shim.ts');
          }
          if (/^use-sync-external-store\/shim\/with-selector(\.js)?$/.test(id)) {
            return path.resolve(__dirname, 'src/shims/use-sync-external-store-with-selector.ts');
          }
        },
        load(id: string) {
          const n = id.replace(/\\/g, '/');
          if (/use-sync-external-store\/shim\/index\.js/.test(n)) {
            return `export { useSyncExternalStore } from 'react';`;
          }
          if (/use-sync-external-store\/shim\/with-selector\.js/.test(n)) {
            return `
import { useSyncExternalStore } from 'react';
import { useRef } from 'react';
export function useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
  let hasMemo = false, memoSnap, memoSel;
  const sel = (snap) => {
    if (!hasMemo) { hasMemo = true; memoSnap = snap; memoSel = selector(snap); return memoSel; }
    if (Object.is(memoSnap, snap)) return memoSel;
    const next = selector(snap);
    if (isEqual && isEqual(memoSel, next)) { memoSnap = snap; return memoSel; }
    memoSnap = snap; memoSel = next; return next;
  };
  return useSyncExternalStore(subscribe, () => sel(getSnapshot()), getServerSnapshot ? () => sel(getServerSnapshot()) : undefined);
}
export default { useSyncExternalStoreWithSelector };
`;
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: [
        'react', 'react-dom', 'react-dom/client',
        'react/jsx-runtime', 'react/jsx-dev-runtime',
        'react-router-dom',
      ],
    },
    optimizeDeps: {
      // Pre-declare ALL dependencies so Vite never discovers new ones mid-session.
      // Mid-session re-optimization changes the React chunk hash → two React instances
      // → dispatcher is null → useState crashes. Every imported npm package must be here.
      holdUntilCrawlEnd: true,
      include: [
        'react',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        '@tanstack/react-query',
        'lucide-react',
        'axios',
        'zustand',
        'clsx',
        'tailwind-merge',
        'motion',
        'motion/react',
        '@hello-pangea/dnd',
        '@xyflow/react',
        'nanoid',
        'swr',
      ],
      exclude: ['@clerk/clerk-react'],
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

