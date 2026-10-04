/**
 * VÉRIFICATION PÉRIODIQUE DES ALERTES — exécuté par le cron GitHub Actions.
 * Retourne le nombre d'alertes déclenchées. Ne déclenche JAMAIS sur un prix
 * non vérifiable (garanti par evaluateAlert + checkAlerts).
 *
 * Usage : npm run alerts:check  (nécessite DATABASE_URL + SESSION_SECRET + clés marchands)
 */

import { checkAlerts } from "@/lib/alerts/service";
import { prisma } from "@/lib/db/client";

async function main() {
  const triggered = await checkAlerts(new Date());
  console.log(`Vérification terminée : ${triggered} alerte(s) déclenchée(s).`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Échec de la vérification des alertes :", error);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
