FROM node:20-slim
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./

ENV PORT=7860
EXPOSE 7860
CMD ["node", "server.js"]
