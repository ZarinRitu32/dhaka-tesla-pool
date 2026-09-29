FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["sh", "-c", "(npx prisma migrate deploy || npx prisma db push) && node prisma/seed.js && node src/server.js"]