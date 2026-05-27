FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY api/package.json ./
RUN npm install --omit=dev

COPY api/src ./src
COPY shared ./shared

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV API_PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
