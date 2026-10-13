import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { docsSite } from './src/docs/build/plugin'

export default defineConfig({ plugins: [docsSite(), react()] })
