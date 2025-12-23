Feature: Fetching unknown metadata
  Scenario: Fetching a service thats not in the catalogue
    Given I GET /services/metadata/unknown
    Then response code should be 404