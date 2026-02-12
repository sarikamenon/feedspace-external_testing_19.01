Feature: Multi-URL Data-Driven Widget Testing from Excel

  @MultiUrlExcel
  Scenario: Validate all widgets defined in Excel
    Given I read the widget URLs from "testData/widgetUrls.xlsx"
    Then I sequentially validate each widget URL
