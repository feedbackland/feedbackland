import "server-only";
import { db } from "@/app/db/db";
// import { getXataClient } from "@/app/db/xata";

// const xata = getXataClient();

export const getUserByEmail = async (email: string) => {
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email)
    .executeTakeFirst();
  return user;
};

// export const getUserByEmail2 = async (email: string) => {
//   const user = await xata.db.users.filter({ email }).getFirst();
//   return user;
// };
