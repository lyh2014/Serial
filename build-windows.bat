@echo off
chcp 65001 >nul
echo ====================================================
echo   SerialPulse 串口调试助手 - Windows .exe 构建脚本
echo ====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 18+ (https://nodejs.org)
  pause
  exit /b 1
)

echo [1/3] 安装依赖包 (npm install)...
call npm install --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 (
  echo [错误] 依赖安装失败，请检查网络连接或 npm 镜像源。
  pause
  exit /b 1
)

echo [2/3] 构建前端资源并打包 Windows .exe...
call npm run dist:win
if errorlevel 1 (
  echo [错误] 打包失败，请查看上方日志。
  pause
  exit /b 1
)

echo.
echo [3/3] 打包完成！输出文件位于 release\ 目录：
dir /b release\*.exe
echo.
pause
