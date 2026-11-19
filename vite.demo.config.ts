import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  server: {
    port: 43123,
    strictPort: true,
    host: "127.0.0.1",
  },
});
