import "server-only";

/** Betreiberangaben für Impressum und Datenschutzerklärung – aus der Konfiguration, nie hartkodiert. */
export interface OperatorInfo {
  name: string;
  address: string;
  email: string;
  phone: string | null;
  representative: string | null;
  vatId: string | null;
  configured: boolean;
}

export function getOperatorInfo(): OperatorInfo {
  const name = process.env.OPERATOR_NAME?.trim() ?? "";
  const address = process.env.OPERATOR_ADDRESS?.trim() ?? "";
  const email = process.env.OPERATOR_EMAIL?.trim() ?? "";
  return {
    name: name || "[Betreiber – OPERATOR_NAME setzen]",
    address: address || "[Anschrift – OPERATOR_ADDRESS setzen]",
    email: email || "[E-Mail – OPERATOR_EMAIL setzen]",
    phone: process.env.OPERATOR_PHONE?.trim() || null,
    representative: process.env.OPERATOR_REPRESENTATIVE?.trim() || null,
    vatId: process.env.OPERATOR_VAT_ID?.trim() || null,
    configured: Boolean(name && address && email),
  };
}
