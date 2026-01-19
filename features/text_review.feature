Feature: Text Review Form Submission via Public Link
  As an external user
  I want to submit feedback using a public review form
  So that my review is recorded or appropriate messages are shown

  Background:
    Given user loads test data from JSON file

  # -----------------------------
  # Successful Submission
  # -----------------------------
  @success
  Scenario: Submit text review with valid data
    Given user opens public review form for scenario "SCN001"
    When user clicks on the Write Your Experience button
    And user enters the feedback in the submit feedback field
    And user clicks on the Submit Feedback button
    And user enters the user details
    And user clicks on the Final Submit button
    Then user should see success confirmation message
    And user closes the browser

  # -----------------------------
  # Mandatory Field Validation
  # -----------------------------
  @mandatory
  Scenario: Validate mandatory fields in text review form
    Given user opens public review form for scenario "SCN002"
    When user clicks on the Write Your Feedback button
    And user enters the review text
    And user clicks on the Submit Feedback button
    And user clicks on the Final Submit button
    Then user should see mandatory field validation messages
    And user closes the browser

  # -----------------------------
  # Inactive Form Validation
  # -----------------------------
  @inactive
  Scenario: Access inactive public text review form
    Given user opens public review form for scenario "SCN003"
    Then user should see inactive form message
    And user closes the browser

  # -----------------------------
  # Media Upload Submission
  # -----------------------------
  @media
  Scenario: Submit text review with media upload
    Given user opens public review form for scenario "SCN004"
    When user clicks on the Write Your Experience button
    And user enters the review text
    And user uploads the media file
    And user clicks on the Submit Feedback button
    And user enters the user details
    And user clicks on the Final Submit button
    Then user should see success confirmation message
    And user closes the browser

  # -----------------------------
  # Thank You Page Verification
  # -----------------------------
  @thankui  
  Scenario: Validate Thank You page UI elements after submission
    Given user opens public review form for scenario "SCN005"
    When user clicks on the Write Your Experience button
    And user enters the review text
    And user clicks on the Submit Feedback button
    And user enters the user details
    And user clicks on the Final Submit button
    Then user should be navigated to the Thank You page
    And share link text should have a non-empty value
    And platform buttons section should be visible and contain values
    And the following social icons should be displayed:
      | WhatsApp |
      | X        |
      | LinkedIn |
      | Facebook |
    And Thank You page header text should be "Thank You!"
    And Thank You page description text should be "Your feedback has been successfully submitted. Thank you for sharing!"
    And signup button text should be "Got it, let's signup"
