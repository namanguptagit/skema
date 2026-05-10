import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";

// https://vite.dev/config/
// No top-level await in the WASM glue; vite-plugin-top-level-await breaks Rolldown production builds.
export default defineConfig({
  plugins: [
    react(),
    wasm(),
  ],
})
