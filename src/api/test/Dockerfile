FROM ghcr.io/rgparkins/apickli:latest
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm install

ENTRYPOINT ["npm", "test"]