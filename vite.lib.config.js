import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Library build: bundles the KoiRiver component (with the GLSL inlined) into
   an ESM file. React, react-dom and three are left external — the consumer
   provides them (peer deps). `npm run build:lib` */
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['three'] },
  publicDir: false,   /* don't copy public/ into the lib dist (assets ship separately) */
  build: {
    lib: {
      /* main entry = the React component; "engine" = the React-free engine */
      entry: {
        'koi-river': 'src/KoiRiver/index.js',
        'koi-river-engine': 'src/KoiRiver/KoiRiverEngine.js'
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'three'],
      output: { exports: 'named' }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  }
});
