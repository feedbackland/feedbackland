export function boardHref(
  path = "/",
  surface?: "drawer" | null,
  mode?: string | null,
): string {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Board links must be root relative");
  const url = new URL(path, "https://board.invalid");
  if (surface) {
    url.searchParams.set("embed", surface);
    if (mode === "dark" || mode === "light") url.searchParams.set("mode", mode);
  }
  return url.pathname + url.search + url.hash;
}
