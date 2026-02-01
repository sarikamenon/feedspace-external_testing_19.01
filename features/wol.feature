@wol
Feature: Wall of Love – Minimal & Configurable Validation

  Background:
    Given user opens the Wall of Love page

  Scenario: Validate Wall of Love page essentials
    Then page title should be visible
    And page heading should be visible

  Scenario: Validate reviews presence and content
    Then at least one review should be displayed

  Scenario: Validate optional elements if present
    Then Feedspace branding should be validated only if present
    And platform logo should be validated only if present
    And carousel should be validated only if present



  @accessibility
  Scenario: Validate accessibility standards
    Then the page should meet accessibility standards

  @generic_ux
  Scenario: Validate Generic UI/UX Quality
    Then at least one review should be displayed
    And user validates structural integrity of the Wall of Love
    And user validates card consistency and content for Wall of Love
    And verify that no review dates are undefined for Wall of Love
    And verify that review text is not overflowing for Wall of Love
    And verify optional UI elements if present on Wall of Love
    And user performs accessibility audit for Wall of Love



  @media_error
  Scenario: Verify media loading error handling
    Given user simulates media loading failures
    And verify that no review dates are undefined for Wall of Love
    And verify that review text is not overflowing for Wall of Love
    And user validates structural integrity of the Wall of Love
    Then verify that broken media is reported as an error for Wall of Love


  @mobile_ux
  Scenario: Validate Mobile UI/UX Quality
    Given user opens the Wall of Love page
    When user resizes window to mobile view
    Then at least one review should be displayed
    And user validates structural integrity of the Wall of Love
    And user validates card consistency and content for Wall of Love
    And verify that no review dates are undefined for Wall of Love
    And verify that review text is not overflowing for Wall of Love
    And verify optional UI elements if present on Wall of Love
    And user performs accessibility audit for Wall of Love




