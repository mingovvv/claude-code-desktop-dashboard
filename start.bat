@echo off
cd /d "%~dp0"
echo Claude Dashboard 시작 중...
node_modules\.bin\electron-forge start
pause
