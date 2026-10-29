import { getOperatorInfo } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impressum – Multimodell-Chat" };

/** Anbieterkennzeichnung (§ 5 DDG). Angaben stammen aus OPERATOR_* – Prüfung durch den Betreiber nötig. */
export default function ImpressumPage() {
  const op = getOperatorInfo();
  return (
    <LegalPage title="Impressum">
      {!op.configured && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
          Die Betreiberangaben sind noch nicht konfiguriert. Ohne vollständiges Impressum darf die App nicht öffentlich angeboten werden.
        </p>
      )}
      <section>
        <h2 className="font-semibold text-ink">Angaben gemäß § 5 DDG</h2>
        <p className="mt-2 whitespace-pre-line">
          {op.name}
          {"\n"}
          {op.address}
        </p>
        {op.representative && <p className="mt-2">Vertreten durch: {op.representative}</p>}
      </section>
      <section>
        <h2 className="font-semibold text-ink">Kontakt</h2>
        <p className="mt-2">
          E-Mail: <a href={`mailto:${op.email}`}>{op.email}</a>
          {op.phone && (
            <>
              <br />
              Telefon: {op.phone}
            </>
          )}
        </p>
      </section>
      {op.vatId && (
        <section>
          <h2 className="font-semibold text-ink">Umsatzsteuer-ID</h2>
          <p className="mt-2">{op.vatId}</p>
        </section>
      )}
      <section>
        <h2 className="font-semibold text-ink">Hinweis zu KI-Inhalten</h2>
        <p className="mt-2">
          Antworten im Chat werden von KI-Modellen erzeugt (OpenAI, Anthropic, Google u. a. über OpenRouter). Sie können falsch sein
          und stellen keine Beratung dar.
        </p>
      </section>
    </LegalPage>
  );
}
