import "server-only";

import { getAuth } from "@/lib/auth/server";
export function updateUserQuery({
  name,
  headers,
}: {
  name: string;
  headers: Headers;
}) {
  return getAuth().api.updateUser({ body: { name }, headers });
}
