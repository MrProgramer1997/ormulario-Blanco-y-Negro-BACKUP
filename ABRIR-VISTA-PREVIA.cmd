@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Instala Node.js o abre revision-2026/index.html con Live Server de VS Code.
 pause
 exit /b 1
)
start "Blanco y Negro - Vista previa" cmd /k node tools\serve.mjs
timeout /t 2 >nul
start http://localhost:4173
