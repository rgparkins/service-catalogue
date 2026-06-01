Feature: Public signup tenant uniqueness
  Scenario: Creating the same tenant twice returns conflict
    Given I set Content-Type header exactly to application/json

    Given I set body to {"tenantId":"duptenant","adminEmail":"duptenant.admin@example.com"}
    When I POST to /public/signup
    Then response code should be 201

    Given I set body to {"tenantId":"duptenant","adminEmail":"duptenant.admin@example.com"}
    When I POST to /public/signup
    Then response code should be 409

