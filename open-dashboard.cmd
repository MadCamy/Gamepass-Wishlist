@echo off
rem Refreshes the data and opens the dashboard. Point a desktop shortcut here.
cd /d "%~dp0"
echo Refreshing Game Pass Watch...
call npm run -s dashboard
if errorlevel 1 (
  echo.
  echo Refresh failed ^(offline, or Steam/Microsoft didn't respond^).
  if exist site\index.html (
    echo Opening the last saved dashboard instead.
    start "" site\index.html
  )
  pause
)
