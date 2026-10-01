FROM node:24-alpine AS build
WORKDIR /app
# El postinstall genera el cliente de Prisma: necesita el esquema antes de instalar.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 4000
# Cada arranque aplica las migraciones pendientes y la semilla (idempotente).
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
