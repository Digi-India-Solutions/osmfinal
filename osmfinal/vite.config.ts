// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import AutoImport from 'unplugin-auto-import/vite';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const base = process.env.BASE_PATH || '/';
const isPreview = process.env.IS_PREVIEW ? true : false;

export default defineConfig({
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ''),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ''),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ''),
  },
  plugins: [
    react(),
    AutoImport({
      imports: [
        {
          react: [
            ['default', 'React'],
            'useState',
            'useEffect',
            'useContext',
            'useReducer',
            'useCallback',
            'useMemo',
            'useRef',
            'useImperativeHandle',
            'useLayoutEffect',
            'useDebugValue',
            'useDeferredValue',
            'useId',
            'useInsertionEffect',
            'useSyncExternalStore',
            'useTransition',
            'startTransition',
            'lazy',
            'memo',
            'forwardRef',
            'createContext',
            'createElement',
            'cloneElement',
            'isValidElement',
          ],
        },
        {
          'react-router-dom': [
            'useNavigate',
            'useLocation',
            'useParams',
            'useSearchParams',
            'Link',
            'NavLink',
            'Navigate',
            'Outlet',
          ],
        },
        {
          'react-i18next': ['useTranslation', 'Trans'],
        },
      ],
      dts: true,
    }),
    // ✅ Custom plugin to copy PDF worker
    {
      name: 'copy-pdf-worker',
      writeBundle() {
        try {
          const src = resolve(
            __dirname,
            'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          );
          const dest = resolve(__dirname, 'out/assets/pdf.worker.min.mjs');

          if (!existsSync(dirname(dest))) {
            mkdirSync(dirname(dest), { recursive: true });
          }

          if (existsSync(src)) {
            copyFileSync(src, dest);
            console.log('✅ PDF worker copied to dist/assets/');
          } else {
            console.warn('⚠️ PDF worker not found at:', src);
          }
        } catch (err) {
          console.warn('⚠️ Could not copy PDF worker:', err);
        }
      },
    },
  ],
  base,
  build: {
    sourcemap: true,
    outDir: 'out',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router-dom')
            ) {
              return 'vendor';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('pdfjs-dist')) {
              return 'pdf';
            }
            return 'vendor';
          }
          return undefined;
        },
      },
    },
    // ✅ Ensure assets are copied
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
});
