/**
 * SJGame 服务端入口文件
 * 负责初始化 Express 服务器和 Socket.IO 连接
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

// 导入路由
const authRoutes = require('./modules/auth/routes');
const roomRoutes = require('./modules/room/routes');

// 导入 Socket 处理器
const socketHandler = require('./socket/handler');

// 导入游戏房间管理器
const GameRoomManager = require('./modules/game/room/GameRoomManager');

// 初始化 Express 应用
const app = express();
const server = http.createServer(app);

// 初始化 Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件配置
app.use(cors());
app.use(express.json());

// API 路由
app.set('io', io);
app.use('/api/auth', authRoutes);
app.use('/api/room', roomRoutes);

// 根路由 - 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SJGame Server Running' });
});

// 初始化游戏房间管理器
const gameRoomManager = new GameRoomManager(io);
app.set('gameRoomManager', gameRoomManager);

// 挂载 Socket 处理器
socketHandler(io, gameRoomManager);

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjgame')
  .then(() => {
    console.log('✅ MongoDB 连接成功');
  })
  .catch(err => {
    console.error('❌ MongoDB 连接失败:', err);
  });

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SJGame 服务端已启动，监听端口 ${PORT}`);
});

// 优雅关闭处理
process.on('SIGTERM', async () => {
  console.log('📦 收到 SIGTERM 信号，开始关闭服务器...');
  server.close(() => {
    console.log('✅ HTTP 服务器已关闭');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB 连接已关闭');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io, gameRoomManager };
