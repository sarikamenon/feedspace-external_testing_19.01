@echo off
echo Running Text Review Feature...
call npx cucumber-js features/text_review.feature
if %errorlevel% neq 0 exit /b %errorlevel%

echo Running Media Upload Feature...
call npx cucumber-js features/media_upload.feature
if %errorlevel% neq 0 exit /b %errorlevel%

echo Running Wall of Love Feature...
call npx cucumber-js features/wol.feature
if %errorlevel% neq 0 exit /b %errorlevel%

echo All tests passed!
