import { getOperatorInfo } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Datenschutz – SynthrAI" };

/**
 * Datenschutzerklärung, abgeglichen mit docs/idea-to-app/11-daten.md und 16-recht.md.
 * Entwurf – rechtliche Prüfung durch den Betreiber/Fachperson vor dem Launch (dort [PRÜFEN]).
 */
export default function DatenschutzPage() {
  const op = getOperatorInfo();
  const h2 = "font-semibold text-ink";
  return (
    <LegalPage title="Datenschutzerklärung">
      <p className="text-[13px] text-muted">Stand: 29. Oktober 2026</p>

      <section>
        <h2 className={h2}>1. Verantwortlicher</h2>
        <p className="mt-2 whitespace-pre-line">
          {op.name}
          {"\n"}
          {op.address}
          {"\n"}E-Mail: {op.email}
        </p>
      </section>

      <section>
        <h2 className={h2}>2. Welche Daten wir verarbeiten und wozu</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink">
                <th className="py-2 pr-3">Zweck</th>
                <th className="py-2 pr-3">Daten</th>
                <th className="py-2 pr-3">Rechtsgrundlage</th>
                <th className="py-2">Speicherdauer</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-line">
                <td className="py-2 pr-3">Konto & Anmeldung</td>
                <td className="py-2 pr-3">E-Mail-Adresse, Passwort (nur als Hash beim Login-Dienst), Anmeldezeitpunkte</td>
                <td className="py-2 pr-3">Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO</td>
                <td className="py-2">bis zur Löschung des Kontos</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-3">Debatten (Kernfunktion)</td>
                <td className="py-2 pr-3">deine Nachrichten, KI-Antworten, Agenten-Einstellungen, Zusammenfassungen</td>
                <td className="py-2 pr-3">Art. 6 Abs. 1 lit. b DSGVO</td>
                <td className="py-2">bis du den Verlauf, die Debatte oder dein Konto löschst</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-3">Abrechnung & Kontingent</td>
                <td className="py-2 pr-3">Tarif, Token-Verbrauch, Stripe-Kunden- und Abo-ID</td>
                <td className="py-2 pr-3">Art. 6 Abs. 1 lit. b und c DSGVO</td>
                <td className="py-2">Kontolaufzeit; Rechnungsdaten bei Stripe nach gesetzlichen Fristen</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-3">Sicherheit & Missbrauchsschutz</td>
                <td className="py-2 pr-3">IP-Adresse und Konto-ID (Rate-Limit-Zähler), Sicherheitsprotokolle ohne Inhalte</td>
                <td className="py-2 pr-3">berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO</td>
                <td className="py-2">Zähler höchstens 1 Stunde; Protokolle 30 Tage</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">Eigener API-Key (optional)</td>
                <td className="py-2 pr-3">dein OpenRouter-Key, verschlüsselt gespeichert</td>
                <td className="py-2 pr-3">Art. 6 Abs. 1 lit. b DSGVO</td>
                <td className="py-2">bis du ihn entfernst, den Tarif wechselst oder das Konto löschst</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className={h2}>3. KI-Funktionen und Weitergabe an KI-Anbieter</h2>
        <p className="mt-2">
          Damit die KI-Agenten antworten können, senden wir bei jeder Antwort einen Ausschnitt deines Debattenverlaufs (die letzten
          Nachrichten laut „Sliding Window“), die System-Prompts der Agenten und ggf. eine Zusammenfassung älterer Nachrichten an
          den Vermittlungsdienst <strong>OpenRouter</strong> (OpenRouter, Inc., USA). OpenRouter leitet die Anfrage an den Anbieter des
          gewählten Modells weiter (z. B. OpenAI, Anthropic, Google). Wir fordern dabei ausschließlich Anbieter an, die Eingaben nicht
          speichern oder für Training nutzen (Einstellung „data collection: deny“).
        </p>
        <p className="mt-2">
          <strong>Gib keine sensiblen Daten</strong> (z. B. Gesundheitsdaten, Passwörter, Daten Dritter) in den Chat ein. Antworten
          werden automatisch von KI erzeugt, können falsch sein und sind als KI-Inhalte gekennzeichnet. Es finden keine
          automatisierten Entscheidungen mit rechtlicher Wirkung über dich statt.
        </p>
      </section>

      <section>
        <h2 className={h2}>4. Empfänger und Auftragsverarbeiter</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Supabase (Datenbank und Anmeldung) – Speicherort gemäß gewählter Projektregion</li>
          <li>Vercel (Hosting der App)</li>
          <li>Upstash (Zähler für Anfrage-Limits, nur IP/Konto-ID)</li>
          <li>OpenRouter und die jeweiligen Modellanbieter (siehe Abschnitt 3)</li>
          <li>Stripe (Zahlungsabwicklung, nur bei kostenpflichtigen Tarifen)</li>
        </ul>
        <p className="mt-2">
          Soweit Daten in die USA übermittelt werden, geschieht das auf Grundlage des EU-US Data Privacy Framework bzw. von
          Standardvertragsklauseln der EU-Kommission (Art. 44 ff. DSGVO).
        </p>
      </section>

      <section>
        <h2 className={h2}>5. Cookies</h2>
        <p className="mt-2">
          Wir verwenden ausschließlich technisch notwendige Cookies für deine Anmeldung (Sitzung). Es gibt kein Tracking und keine
          Analyse-Dienste.
        </p>
      </section>

      <section>
        <h2 className={h2}>6. Deine Rechte</h2>
        <p className="mt-2">
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21
          DSGVO) sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Unter <strong>Tarif & Verbrauch → Konto</strong> kannst
          du deine Daten jederzeit selbst als Datei exportieren und dein Konto mit allen Daten löschen. Für alle anderen Anliegen:{" "}
          <a href={`mailto:${op.email}`}>{op.email}</a>.
        </p>
      </section>

      <section>
        <h2 className={h2}>7. Sicherheit</h2>
        <p className="mt-2">
          Übertragung nur verschlüsselt (HTTPS), Zugriffsschutz auf Datenbankebene, verschlüsselte Speicherung eigener API-Keys,
          Begrenzung von Anfragen. Ein Restrisiko lässt sich nie ausschließen.
        </p>
      </section>
    </LegalPage>
  );
}
