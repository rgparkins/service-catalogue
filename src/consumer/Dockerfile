FROM node:lts-alpine3.23

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app
RUN npm install

CMD ["npm", "start"]
