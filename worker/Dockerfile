FROM node:20-bullseye

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

CMD ["npm", "run", "dev"]
