/**
 * Checks if a string is a valid Lightning address format
 * @param address - String to validate (e.g., "user@domain.com")
 * @returns true if valid Lightning address format
 */
export function isLightningAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Lightning address format: username@domain.tld
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(address);
}

/**
 * Checks if a string is a BOLT11 Lightning invoice
 * @param invoice - String to validate
 * @returns true if valid BOLT11 invoice format
 */
export function isBolt11Invoice(invoice: string): boolean {
  if (!invoice || typeof invoice !== "string") return false;

  // BOLT11 invoices start with ln + network prefix (bc, tb, bcrt)
  return /^ln(bc|tb|bcrt)[0-9][a-z0-9]+$/i.test(invoice);
}
