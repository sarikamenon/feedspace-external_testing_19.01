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
    And user validates structural integrity of the widget
    And user validates card consistency and content
    And verify that no review dates are undefined
    And verify that review text is not overflowing
    And verify optional UI elements if present
    And user performs generic accessibility audit
    Then generate the final audit report


  @media_error
  Scenario: Verify media loading error handling
    Given user simulates media loading failures
    And verify that no review dates are undefined
    And verify that review text is not overflowing
    And user validates structural integrity of the widget
    Then verify that broken media is reported as an error
    Then generate the final audit report

  @mobile_ux
  Scenario: Validate Mobile UI/UX Quality
    Given user opens the Wall of Love page
    When user resizes window to mobile view
    Then at least one review should be displayed
    And user validates structural integrity of the widget
    And user validates card consistency and content
    And verify that no review dates are undefined
    And verify that review text is not overflowing
    And verify optional UI elements if present
    And user performs generic accessibility audit
    Then generate the final audit report



