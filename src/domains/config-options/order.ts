/** Sort config options: sortOrder 1,2,3… first; 0 (no order) last; then by number. */
export function compareConfigOptionOrder<
  T extends { sortOrder?: number | null; number?: number | null },
>(a: T, b: T): number {
  const ao = Number(a.sortOrder ?? 0);
  const bo = Number(b.sortOrder ?? 0);
  if (ao === 0 && bo === 0) {
    return Number(a.number ?? 0) - Number(b.number ?? 0);
  }
  if (ao === 0) return 1;
  if (bo === 0) return -1;
  if (ao !== bo) return ao - bo;
  return Number(a.number ?? 0) - Number(b.number ?? 0);
}
