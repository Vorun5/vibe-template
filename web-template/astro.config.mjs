import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { createLogger } from "vite";

// Suppress a known Vite 6 + @astrojs/react dev-mode warning:
// React Fast Refresh preamble is injected as a "before-hydration" script,
// which Astro's astro:scripts plugin registers via emitFile() in buildStart().
// Vite 6 warns that emitFile() is unsupported in serve mode, but the script
// still loads correctly through Vite's module graph. No effect on SSR or SEO.
const logger = createLogger();
const _warn = logger.warn.bind(logger);
logger.warn = (msg, opts) => {
  if (msg.includes("emitFile() is not supported in serve mode")) return;
  _warn(msg, opts);
};

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    customLogger: logger,
  },
});
