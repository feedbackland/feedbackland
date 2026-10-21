export function revision(value: string): string {
  if (!/^[1-9][0-9]*$/.test(value) || BigInt(value) > 9223372036854775807n)
    throw new Error("Invalid revision");
  return value;
}
