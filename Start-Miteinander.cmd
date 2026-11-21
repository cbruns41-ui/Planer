@echo off
cd /d "%~dp0"
echo.
echo Miteinander startet auf http://localhost:3100
echo Nutzername: Bruns
echo Passwort bei der ersten Anmeldung: Test1234
echo.
call npm.cmd start
pause
