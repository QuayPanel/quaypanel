/** Common disposable / throwaway email domains (subset). */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "grr.la",
  "sharklasers.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "throwaway.email",
]);

export function isDisposableEmailDomain(domain: string) {
  return DISPOSABLE_EMAIL_DOMAINS.has(domain.toLowerCase());
}
