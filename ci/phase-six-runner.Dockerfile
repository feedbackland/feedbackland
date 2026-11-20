# Match the Playwright version in package-lock.json and the Ubuntu CI host.
FROM docker:29.1.5-cli@sha256:931f63d7100eb6734405d92d8bd9f4aa708c587510e5cc673bb9ac196a3d733f AS docker_cli
FROM node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315 AS node_toolchain
FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f
COPY --from=docker_cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker_cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
COPY --from=node_toolchain /usr/local/bin/node /opt/verification-node/bin/node
COPY --from=node_toolchain /usr/local/lib/node_modules/npm /opt/verification-node/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /opt/verification-node/bin/npm
ENV PATH=/opt/verification-node/bin:$PATH
