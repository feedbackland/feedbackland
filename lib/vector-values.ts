// Cosine distance is undefined for a zero vector. Validate at the storage
// precision too: an underflowed vector cannot participate in an HNSW scan.
export function validCosineVector(
  input: unknown,
  width: number,
): input is number[] {
  if (!Array.isArray(input) || input.length !== width) return false;
  const half = width > 2000;
  let nonzero = false;
  for (const value of input) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(Math.fround(value)) ||
      (half && Math.abs(value) > 65504)
    )
      return false;
    if (half ? Math.abs(value) > 2 ** -25 : Math.fround(value) !== 0)
      nonzero = true;
  }
  return nonzero;
}
