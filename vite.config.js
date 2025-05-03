import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    base: './',
    server: {
        open: true
    },
    resolve: {
        alias: {
            'three': path.resolve(__dirname, './node_modules/three')
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: './index.html'
            }
        }
    }
});
