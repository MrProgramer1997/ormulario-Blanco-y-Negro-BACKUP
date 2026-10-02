@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js LTS y vuelve a abrir este archivo.
  echo No se modifico el proyecto.
  pause
  exit /b 1
)
node "tools\deploy.mjs"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo El proceso necesita revision. Lee el mensaje anterior.
pause
exit /b %RESULT%
