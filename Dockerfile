FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node public ./public
COPY --chown=node:node third-party ./third-party
COPY --chown=node:node LICENSE ./LICENSE
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV OFFICE_HOST=0.0.0.0 OFFICE_PORT=8787 OFFICE_DATA=/app/data OFFICE_RUNTIME=docker
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+process.env.OFFICE_PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.mjs"]
