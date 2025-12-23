Feature: Creating valid metadata
  Scenario: Posting brand new valid metadata and fetching
    Given I pipe contents of file assets/2.0.0/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /services/metadata/domaina.service8
    Then response code should be 201
    And response header location should exist
    And I store the value of response header location as location in global scope
    When I GET `location`
    Then response code should be 200
    And response body should be valid json