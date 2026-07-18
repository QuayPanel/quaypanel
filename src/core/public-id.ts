/** Public sequential IDs look like `1`, `42` (not cuids / INV-… strings). */
export function isPublicNumberId(idOrNumber: string | number) {
  return /^\d+$/.test(String(idOrNumber));
}
