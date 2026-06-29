@echo off
cd /d D:\project1\newAIProject\adblock-easylist-detector
call node build.mjs
echo EXIT_CODE=%ERRORLEVEL%
