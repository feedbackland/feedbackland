import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/trpc";
import { createContext as createTRPCContext } from "@/lib/trpc";
import { mutationGuard } from "@/lib/http/mutation-guard";

const handler = async (req: Request) => {
  if (req.method === "POST") {
    const rejected = mutationGuard(req);
    if (rejected) return rejected;
  }
  const context = await createTRPCContext({ req });
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => context,
    responseMeta: () => ({ headers: context.responseHeaders }),
  });
};

export { handler as GET, handler as POST };
