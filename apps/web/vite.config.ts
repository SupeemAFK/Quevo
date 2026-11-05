import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), nitro({ preset: 'node_server' }), viteReact()],
})
