Feature: Root endpoint
  Scenario: Fetching information
    When I GET /
    Then response code should be 200
    And response body path $.metadata.schemas should be of type array with length 2
    And response body path $.metadata.decommissioned-schemas should be of type array with length 1