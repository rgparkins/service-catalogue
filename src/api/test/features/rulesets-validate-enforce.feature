Feature: Rulesets enforcement on validate endpoints
  Scenario: Validate endpoint rejects payload when a ruleset fails
    Given I store the raw value test-admin-key as adminKey in scenario scope
    And I set Content-Type header exactly to application/json

    # Create a tenant
    Given I set bearer token to `adminKey`
    And I set body to {"tenantId":"rulesetvalidate","companyName":"Ruleset Validate","billingEmail":"rulesetvalidate@example.com","plan":"pro"}
    When I POST to /accounts
    Then response code should be 201
    And I store the value of body path $.apiKey as tenantApiKey in scenario scope

    # Add ruleset: service.name must start with "domaina."
    Given I set bearer token to `tenantApiKey`
    And I set body to {"name":"Service name prefix","field":"service.name","pattern":"^domaina\\\\..+$","enabled":true}
    When I POST to /rulesets
    Then response code should be 201

    # Validate a payload that fails the rule (rulesets are applied before schema validation)
    Given I set bearer token to `tenantApiKey`
    And I set body to {"name":"domainb.badservice"}
    When I POST to /metadata/validate
    Then response code should be 400

