Feature: Getting Metadata
  Scenario: Getting the latest
    Given I GET /metadata/schema
    Then response code should be 200
    And response body should be valid json
    And I store the value of response header location as location in global scope