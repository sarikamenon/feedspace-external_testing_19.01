Feature: Media Upload Submission
  As a user submitting feedback
  I want to upload media files
  So that valid files are accepted and invalid files show proper error messages

  Background:
    Given media user loads media scenarios from JSON

  # -----------------------------
  # Valid Video Upload
  # -----------------------------
  @validvideo
  Scenario: Submit review with valid video upload
    Given media user opens media review form for scenario "SCN006"
    When media user clicks on the Upload Video/Audio button
    And media user uploads the media file
    And media user enters user details
    And media user clicks the Submit button
    Then media user should see success message
    And media user closes the browser

  # -----------------------------
  # Invalid Video Duration
  # -----------------------------
  @invalidmedia
  Scenario: Upload video longer than 1 minute
    Given media user opens media review form for scenario "SCN007"
    When media user clicks on the Upload Video/Audio button
    And media user uploads the media file
    And media user enters user details
    And media user clicks the Submit button
    Then media user should see error message
    And media user closes the browser

  # -----------------------------
  # Invalid Image Upload
  # -----------------------------
  @invalidimage
  Scenario: Upload image file instead of video
    Given media user opens media review form for scenario "SCN008"
    When media user clicks on the Upload Video/Audio button
    And media user uploads the media file
   Then media user should see error message
    And media user closes the browser

  # -----------------------------
  # Invalid Audio Upload
  # -----------------------------
  @invalidaudio
  Scenario: Upload audio file instead of video
    Given media user opens media review form for scenario "SCN009"
    When media user clicks on the Upload Video/Audio button
    And media user uploads the media file
    Then media user should see error message
    And media user closes the browser

  # -----------------------------
  # Valid Audio Upload
  # -----------------------------
  @validaudio
  Scenario: Submit review with valid audio upload
    Given media user opens media review form for scenario "SCN010"
    When media user clicks on the Upload Audio button
    And media user uploads the media file
    And media user enters user details
    And media user clicks the Submit button
    Then media user should see success message
    And media user closes the browser


  