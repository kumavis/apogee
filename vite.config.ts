/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/apogee/' : '/',
  plugins: [wasm(), react()],
  publicDir: 'public', // Explicitly set public directory
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    minify: false,
    // Ensure assets are copied to the correct location
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Keep original file names for easier debugging
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  test: {
    environment: 'node'
  }
})
