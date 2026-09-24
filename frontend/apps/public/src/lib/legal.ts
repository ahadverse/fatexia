/**
 * Single source of truth for the operator identity shown on Terms, Privacy, the
 * Publisher/Advertiser Agreements, the footer, and the Organization JSON-LD — one
 * place to correct if the address ever changes, instead of five.
 *
 * Fatexia has no separate registered legal entity; deliberately no individual's name
 * is published here either — every reference is to "Fatexia" plus this address, not
 * to a person. Do not invent a "Ltd."/"Inc." suffix, a registration number, or a name
 * that isn't meant to be public.
 */

// Structured once so the Organization JSON-LD's PostalAddress and the plain-text
// LEGAL_ADDRESS shown on-page can't drift apart into two different addresses.
export const LEGAL_ADDRESS_PARTS = {
  streetAddress: 'Rýmařovská 163',
  postalCode: '793 56',
  addressLocality: 'Ryžoviště',
  addressCountry: 'CZ',
};
export const LEGAL_ADDRESS = `${LEGAL_ADDRESS_PARTS.streetAddress}, ${LEGAL_ADDRESS_PARTS.postalCode} ${LEGAL_ADDRESS_PARTS.addressLocality}, Czechia`;

export const LEGAL_JURISDICTION = 'Czech Republic';
export const LEGAL_EMAIL = 'hello@fatexia.com';
