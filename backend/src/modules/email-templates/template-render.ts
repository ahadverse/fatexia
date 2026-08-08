const MACRO_PATTERN = /\{([a-z0-9_]+)\}/gi;

// Templates are validated at save time (assertMacrosDeclared) so every macro in a
// body is one the caller declared it would supply — a still-missing value renders
// blank rather than leaking the literal `{token}` into a real inbox.
export function substituteMacros(text: string, macros: Record<string, string>): string {
  return text.replace(MACRO_PATTERN, (_match, key: string) => macros[key] ?? '');
}

// Plain text → HTML lives in infra/email/email-layout.ts, which renders the branded
// shell as well. Deliberately not duplicated here: two text-to-HTML paths would drift,
// and the bare <p> version this file used to hold was the one that shipped unstyled.
