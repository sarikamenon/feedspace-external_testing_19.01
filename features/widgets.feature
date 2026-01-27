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
    And I generate the final UI audit report for "DetectedWidget"

  @WidgetTest
  Scenario Outline: Validate embedded widget UI and functionality
    Given I load the widget URL for type "<widgetType>"
    Then the framework should dynamically detect the widget as "<widgetType>"
    And the widget should be visible and contain at least <minReviews> reviews
    And the widget should follow the layout and branding guidelines
    And I verify the widget-specific unique behaviors for "<widgetType>"
    And user validates card consistency and content
    And verify that no review dates are undefined
    And verify that review text is not overflowing
    And verify optional UI elements if present
    And user performs generic accessibility audit
    And user validates structural integrity of the widget
    And verify that broken media is reported as an error
    And I verify widget responsiveness on mobile
    And I generate the final UI audit report for "<widgetType>"

    Examples:
      | widgetType   | minReviews |
      | Carousel     | 1          |
      | Masonry      | 1          |
      | StripSlider  | 1          |
      | AvatarGroup  | 1          |
      | AvatarSlider | 1          |
      | VerticalScroll | 1        |
      | HorizontalScroll | 1      |
      | FloatingCards | 1         |
