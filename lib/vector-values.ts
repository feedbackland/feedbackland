// pgvector's cosine implementation accumulates squared components in float32.
// Reject norms which cannot reliably survive that arithmetic on supported CPUs.
export function validCosineVector(
  input: unknown,
  width: number,
): input is number[] {
  if (!Array.isArray(input) || input.length !== width || width < 1)
    return false;
  const half = width > 2000;
  let squaredNorm = 0;
  for (const value of input) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (half && Math.abs(value) > 65504)
    )
      return false;
    const stored = half && Math.abs(value) <= 2 ** -25 ? 0 : Math.fround(value);
    squaredNorm += Math.fround(stored * stored);
  }
  return squaredNorm >= 2 ** -126 && Number.isFinite(Math.fround(squaredNorm));
}
