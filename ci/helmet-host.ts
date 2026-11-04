import helmet from "helmet";
import { createAuthWidgetHost } from "../scripts/e2e/widget-host";

/** Real Helmet defaults, with only the widget's documented CSP additions. */
export function createHelmetHost(board: string) {
  const middleware = helmet({
    contentSecurityPolicy: {
      directives: {
        frameSrc: [board],
        connectSrc: ["'self'", board],
        upgradeInsecureRequests: null,
      },
    },
  });
  return createAuthWidgetHost((handler) => (request, response) => {
    middleware(request, response, (error) => {
      if (error) {
        response.writeHead(500).end();
        return;
      }
      void handler(request, response);
    });
  });
}
