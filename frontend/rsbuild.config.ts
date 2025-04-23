// frontend/rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

export default defineConfig({
  plugins: [
    pluginReact(), // Enable React support
    pluginSvgr(),  // Enable SVG as React components
  ],
  html: {
    // Point to your main HTML file (now expected in root or configured path)
    template: './index.html',
  },
  output: {
    // Rsbuild defaults to 'dist', CRA defaults to 'build'.
    // Keep 'dist' or change if you prefer 'build':
    distPath: {
      root: 'dist', // Or 'build' if you want to keep the old name
    },
    // Automatically handle polyfills based on browserslist in package.json
    polyfill: 'usage',
  },
  dev: {
    // Ensure asset paths work correctly in SPA routing
    assetPrefix: '/',
  },
  source: {
    // If you used src="" paths in CRA (jsconfig.json baseUrl='src'),
    // configure aliases if needed, though often imports work directly.
    // alias: { '@': './src', },

    // To handle REACT_APP_ environment variables like CRA:
    define: {
      // Rsbuild uses import.meta.env, CRA used process.env
      // Map your existing variable:
      'process.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL)
      // Or better: Rename your env var to PUBLIC_API_URL and use import.meta.env.PUBLIC_API_URL
    },
  },
  // Optional: If you need proxy setup like CRA's setupProxy.js
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'http://localhost:8080', // Your backend address
  //       changeOrigin: true,
  //     },
  //   },
  // },
  // Optional: Configure Sass if needed (often works out-of-box)
  // tools: {
  //   sass: {
  //     // additionalData: `@import "@/styles/variables.scss";`,
  //   },
  // },
});