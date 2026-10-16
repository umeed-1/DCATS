import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
// ONNX inference is enabled automatically once backend/model/train_model.py
// has produced public/models/threat_classifier.onnx (restart dev server after).
const hasOnnxModel = existsSync(resolve(root, 'public/models/threat_classifier.onnx'));

export default defineConfig({
  // Relative base so the build also loads from file:// inside Electron.
  base: './',
  define: {
    __HAS_ONNX_MODEL__: JSON.stringify(hasOnnxModel),
  },
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
});
