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
