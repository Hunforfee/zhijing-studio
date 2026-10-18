FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# The system FFmpeg is installed above; skip the redundant binary download.
RUN npm ci --omit=dev --ignore-scripts
COPY . .
ENV HOST=0.0.0.0 PORT=4173 FFMPEG_PATH=/usr/bin/ffmpeg
EXPOSE 4173
CMD ["npm", "start"]
