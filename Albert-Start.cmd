@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js 24+ kerak. & pause & exit /b 1)
node -e "process.exit(Number(process.versions.node.split('.')[0])>=24?0:1)" || (echo Node.js 24+ kerak. & pause & exit /b 1)
node scripts/setup.mjs || (pause & exit /b 1)
echo Albert Agent Space - http://127.0.0.1:8787
node --env-file-if-exists=.env src/server.mjs
if errorlevel 1 pause
