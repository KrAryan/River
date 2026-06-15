import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /* keep a single Three.js instance shared with three/addons (GLTFLoader) */
  resolve: { dedupe: ['three'] }
});
