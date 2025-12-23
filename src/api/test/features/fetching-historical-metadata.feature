Feature: Fetching history for metadata
  Scenario: Creating multiple versions of the same file
    Given I pipe contents of file assets/2.0.0/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /services/metadata/domaina.service8
    Then response code should be 201
    When I POST to /services/metadata/domaina.service8
    Then response code should be 201
    When I POST to /services/metadata/domaina.service8
    Then response code should be 201
    And I store the value of response header location as location in global scope
    When I GET /services/metadata/domaina.service8/history
    Then response code should be 200
    And response body should be valid json