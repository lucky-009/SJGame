#!/bin/bash

# SJGame 一键启动脚本

SERVER_DIR="/home/admin/SJGame/server"
FRONTEND_DIR="/home/admin/SJGame/frontend"

echo "=== 启动 SJGame 服务 ==="

# 检查目录是否存在
if [ ! -d "$SERVER_DIR" ]; then
    echo "❌ 后端目录不存在: $SERVER_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 检查 MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB 未安装，请确保本地 MongoDB 已启动"
fi

# 安装后端依赖
if [ ! -d "$SERVER_DIR/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd "$SERVER_DIR" && npm install --production
fi

# 安装前端依赖
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd "$FRONTEND_DIR" && npm install
fi

# 检查 PM2
if command -v pm2 &> /dev/null; then
    echo "🚀 使用 PM2 启动服务..."
    
    # 启动后端
    pm2 start "$SERVER_DIR/src/index.js" --name "sjgame-server" || pm2 restart sjgame-server
    
    # 启动前端
    cd "$FRONTEND_DIR"
    pm2 start npm --name "sjgame-frontend" -- run preview -- --host 0.0.0.0 --port 5173 || pm2 restart sjgame-frontend
    
    echo ""
    echo "=== 服务已启动 ==="
    pm2 status
else
    echo "⚠️  PM2 未安装，使用前台模式启动..."
    echo "请手动安装 PM2: npm install -g pm2"
    echo ""
    
    # 后台启动后端
    cd "$SERVER_DIR" && npm start &
    SERVER_PID=$!
    
    # 后台启动前端
    cd "$FRONTEND_DIR" && npm run preview -- --host 0.0.0.0 --port 5173 &
    FRONTEND_PID=$!
    
    echo ""
    echo "=== 服务已启动 ==="
    echo "后端 PID: $SERVER_PID (端口 3000)"
    echo "前端 PID: $FRONTEND_PID (端口 5173)"
    echo ""
    echo "按 Ctrl+C 停止服务"
    
    wait
fi
