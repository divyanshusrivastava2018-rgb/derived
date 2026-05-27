import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../dist/stream-components'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.jsx'),
      name: 'ResearchiumStreamComponents',
      formats: ['iife'],
      fileName: () => 'stream-components.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'stream-components.[ext]',
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
