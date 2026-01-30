import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './', // Important for Electron to find assets
    build: {
        outDir: 'dist-react',
        emptyOutDir: true,
    },
    worker: {
        format: 'es',
    },
})
