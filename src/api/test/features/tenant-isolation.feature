Feature: Tenant data isolation
  Scenario: A tenant cannot access another tenant's service metadata
    Given I store the raw value test-admin-key as adminKey in scenario scope
    And I set Content-Type header exactly to application/json

    # Create tenant1
    Given I set bearer token to `adminKey`
    And I set body to {"tenantId":"tenant1","companyName":"Tenant One","billingEmail":"tenant1@example.com","plan":"pro"}
    When I POST to /accounts
    Then response code should be 201
    And I store the value of body path $.apiKey as tenant1ApiKey in scenario scope

    # Create tenant2
    Given I set bearer token to `adminKey`
    And I set body to {"tenantId":"tenant2","companyName":"Tenant Two","billingEmail":"tenant2@example.com","plan":"pro"}
    When I POST to /accounts
    Then response code should be 201
    And I store the value of body path $.apiKey as tenant2ApiKey in scenario scope

    # Tenant1 writes metadata for a service
    Given I set bearer token to `tenant1ApiKey`
    And I pipe contents of file assets/2.0.0/valid-service-metadata-service1.json to body
    When I POST to /services/metadata/domaina.service1
    Then response code should be 201

    # Tenant1 can read it back
    Given I set bearer token to `tenant1ApiKey`
    When I GET /services/metadata/domaina.service1
    Then response code should be 200

    # Tenant2 cannot read tenant1's data
    Given I set bearer token to `tenant2ApiKey`
    When I GET /services/metadata/domaina.service1
    Then response code should be 404

    # Tenant2 should not see tenant1's service in lists
    Given I set bearer token to `tenant2ApiKey`
    When I GET /services
    Then response code should be 200
    And response body should be valid json
    And response body path $ should be of type array with length 0
