export function boardHref(path = "/", surface?: "drawer" | null): string {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Board links must be root relative");
  const url = new URL(path, "https://board.invalid");
  if (surface) url.searchParams.set("embed", surface);
  return url.pathname + url.search + url.hash;
}
