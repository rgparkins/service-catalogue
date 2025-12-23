Feature: Fetching a metadata schema document
  Scenario: Fetch latest metadata schema
    Given I GET /metadata/schema
    Then response code should be 200

  Scenario: Fetch version of metadata schema
    Given I GET /metadata/schema/2.0.0
    Then response code should be 200

  Scenario: Fetch unknown version of metadata schema
    Given I GET /metadata/schema/1.0.22
    Then response code should be 404