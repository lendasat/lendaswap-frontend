const REFERRAL_CODE_KEY = "lendaswap_referral_code";

export function setReferralCode(code: string): void {
  localStorage.setItem(REFERRAL_CODE_KEY, code);
}

export function getReferralCode(): string | null {
  return localStorage.getItem(REFERRAL_CODE_KEY);
}

export function hasReferralCode(): boolean {
  return localStorage.getItem(REFERRAL_CODE_KEY) !== null;
}

export function clearReferralCode(): void {
  localStorage.removeItem(REFERRAL_CODE_KEY);
}

export function validateReferralCode(code: string): boolean {
  // Must be exactly 15 characters (letters and numbers)
  return /^[A-Za-z0-9]{15}$/.test(code);
}
