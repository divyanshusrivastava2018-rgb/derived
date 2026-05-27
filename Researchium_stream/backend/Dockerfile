FROM node:18-alpine

WORKDIR /app

# FFmpeg (transcoding), build tools (bcrypt), vips (optional sharp)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    vips-dev \
    fftw-dev

COPY package.json ./
RUN npm install --omit=dev \
    && npm install sharp --omit=dev --no-save 2>/dev/null || true

COPY . .

ENV NODE_ENV=production
ENV STUDIO_BACKEND_HOST=0.0.0.0
ENV STUDIO_BACKEND_PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.STUDIO_BACKEND_PORT||5000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
