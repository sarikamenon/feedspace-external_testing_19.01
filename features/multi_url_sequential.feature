Feature: Multi-URL Sequential Widget Testing

  As a QA Engineer
  I want to validate all widgets across multiple customer URLs
  So that I can ensure UI, functionality, and accessibility are consistent

  @MultiURL
  Scenario: Load multiple customer URLs sequentially and audit widgets
    Given I fetch the list of customer URLs from "GoogleSheet"
    Then I sequentially process each URL by executing the following workflow:
      | 1. Detect the specific widget type (e.g., Carousel, Masonry) |
      | 2. Run the corresponding @Individual_<Widget> steps          |
      | 3. Verify widget persistence after page reload               |
      | 4. Validate mobile responsiveness                            |
      | 5. Generate a single consolidated report per URL             |
