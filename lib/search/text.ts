/** Stable identity shared by search controls, the query cache and PostgreSQL. */
export function canonicalSearchText(value: string) {
  return Array.from(value.trim().normalize("NFC")).slice(0, 200).join("");
}
