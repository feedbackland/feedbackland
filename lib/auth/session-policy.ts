// Shared presentation/server predicate. Server writes always reload these
// fields under the membership lock; a client-supplied role is never authority.
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export type SessionIdentity = {
  user: { id: string; role?: string };
  session: {
    id: string;
    userId: string;
    scope?: string | null;
    createdAt: Date | string;
    expiresAt: Date | string;
  };
};
export function canAdministerSession(
  value: SessionIdentity | null | undefined,
  now = Date.now(),
) {
  if (!value) return false;
  const created = new Date(value.session.createdAt).getTime();
  const expires = new Date(value.session.expiresAt).getTime();
  return (
    value.user.id === value.session.userId &&
    value.user.role === "admin" &&
    value.session.scope === "first-party" &&
    Number.isFinite(created) &&
    created <= now &&
    created > now - ADMIN_SESSION_MAX_AGE_MS &&
    expires > now
  );
}
