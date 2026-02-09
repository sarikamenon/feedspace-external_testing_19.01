Feature: Embedded Web Widget Testing

  As a QA Engineer
  I want to validate different types of embedded web widgets (Carousel, Masonry, etc.)
  So that I can ensure their UI, functionality, and accessibility are consistent and correct.

  @DynamicWidgetTest
  Scenario: Load URL and dynamically detect embedded widget
    Given I load the widget URL
    Then the framework should dynamically detect the widget as "Auto"
    And the widget should be visible and contain at least 1 reviews
    And the widget should follow the layout and branding guidelines
    And I perform a comprehensive UI audit
    And I save the intermediate report for "DetectedWidget"
    When I reload the page to verify persistence
    Then I verify widget responsiveness on mobile
    And I generate the final UI audit report for "DetectedWidget"

