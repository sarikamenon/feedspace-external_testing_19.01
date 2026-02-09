@Individual
Feature: Individual Widget Validation (Dedicated)
  As a QA Engineer
  I want to validate specific widget types individually using specific URLs
  So that I can troubleshoot single components in isolation.

  @Individual_Carousel
  Scenario: Validate Carousel Widget Functional and Media Integrity
    Given I initiate testing for "Carousel" widget
    Then the individual framework detects "Carousel"
    And the individual widget should be visible with valid reviews
    And I verify individual widget-specific behaviors for "Carousel"
    And individual verify optional UI elements if present
    And individual user performs generic accessibility audit
    And I save the intermediate individual report for "Carousel"
    When I reload the widget page
    Then the individual framework detects "Carousel"
    And individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "Carousel"

  @Individual_Masonry
  Scenario: Validate Masonry Widget Functional and Media Integrity
    Given I initiate testing for "Masonry" widget
    Then the individual framework detects "Masonry"
    And the individual widget should be visible with valid reviews
    And individual verify that no review dates are undefined
    And individual verify that review text is not overflowing
    And individual verify optional UI elements if present
    And I verify individual widget-specific behaviors for "Masonry"
    And individual user performs generic accessibility audit
    And individual verify that broken media is reported as an error
    And individual user validates structural integrity of the widget
    And I save the intermediate individual report for "Masonry"
    When I reload the widget page
    Then individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "Masonry"

  @Individual_StripSlider
  Scenario: Validate StripSlider Widget Functional Integrity
    Given I initiate testing for "StripSlider" widget
    Then the individual framework detects "StripSlider"
    And the individual widget should be visible with valid reviews
    And individual verify that no review dates are undefined
    And individual verify that review text is not overflowing
    And individual verify optional UI elements if present
    And I verify individual widget-specific behaviors for "StripSlider"
    And individual user performs generic accessibility audit
    And individual verify that broken media is reported as an error
    And individual user validates structural integrity of the widget
    And I save the intermediate individual report for "StripSlider"
    When I reload the widget page
    Then individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "StripSlider"

  @Individual_AvatarGroup
  Scenario: Validate AvatarGroup Widget Functional Integrity
    Given I initiate testing for "AvatarGroup" widget
    Then the individual framework detects "AvatarGroup"
    And the individual widget should be visible with valid reviews
    And individual verify that no review dates are undefined
    And individual verify that review text is not overflowing
    And individual verify optional UI elements if present
    And I verify individual widget-specific behaviors for "AvatarGroup"
    And individual user performs generic accessibility audit
    And individual verify that broken media is reported as an error
    And individual user validates structural integrity of the widget
    And I save the intermediate individual report for "AvatarGroup"
    When I reload the widget page
    Then individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "AvatarGroup"

  @Individual_AvatarSlider
  Scenario: Validate AvatarSlider Widget Comprehensive Compliance
    Given I initiate testing for "AvatarSlider" widget
    Then the individual framework detects "AvatarSlider"
    And the individual widget should be visible with valid reviews
    And I verify AvatarSlider navigation buttons are functional and correct
    And I verify AvatarSlider media loads successfully across slides
    And I verify AvatarSlider review counts and classifications match
    And individual verify that review text is not overflowing
    And individual user validates structural integrity of the widget
    And I verify individual widget-specific behaviors for "AvatarSlider"
    And individual user performs generic accessibility audit
    And I save the intermediate individual report for "AvatarSlider"
    When I reload the widget page
    Then I verify AvatarSlider review counts and classifications match
    And I verify AvatarSlider branding is displayed and clickable
    And individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "AvatarSlider"

  @Individual_VerticalScroll
  Scenario: Validate VerticalScroll Widget Comprehensive Compliance
    Given I initiate testing for "VerticalScroll" widget
    Then the individual framework detects "VerticalScroll"
    And the individual widget should be visible with valid reviews
    And I verify VerticalScroll scrolling behavior is smooth and continuous
    And I verify VerticalScroll media loads and plays correctly
    And I verify VerticalScroll Read More/Read Less functionality
    And I verify VerticalScroll review counts and classifications match
    And individual verify that no review dates are undefined
    And individual verify that review text is not overflowing
    And individual verify optional UI elements if present
    And I verify individual widget-specific behaviors for "VerticalScroll"
    And individual user performs generic accessibility audit
    And individual verify that broken media is reported as an error
    And individual user validates structural integrity of the widget
    And I save the intermediate individual report for "VerticalScroll"
    When I reload the widget page
    Then the individual framework detects "VerticalScroll"
    And I verify VerticalScroll review counts and classifications match
    And individual verify widget responsiveness on mobile

  @Individual_HorizontalScroll
  Scenario: Validate HorizontalScroll Widget Comprehensive Compliance
    Given I initiate testing for "HorizontalScroll" widget
    Then the individual framework detects "HorizontalScroll"
    And the individual widget should be visible with valid reviews
    And I verify HorizontalScroll scrolling behavior is smooth and continuous
    And I verify HorizontalScroll media loads and plays correctly
    And I verify HorizontalScroll Read More/Read Less functionality
    And I verify HorizontalScroll review counts and classifications match
    And individual verify that no review dates are undefined
    And individual verify that review text is not overflowing
    And individual verify optional UI elements if present
    And I verify individual widget-specific behaviors for "HorizontalScroll"
    And individual user performs generic accessibility audit
    And individual verify that broken media is reported as an error
    And individual user validates structural integrity of the widget
    And I save the intermediate individual report for "HorizontalScroll"
    When I reload the widget page
    Then the individual framework detects "HorizontalScroll"
    And I verify HorizontalScroll review counts and classifications match
    And individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "HorizontalScroll"

  @Individual_FloatingCards
  Scenario: Validate FloatingCards Widget Comprehensive Compliance
    Given I initiate testing for "FloatingCards" widget
    Then the individual framework detects "FloatingCards"
    And I verify Floating Widget container loads successfully
    And the individual widget follows layout and branding guidelines
    And I verify Floating Widget popup sequence and interaction
    And I verify Floating Widget media playback and loading
    And I verify Floating Widget Read More / Read Less functionality
    And I verify Floating Widget review counts and classifications
    And individual verify that review text is not overflowing
    And individual verify that no review dates are undefined
    And individual user validates structural integrity of the widget
    And individual user performs generic accessibility audit
    And individual verify widget responsiveness on mobile
    And I generate the individual final UI audit report for "FloatingCards"

