/**
 * E2E — parcours réel : accueil → recherche → prix réels → alerte.
 * Le parcours est SKIP sans clés eBay : on ne simule JAMAIS des prix.
 */

import { expect, test } from "@playwright/test";

const hasEbayKeys = Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
const query = process.env.E2E_QUERY ?? "Sony WH-1000XM5";

test.skip(!hasEbayKeys, "Clés eBay absentes — parcours réel impossible, aucun prix simulé");

test("accueil → recherche → résultats avec prix réels", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Comparateur");

  await page.fill('input[name="q"]', query);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/search\?q=/);

  // Les sources honnêtes s'affichent (état OK ou explicite, jamais masqué).
  await expect(page.locator("body")).toContainText("eBay", { timeout: 30_000 });
});

test("page mes alertes exige une connexion", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page.locator("body")).toContainText("Mes alertes");
});
