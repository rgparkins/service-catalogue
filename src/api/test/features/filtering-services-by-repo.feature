Feature: Filtering services by repo
  Scenario: Searching by repo across all schema versions
    Given I pipe contents of file assets/2.0.0/valid-service-metadata-service1.json to body
    And I set Content-Type header to application/json
    When I POST to /services/metadata/domaina.service1
    Then response code should be 201
    When I update payload from file assets/2.0.0/valid-service-metadata-service4.json to body
    When I POST to /services/metadata/domainb.service4
    Then response code should be 201
    When I update payload from file assets/2.0.0/valid-service-metadata-service3.json to body
    When I POST to /services/metadata/domaina.service3
    Then response code should be 201
    When I GET /services/metadata?repo=eng.service71
    Then response body path $ should be of type array with length 1
    When I GET /services?repo=eng.service71
    Then response body path $ should be of type array with length 1