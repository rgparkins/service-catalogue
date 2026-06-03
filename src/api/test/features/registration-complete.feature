Feature: Registration completion
  Scenario: Complete registration creates Keycloak user and finalizes token
    And I set Content-Type header exactly to application/json

    # Create tenant + registration token
    Given I set body to {"tenantId":"regtenant","adminEmail":"reg.admin@example.com","adminName":"Reg Admin"}
    When I POST to /public/signup
    Then response code should be 201
    And I store the value of body path $.registrationToken as regToken in scenario scope

    # Token can be fetched
    When I GET /public/registration/`regToken`
    Then response code should be 200

    # Complete registration: creates Keycloak user + password + tenant admin group
    Given I set body to {"password":"StrongPassw0rd!"}
    When I POST to /public/registration/`regToken`/complete
    Then response code should be 200

    # Token is now completed
    When I GET /public/registration/`regToken`
    Then response code should be 409

