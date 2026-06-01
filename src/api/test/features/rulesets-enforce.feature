Feature: Rulesets enforcement
  Scenario: Service metadata update is rejected when a ruleset fails
    Given I store the raw value test-admin-key as adminKey in scenario scope
    And I set Content-Type header exactly to application/json

    # Create a tenant
    Given I set bearer token to `adminKey`
    And I set body to {"tenantId":"rulesettenant","companyName":"Ruleset Tenant","billingEmail":"rulesettenant@example.com","plan":"pro"}
    When I POST to /accounts
    Then response code should be 201
    And I store the value of body path $.apiKey as tenantApiKey in scenario scope

    # Add ruleset: service.name must start with "domaina."
    Given I set bearer token to `tenantApiKey`
    And I set body to {"name":"Service name prefix","field":"service.name","pattern":"^domaina\\\\..+$","enabled":true}
    When I POST to /rulesets
    Then response code should be 201

    # Attempt to post a service with a name that fails the rule
    Given I set bearer token to `tenantApiKey`
    And I set body to {"name":"domainb.badservice","team":"Newton","repo":"org/repo","dependencies":{"critical":[],"non-critical":[]},"events":{"consumes":[],"produces":[]},"endpoints":[]}
    When I POST to /services/metadata/domainb.badservice
    Then response code should be 400

