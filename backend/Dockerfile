FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm install typescript -g && npm run build

EXPOSE 3001

CMD ["npm", "start"]
