Feature: Fetching the latest reference

  Scenario: Getting team list from latest schema
    Given I GET /reference/teams
    Then response body path $ should be of type array with length 44

  Scenario: Getting pillar list from latest schema
    Given I GET /reference/pillars
    Then response code should be 200
