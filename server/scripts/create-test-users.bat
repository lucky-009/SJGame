@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo SJGame 测试用户创建工具
echo ========================================
echo.

:: 检查Node.js是否安装
echo [1/3] 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js
    echo 请先安装Node.js: https://nodejs.org
    echo 安装后请重新运行此脚本
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js已安装: %NODE_VERSION%
echo.

:: 检查MongoDB服务
echo [2/3] 检查MongoDB服务...
sc query MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: MongoDB服务未运行
    echo 请先启动MongoDB服务:
    echo   net start MongoDB
    echo 或者检查MongoDB是否已安装
    pause
    exit /b 1
)

echo ✅ MongoDB服务正在运行
echo.

:: 运行创建测试用户脚本
echo [3/3] 创建测试用户...
echo 正在执行脚本，请稍候...
echo.

node "%~dp0create-test-users.js"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ 测试用户创建完成！
    echo ========================================
    echo.
    echo 📝 测试账户信息:
    echo   用户名: test1, 密码: 123456, 昵称: 测试玩家1
    echo   用户名: test2, 密码: 123456, 昵称: 测试玩家2
    echo   用户名: test3, 密码: 123456, 昵称: 测试玩家3
    echo   用户名: test4, 密码: 123456, 昵称: 测试玩家4
    echo   用户名: admin, 密码: admin123, 昵称: 管理员
    echo.
    echo 🎉 现在可以使用这些账户登录游戏了！
) else (
    echo.
    echo ========================================
    echo ❌ 测试用户创建失败
    echo ========================================
    echo 请检查错误信息并重试
)

echo.
echo 按任意键关闭窗口...
pause >nul