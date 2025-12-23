#!/usr/bin/env bash

cleanup() {
#  docker-compose down

  docker stop app || true

  docker stop mongodb || true

  docker network rm dockernet

  echo "....Cleaning up done"
}

error() {
  echo ">>>>>> Test Failures Found, exiting test run <<<<<<<<<"

  echo
  echo ===========================================================
  echo Printing logs from APP container
  echo ===========================================================
  echo

  docker logs app

  echo
  echo ===========================================================
  echo End of logs from APP container
  echo ===========================================================
  echo

  docker rm app || true
  docker rm mongodb || true

  exit 1
}

trap cleanup EXIT

docker network create -d bridge dockernet

trap error ERR
trap cleanup EXIT

ifne () {
        read line || return 1
        (echo "$line"; cat) | eval "$@"
}

echo
echo ===========================================================
echo building app
echo ===========================================================
echo

docker build -t sc_app ./app

echo
echo ===========================================================
echo Building test
echo ===========================================================
echo


docker build -t sc_test ./test

echo
echo ===========================================================
echo Running mongodb stub
echo ===========================================================
echo

docker run --rm -d -p "27017:27017" \
             -e MONGO_INITDB_DATABASE=service-catalogue \
             --net=dockernet \
             --name mongodb \
             mongo:latest

sleep 10

echo
echo ===========================================================
echo Running app
echo ===========================================================
echo

docker run --rm -d \
  -e MONGODB_ATLAS_URI=mongodb://mongodb:27017 \
  -e SCHEMA_BASE_PATH=/usr/src/app/test-schemas \
  --name app -v "$(pwd)"/test/assets/test-schemas:/usr/src/app/test-schemas \
  --net=dockernet \
  sc_app

sleep 10

echo
echo ===========================================================
echo Running tests container
echo ===========================================================
echo

docker run --rm \
             -e MONGODB_ATLAS_URI=mongodb://mongodb:27017 \
             -e SERVICE_UNDER_TEST_HOSTNAME=app:3000 \
             --name sc_test \
             --net=dockernet \
             sc_test