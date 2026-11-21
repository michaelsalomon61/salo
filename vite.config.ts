import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative Pfade, damit die Seite auch in einem Unterverzeichnis läuft (z. B. GitHub Pages).
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
});
