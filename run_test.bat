@echo off
cd /d D:\project1\newAIProject\adblock-easylist-detector
call node_modules\.bin\vitest.cmd run
echo EXIT_CODE=%ERRORLEVEL%
