import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/trpc";
import { createContext as createTRPCContext } from "@/lib/trpc";

// Generating insights sends several batches of feedback to the model and
// waits for all of them. The default 15s ceiling cuts that off on any board
// larger than a demo.
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
  });

export { handler as GET, handler as POST };
