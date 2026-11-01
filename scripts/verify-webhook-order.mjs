// Prüft die Reihenfolge im Stripe-Webhook: erst verarbeiten, dann das Ereignis merken.
// Ausgabe bei Erfolg: WEBHOOK-ORDER-OK
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8");
const sync = src.indexOf("await syncSubscription(");
const record = src.search(/from\("billing_events"\)\s*\.insert\(/);
const release = src.includes('from("billing_events").delete()');
if (sync < 0 || record < 0) {
  console.log("WEBHOOK-ORDER-FEHLER: Verarbeitung oder Merken nicht gefunden");
  process.exit(1);
}
if (record < sync) {
  console.log("WEBHOOK-ORDER-FEHLER: Ereignis wird vor der Verarbeitung gemerkt");
  process.exit(1);
}
if (release) {
  console.log("WEBHOOK-ORDER-FEHLER: Freigabe per delete noch vorhanden");
  process.exit(1);
}
console.log("WEBHOOK-ORDER-OK");
