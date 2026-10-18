# syntax=docker/dockerfile:1
FROM node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
COPY feedbackland-react/package.json ./feedbackland-react/package.json
RUN npm ci --no-audit --no-fund
COPY . .
ARG SOURCE_COMMIT
RUN mkdir -p public
RUN --network=none npm run build
RUN rm -rf .next/standalone/node_modules/sharp .next/standalone/node_modules/@img \
    && test ! -e .next/standalone/node_modules/sharp \
    && test ! -e .next/standalone/node_modules/@img

FROM node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 KEEP_ALIVE_TIMEOUT=65000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/LICENSE ./LICENSE
COPY --from=build /app/lib/build-identity.json ./build-identity.json
USER node
EXPOSE 3000
ENTRYPOINT []
CMD ["node", "server.js"]
