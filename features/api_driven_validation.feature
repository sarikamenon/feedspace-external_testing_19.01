@ApiDriven
Feature: API Driven Widget Validation
  As a QA Engineer
  I want to fetch a list of widget URLs from a developer-provided API
  And perform comprehensive validation on each widget sequentially
  So that I can verify the functionality and integrity of all customer widgets dynamically.

  Scenario: Validate Widgets from Dev API
    Given I load the developer API URL from "dev_api_config.json"
    When I fetch the widget list from the developer API
    Then I iterate through each customer URL and perform the following:
      | Step | Description |
      | 1    | Load Widget URL |
      | 2    | Identify all Widget(s) on the page (supports multiple per URL) |
      | 3    | Generate Incremental Report |
