FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc make libc6-dev \
    && rm -rf /var/lib/apt/lists/*
COPY . .
COPY --from=frontend /app/dist ./dist
RUN make
CMD ["python3", "ui/app.py"]
