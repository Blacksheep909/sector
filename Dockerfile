# SECTOR server for any container host (Fly.io, Koyeb, a VPS, ...). No dependencies to install.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js profiles.js filter.js ./
COPY shared ./shared
COPY public ./public
# public mode: no host panel, no LAN addresses, no browser launch, plain logs
ENV SECTOR_PUBLIC=1 SECTOR_NO_OPEN=1 SECTOR_PLAIN=1 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
