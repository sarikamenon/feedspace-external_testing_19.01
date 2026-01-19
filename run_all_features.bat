@echo off
setlocal enabledelayedexpansion
set "exit_code=0"

echo Running Text Review Feature...
call npx cucumber-js features/text_review.feature
if %errorlevel% neq 0 (
    echo Text Review Feature failed!
    set "exit_code=1"
)

echo Running Media Upload Feature...
call npx cucumber-js features/media_upload.feature
if %errorlevel% neq 0 (
    echo Media Upload Feature failed!
    set "exit_code=1"
)

echo Running Wall of Love Feature...
call npx cucumber-js features/wol.feature
if %errorlevel% neq 0 (
    echo Wall of Love Feature failed!
    set "exit_code=1"
)

if %exit_code% neq 0 (
    echo Some tests failed. Exiting with error.
    exit /b %exit_code%
)

echo All tests passed!
