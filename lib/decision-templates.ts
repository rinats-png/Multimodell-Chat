/**
 * Entscheidungsvorlagen für den Start einer Debatte. Sie füllen das Eingabefeld, der Nutzer ergänzt seine Zahlen
 * und sendet selbst. Jede Vorlage nennt Optionen A bis C, damit die KIs sie bewerten und der Bericht (F-21) sie
 * sauber ableiten kann. Die letzte Zeile bittet jede KI um eine Wertung je Option.
 */
export interface DecisionTemplate {
  id: string;
  title: string;
  hint: string;
  text: string;
}

const ASK = "Bitte bewertet jede Option mit einer Zahl von 0 bis 10 aus eurer Fachrolle und nennt euren stärksten Einwand.";

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    id: "preis",
    title: "Preis ändern",
    hint: "Erhöhen, senken oder lassen?",
    text: `Entscheidung: Soll ich meinen Preis von [aktuell] auf [neu] ändern?
Optionen: A) für alle sofort ändern, B) nur für Neukunden ändern, C) Preis so lassen.
Meine Zahlen: Kunden [Anzahl], Umsatz pro Monat [Betrag], Abschlussquote [Prozent], Rücklagen [Betrag].
Grenzen: Entscheidung bis [Datum], Ziel: [Ziel und Zeitraum].
Ich tendiere zu: [Option] weil [Grund].
${ASK}`,
  },
  {
    id: "einstellen",
    title: "Jemanden einstellen",
    hint: "Jetzt, später oder anders lösen?",
    text: `Entscheidung: Soll ich [Rolle] einstellen?
Optionen: A) jetzt fest einstellen, B) Freelancer oder Teilzeit testen, C) noch nicht einstellen.
Meine Zahlen: Umsatz pro Monat [Betrag], Rücklagen [Betrag], Kosten der Stelle [Betrag], mein Zeitbudget [Stunden pro Woche].
Grenzen: Start bis [Datum], Erfolg heißt [Ziel].
Ich tendiere zu: [Option] weil [Grund].
${ASK}`,
  },
  {
    id: "bauen-kaufen",
    title: "Bauen oder kaufen",
    hint: "Selbst entwickeln, einkaufen oder lassen?",
    text: `Entscheidung: Sollen wir [Funktion oder Werkzeug] selbst bauen oder einkaufen?
Optionen: A) selbst bauen, B) fertige Lösung einkaufen, C) vorerst gar nichts tun.
Meine Zahlen: Team [Anzahl Entwickler], Budget [Betrag], Zeit bis zur Nutzung [Wochen], laufende Kosten der Fertiglösung [Betrag].
Grenzen: [harte Anforderungen, z. B. Datenschutz].
Ich tendiere zu: [Option] weil [Grund].
${ASK}`,
  },
  {
    id: "architektur",
    title: "Technik-Entscheidung",
    hint: "Architektur, Werkzeug, Umbau",
    text: `Entscheidung: [Technische Frage, z. B. Monolith oder Microservices]?
Optionen: A) [Variante 1], B) [Variante 2], C) Status quo behalten.
Kontext: Team [Anzahl und Erfahrung], Nutzer [Anzahl], größtes Problem heute [Problem], Frist [Datum].
Grenzen: Budget [Betrag], was sich nicht ändern darf [Punkt].
Ich tendiere zu: [Option] weil [Grund].
${ASK}`,
  },
  {
    id: "launch",
    title: "Launch oder warten",
    hint: "Starten, nachbessern, verschieben",
    text: `Entscheidung: Soll ich [Produkt] jetzt veröffentlichen?
Optionen: A) jetzt öffentlich starten, B) erst mit [Zahl] ausgewählten Nutzern testen, C) um [Zeitraum] verschieben.
Meine Zahlen: Fertigstellungsgrad [Prozent], bisherige Tester [Anzahl], Budget [Betrag], Zeit pro Woche [Stunden].
Grenzen: Ziel in drei Monaten [Ziel].
Ich tendiere zu: [Option] weil [Grund].
${ASK}`,
  },
  {
    id: "investition",
    title: "Geld ausgeben oder investieren",
    hint: "Werbung, Anschaffung, Kredit",
    text: `Entscheidung: Soll ich [Betrag] für [Zweck] ausgeben?
Optionen: A) den ganzen Betrag jetzt, B) in Etappen mit einem Zwischenziel, C) nichts ausgeben.
Meine Zahlen: Rücklagen [Betrag], Einnahmen pro Monat [Betrag], erwarteter Ertrag [Betrag in Zeitraum], schlechtester Fall [Betrag].
Grenzen: Entscheidung bis [Datum].
Ich tendiere zu: [Option] weil [Grund].
${ASK}`,
  },
];
