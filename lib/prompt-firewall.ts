// Prompt-Injection-Firewall – läuft im Browser (Vorwarnung) und auf dem Server (Durchsetzung).

const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i, label: "ignore previous instructions" },
  { pattern: /disregard\s+(all\s+)?(your|the|previous)\s+(instructions|rules|guidelines)/i, label: "disregard instructions" },
  { pattern: /(reveal|show|print|repeat|leak)\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions|hidden\s+prompt)/i, label: "reveal system prompt" },
  { pattern: /you\s+are\s+now\s+(DAN|in\s+developer\s+mode|jailbroken|unrestricted)/i, label: "jailbreak persona" },
  { pattern: /\bdo\s+anything\s+now\b/i, label: "DAN jailbreak" },
  { pattern: /(developer|god|sudo)\s+mode\s+(enabled|on|activated)/i, label: "developer mode" },
  { pattern: /ignoriere\s+(alle\s+)?(vorherigen|bisherigen|obigen)\s+(anweisungen|instruktionen|regeln)/i, label: "ignoriere vorherige Anweisungen" },
  { pattern: /(zeige|verrate|gib)\s+(mir\s+)?(deinen|den)\s+system[\s-]?prompt/i, label: "System-Prompt verraten" },
  { pattern: /<\s*\/?\s*(system|im_start|im_end)\s*>/i, label: "Rollen-Token-Spoofing" },
  { pattern: /^\s*\[\s*(system|moderator|KI\s*[–-][^\]]*)\s*\]\s*:/im, label: "Sprecher-Spoofing" },
];

export interface InjectionCheckResult {
  flagged: boolean;
  matches: string[];
}

export function checkPromptInjection(input: string): InjectionCheckResult {
  const matches = INJECTION_PATTERNS.filter(({ pattern }) => pattern.test(input)).map(({ label }) => label);
  return { flagged: matches.length > 0, matches };
}
