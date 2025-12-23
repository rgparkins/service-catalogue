Feature: Validating a document
  Scenario: Validating a document valid against an old schema with the latest schema
    Given I pipe contents of file assets/1.0.2/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /metadata/validate
    Then response code should be 202
  Scenario: Validating a document valid against the latest schema with the latest schema
    Given I pipe contents of file assets/2.0.0/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /metadata/validate
    Then response code should be 200
  Scenario: Validating an invalid document
    Given I pipe contents of file assets/invalid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /metadata/validate
    Then response code should be 400
  Scenario: Validating against an unknown schema
    Given I pipe contents of file assets/2.0.0/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /metadata/validate/23.0.0
    Then response code should be 404
  Scenario: Validating against a specific version of schema
    Given I pipe contents of file assets/2.0.0/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /metadata/validate/2.0.0
    Then response code should be 200
  Scenario: Validating against a specific version of schema with wrong version of payload
    Given I pipe contents of file assets/1.0.2/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /metadata/validate/2.0.0
    Then response code should be 400