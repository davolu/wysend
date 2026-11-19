import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      VITE_FIREBASE_API_KEY: "test-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "test-project",
      VITE_FIREBASE_STORAGE_BUCKET: "test-project.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
      VITE_FIREBASE_APP_ID: "1:1234567890:web:abc",
      VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: "test-debug-token",
    },
  },
});
