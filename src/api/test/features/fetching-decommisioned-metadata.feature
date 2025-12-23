Feature: Getting Decommissioned Metadata
  Scenario: Decommissioning
    Given I pipe contents of file assets/2.0.0/valid-service-metadata.json to body
    And I set Content-Type header to application/json
    When I POST to /services/metadata/domaina.service8
    Then response code should be 201
    When I DELETE /services/metadata/domaina.service8
    Then response code should be 200
    When I GET /services/decommissioned
    Then response body path $ should be of type array with length 1
