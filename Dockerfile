FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package*.json ./

RUN npm install
RUN npx playwright install-deps

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]