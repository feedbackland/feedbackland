/** Stable identity shared by search controls, the query cache and PostgreSQL. */
export function canonicalSearchText(value: string) {
  return Array.from(value.trim().normalize("NFC")).slice(0, 200).join("");
}

/** Keep the typed phrase for navigation once it meets the UI's two-character minimum. */
export function searchInputValue(value: string) {
  return Array.from(canonicalSearchText(value)).length >= 2 ? value : "";
}
