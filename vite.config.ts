import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        sourcemap: false,
        // Route-level chunks (charts/PDF/spreadsheets) must not be requested
        // by the login shell. They are loaded only when the owning module is
        // opened or an export action is invoked.
        modulePreload: false,
        chunkSizeWarningLimit: 500,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('recharts') || id.includes('victory-vendor')) return 'charts';
              if (id.includes('lucide-react')) return 'icons';
              if (id.includes('html2canvas')) return 'html2canvas';
              if (id.includes('jspdf') || id.includes('canvg') || id.includes('html2canvas')) return 'pdf-tools';
              if (id.includes('xlsx')) return 'spreadsheet';
              // Keep React, React DOM and router in Vite's default shared
              // chunking. Manually separating them can create circular
              // chunks where libraries read React before initialization.
              return undefined;
            }
          }
        }
      }
    };
});
