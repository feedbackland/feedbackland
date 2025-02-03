"server-only";

import { db } from "@/db/db";

export const createOrg = async ({
  orgName,
  orgSubdomain,
}: {
  orgName: string;
  orgSubdomain: string;
}) => {
  try {
    const org = await db
      .insertInto("org")
      .values({
        name: orgName,
        subdomain: orgSubdomain,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return org;
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new Error("duplicate subdomain");
    }

    throw error;
  }
};

// export const createOrg = async ({
//   userId,
//   orgName,
//   orgSubdomain,
// }: {
//   userId: string;
//   orgName: string;
//   orgSubdomain: string;
// }) => {
//   try {
//     const result = await db.transaction().execute(async (trx) => {
//       const org = await trx
//         .insertInto("org")
//         .values({
//           name: orgName,
//           subdomain: orgSubdomain,
//         })
//         .returning("id")
//         .executeTakeFirstOrThrow();

//       await trx
//         .insertInto("user_org")
//         .values({
//           user_id: userId,
//           org_id: org.id,
//           role: "admin",
//         })
//         .returningAll()
//         .executeTakeFirst();
//     });

//     return result;
//   } catch (error: any) {
//     if (error?.code === "23505") {
//       throw new Error("duplicate subdomain");
//     }

//     throw error;
//   }
// };
