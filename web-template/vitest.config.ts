import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts", "src/tests/**/*.test.tsx"],
    // Astro's virtual modules don't exist outside an Astro build. We don't
    // import them in tests, but if anything sneaks in, this maps the import
    // to a stub.
    server: {
      deps: {
        inline: ["@testing-library/user-event"],
      },
    },
  },
});
