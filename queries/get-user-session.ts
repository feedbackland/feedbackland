import "server-only";
// P04 replaces this disabled bridge with Better Auth's session lookup.
export async function getUserSessionQuery(): Promise<
  import("@/hooks/use-auth").Session
> {
  return null;
}
