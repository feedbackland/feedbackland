import { z } from "zod/v4";
export const isPostId = (value: string) => z.uuid().safeParse(value).success;
