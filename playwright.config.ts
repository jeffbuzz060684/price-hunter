import { defineConfig } from "@playwright/test";

/**
 * E2E Playwright — nécessite un serveur démarré (npm run dev) et des clés
 * eBay pour le parcours réel. Sans clés, les tests réels sont skippés
 * (jamais de simulation de prix).
 */

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000"
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
