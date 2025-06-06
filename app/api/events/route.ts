// src/app/api/events/route.ts

import { emitter } from "@/lib/event-emitter";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const onMessage = (data: any) => {
        // Format the data as a Server-Sent Event
        const eventString = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(eventString));
      };

      emitter.on("message", onMessage);

      req.signal.onabort = () => {
        emitter.removeListener("message", onMessage);
        console.log("Client disconnected, closing stream.");
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
