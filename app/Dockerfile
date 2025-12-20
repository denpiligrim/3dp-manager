FROM node:20-alpine

WORKDIR /app
COPY package.json ./

RUN npm install --production

COPY index.js .
COPY builders ./builders

CMD ["node", "index.js"]