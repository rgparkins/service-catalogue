#!/usr/bin/env bash

# Repository-root test runner (copied and adjusted from src/api/test.sh)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/src/api"

cleanup() {
  docker stop app || true
  docker stop mongodb || true
  # remove the network only if it exists
  if docker network ls --filter name=^dockernet$ -q >/dev/null 2>&1; then
    docker network rm dockernet || true
  fi
  echo "....Cleaning up done"
}

error() {
  echo ">>>>>> Test Failures Found, exiting test run <<<<<<<<<"
  echo
  echo ===========================================================
  echo Printing logs from APP container
  echo ===========================================================
  echo
  docker logs app || true
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
trap error ERR

ifne () {
        read line || return 1
        (echo "$line"; cat) | eval "$@"
}

docker network create -d bridge dockernet

echo
echo ===========================================================
echo building app
echo ===========================================================
echo

docker build -t sc_app "$API_DIR/app"

echo
echo ===========================================================
echo Building test
echo ===========================================================
echo

docker build -t sc_test "$API_DIR/test"

echo
echo ===========================================================
echo Running mongodb stub
echo ===========================================================
echo

docker run --rm -d -p "27017:27017" \
             -e MONGO_INITDB_DATABASE=service-catalogue \
             --network dockernet \
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
  --name app -v "$API_DIR/test/assets/test-schemas":/usr/src/app/test-schemas \
  --network dockernet \
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
             --network dockernet \
             sc_test

