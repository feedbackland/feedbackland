# Test tools only. The application container still runs the exact candidate image.
FROM node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315
RUN apt-get update \
    && apt-get install -y --no-install-recommends dnsmasq-base strace \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /observer/lib \
    && cp /usr/bin/strace /observer/strace \
    && ldd /usr/bin/strace | awk '/=> \// {print $3}' | xargs -r -I '{}' cp -L '{}' /observer/lib/
