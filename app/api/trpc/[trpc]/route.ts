import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/trpc";
import { createContext as createTRPCContext } from "@/lib/trpc";
import { mutationGuard } from "@/lib/http/mutation-guard";

import {
  boundedRequest,
  BodyError,
  discardBody,
} from "@/lib/http/limited-body";
const handler = async (req: Request) => {
  if (req.method === "POST") {
    const rejected = mutationGuard(req);
    if (rejected) {
      discardBody(req);
      return rejected;
    }
    try {
      req = await boundedRequest(req, 256 * 1024);
    } catch (error) {
      if (error instanceof BodyError) return error.response();
      throw error;
    }
  }
  const context = await createTRPCContext({ req });
  context.responseHeaders?.set("Cache-Control", "private, no-store");
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    allowMethodOverride:
      req.method === "POST" &&
      new URL(req.url).pathname
        .split("/")
        .at(-1)!
        .split(",")
        .every(
          (path) => path === "getFeedbackPosts" || path === "getActivityFeed",
        ),
    req,
    router: appRouter,
    createContext: () => context,
    responseMeta: () => ({ headers: context.responseHeaders }),
  });
};

export { handler as GET, handler as POST };
