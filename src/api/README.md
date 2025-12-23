# engineering.service-catalogue-api

This API provides the following:

1. Sanitised metadata for all valid services
2. A source of truth for our current schema that services should conform to.
3. Versioned json schema for consumers to validate against.
4. Historical data on each service and its status
5. Endpoints for displayed services that have failed on save and the reasons for failure.

## Endpoints
### LIVE
https://engineering-service-catalogue-api.maiya.io/openapi

### UAT
https://engineering-service-catalogue-api-uat.vassily.io/openapi

##  How do I get into the service catalogue with my service?

The easiest way is to POST to `https://engineering-service-catalogue-api.maiya.io/services/metadata/[NAME_OF_SERVICE]` attaching your service metadata file as data.

This endpoint saves your metadata to the catalogue when validated, or return you the schema failures on your content

For prod this would look like the following if you are inside the repo of your service.
```
FILE=service.metadata.json
URL="https://engineering-service-catalogue-api.maiya.io/services/metadata/$(cat $FILE | jq -r .name)"

curl -X POST -H "Content-Type: application/json" -d @$FILE $URL
```
 

##  How do I remove my service from the service catalogue when it's decommissioned?

You need to DELETE to `https://engineering-service-catalogue-api.maiya.io/services/metadata/[NAME_OF_SERVICE]`

This moves the metadata to a decommissioned status so that it no longer shows up as a live service.  

## How to check what schemas are currently live?

On your browser go to `https://engineering-service-catalogue-api.maiya.io` this will detail the schemas and versions

##  How do I validate my schema?

The easiest way is to POST to `https://engineering-service-catalogue-api.maiya.io/metadata/validate`

It should be noted that the endpoint can either return

1. 200 if the payload is validated against the current schema
2. 202 if the payload is validated against an old schema. 

In 202 status code circumstances the team should actively look to update the metadata to conform to the latest schema
 before that schema version is decommissioned

From the repository root you should be able to run the following script (requires curl and jq):
```
FILE=service.metadata.json
URL="https://engineering-service-catalogue-api.maiya.io/metadata/validate"

curl -X POST -H "Content-Type: application/json" -d @$FILE $URL
```
 
In order to help the development experience another endpoint:

`https://engineering-service-catalogue-api.maiya.io/metadata/validate/:version` exists so consumers can validate
 against a specific version of schema

## What if I have multiple services from one repo?

There is an extra element to the process should you have multiple services deployed with a single github repo. In
 this case you cannot have the correct dependencies assigned OR the correct service name in the service metadata. An
  example of this would be anything that is clustered.
   1. Create a `domaina.service-cluster1` and `domaina.service-cluster2` service.
   2. Each service will consume a different dependency
   
Under these conditions there are 2 ways that teams could implement the correct servicename and dependencies

#### Solution A

1. Create a service metadata for each specific service this repo supports. 
2. Validate both on CI, and POST each specifically on each CD  

#### Solution B

1. CReate a templated service metadata
2. Replace the dependency and servicename at CI / CD time.

## How do I go green on immunisation

1. Implement in a job on your CI pipeline to perform a curl to validate your metadata via POST. This task should FAIL
 the build IF a 200 or a 202 is not detected
2. Implement in a job on your CD pipeline a perform a curl to POST your metadata. This job should FAIL the deploy if
 the POST fails.
 
> NOTE
>
> UAT/Test deployments should POST to the UAT service catalogue.
>
> Live deployments should POST to the LIVE service catalogue 

An example script executer to validate would be as follows:

```shell script
#!/usr/bin/env bash
VALIDATION_ENDPOINT="https://engineering-service-catalogue-api.maiya.io/metadata/validate"
PATH_FOR_METADATA=./service.metadata.json
echo "Using metadata path $PATH_FOR_METADATA"

if [ ! -f $PATH_FOR_METADATA ]; then
echo "File not found!"
exit 1
fi

RESPONSE=$(curl -d @$PATH_FOR_METADATA -o -I -L -s -w "%{http_code}" -H "Content-Type: application/json" -X POST ${VALIDATION_ENDPOINT})

if [ "$RESPONSE" -eq "400" ]
then
curl -d @$PATH_FOR_METADATA -w "%{http_code}" -H "Content-Type: application/json" -X POST ${VALIDATION_ENDPOINT}

exit 1
fi
```

An example script executor in go for saving your data to the catalogue is as follows 

```shell script
#!/usr/bin/env bash

POST_ENDPOINT="https://engineering-service-catalogue-api.maiya.io/services/metadata/[NAME_OF_SERVICE]]"
PATH_FOR_METADATA=./service.metadata.json

echo "Using metadata path $PATH_FOR_METADATA"

if [ ! -f $PATH_FOR_METADATA ]; then
echo "File not found!"
exit 1
fi

RESPONSE=$(curl -d @$PATH_FOR_METADATA -o -I -L -s -w "%{http_code}" -H "Content-Type: application/json" -X POST ${POST_ENDPOINT})

if [ "$RESPONSE" -ne "201" ]
then
curl -d @$PATH_FOR_METADATA -w "%{http_code}" -H "Content-Type: application/json" -X POST ${POST_ENDPOINT}

exit 1
fi
```

## What is the rollout process of our schema?

Teams will be informed of the new version of schema being implemented via

1. BCE forum
2. Tech forum

It will be the responsibility of the leadership within the teams to communicate these changes down and to raise
 specific jira tasks to conform to the new schema. A date for removal of the old schema will be agreed and
  communicated at these forums.
 
The previous version of the schema will be supported for a defined period at which point it will no longer be valid, and
 thus teams pipelines will fail.
 
## How do I get an external service in the catalogue?

Add your external metadata to the [external](./external-services)
