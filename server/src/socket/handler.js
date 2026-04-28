/**
 * Socket 处理器
 * 处理 WebSocket 连接和游戏事件
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const RoomPlayer = require('../models/RoomPlayer');
const GameRoomManager = require('../modules/game/room/GameRoomManager');

// 存储在线用户
const onlineUsers = new Map();  // userId -> { socketId, username }

// 存储 socketId -> userId 映射
const socketToUser = new Map();

// 广播房间列表更新
async function broadcastRoomList(io) {
  try {
    const rooms = await Room.find({ status: 'waiting' })
      .select('roomCode status currentRound levelA levelB created_at')
      .populate('ownerId', 'username')
      .sort({ created_at: -1 })
      .limit(50);

    const roomsWithCount = await Promise.all(
      rooms.map(async (room) => {
        const playerCount = await RoomPlayer.countDocuments({ roomId: room._id });
        return {
          id: room._id,
          roomCode: room.roomCode,
          status: room.status,
          levelA: room.levelA,
          levelB: room.levelB,
          playerCount,
          createdAt: room.created_at
        };
      })
    );

    io.emit('room:list_updated', { rooms: roomsWithCount });
  } catch (error) {
    console.error('广播房间列表失败:', error);
  }
}

/**
 * 认证 Socket 连接
 */
async function authenticateSocket(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const user = await User.findById(decoded.userId);
    if (!user) return null;
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Socket 事件处理器
 */
function setupSocketHandlers(io, gameRoomManager) {
  io.on('connection', async (socket) => {
    console.log(`🔌 新连接: ${socket.id}`);

    // 认证
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.emit('auth:failed', { message: '未提供 token' });
      socket.disconnect();
      return;
    }

    const user = await authenticateSocket(token);
    if (!user) {
      socket.emit('auth:failed', { message: '无效的 token' });
      socket.disconnect();
      return;
    }

    // 保存用户信息
    onlineUsers.set(user._id.toString(), {
      socketId: socket.id,
      username: user.username,
      userId: user._id
    });
    socketToUser.set(socket.id, user._id.toString());

    socket.userId = user._id.toString();
    socket.username = user.username;

    console.log(`✅ 用户已认证: ${user.username} (${socket.id})`);

    // 加入房间
    socket.on('room:join', async (data, callback) => {
      try {
        console.log(`[事件] room:join - user: ${socket.username}`, { payload: data });
        const { roomCode } = data;

        // 查找房间
        const room = await Room.findOne({ roomCode });
        if (!room) {
          return callback({ success: false, message: '房间不存在' });
        }

        // 检查是否已在房间中
        const existingPlayer = await RoomPlayer.findOne({
          roomId: room._id,
          userId: user._id
        });

        // 加入 Socket 房间
        socket.join(roomCode);

        // 获取或创建游戏房间
        let gameRoom = gameRoomManager.getRoom(roomCode);
        if (!gameRoom) {
          gameRoom = await gameRoomManager.createRoom(room._id.toString(), roomCode);
          // 从数据库加载已有玩家
          const existingPlayers = await RoomPlayer.find({ roomId: room._id });
          for (const player of existingPlayers) {
            const user = await User.findById(player.userId);
            if (user) {
              gameRoom.addPlayer(
                player.userId.toString(),
                user.username,
                null,
                player.seatIndex,
                player.team,
                player.isOwner
              );
              if (player.isReady) {
                gameRoom.setPlayerReady(player.userId.toString(), true);
              }
            }
          }
        }

        if (existingPlayer) {
          // 更新 Socket ID
          gameRoom.updateSocketId(user._id.toString(), socket.id);
          socket.roomCode = roomCode;
          socket.seatIndex = existingPlayer.seatIndex;

          // 检查是否有离线记录，恢复连接
          const wasDisconnected = gameRoom.playerManager.reconnect(user._id.toString(), socket.id);
          if (wasDisconnected) {
            console.log(`🔄 玩家重连恢复: ${user.username}, socket: ${socket.id}`);

            // 清除断线定时器
            gameRoom.clearDisconnectTimer(user._id.toString());

            // 广播玩家恢复在线
            io.to(roomCode).emit('room:player_reconnected', {
              userId: user._id.toString(),
              seatIndex: existingPlayer.seatIndex
            });
          } else {
            // 通知其他玩家
            socket.to(roomCode).emit('room:player_joined', {
              userId: user._id,
              username: user.username,
              seatIndex: existingPlayer.seatIndex,
              team: existingPlayer.team,
              isOwner: existingPlayer.isOwner
            });
          }

          // 发送房间状态
          const players = Array.from(gameRoom.players.values()).map(p => ({
            userId: p.userId,
            username: p.username,
            seatIndex: p.seatIndex,
            team: p.team,
            isReady: p.isReady,
            isOwner: p.isOwner
          }));

          return callback({
            success: true,
            data: {
              roomCode: room.roomCode,
              status: room.status,
              seatIndex: existingPlayer.seatIndex,
              team: existingPlayer.team,
              isOwner: existingPlayer.isOwner,  // 添加 isOwner 字段
              players,
              levelA: room.levelA,
              levelB: room.levelB
            }
          });
        }

        // 新加入
        if (room.status !== 'waiting') {
          return callback({ success: false, message: '游戏已开始，无法加入' });
        }

        const playerCount = await RoomPlayer.countDocuments({ roomId: room._id });
        if (playerCount >= 4) {
          return callback({ success: false, message: '房间已满' });
        }

        // 分配座位
        const occupied = await RoomPlayer.find({ roomId: room._id }).select('seatIndex');
        const occupiedSet = new Set(occupied.map(p => p.seatIndex));
        let seatIndex = -1;
        for (let i = 0; i < 4; i++) {
          if (!occupiedSet.has(i)) {
            seatIndex = i;
            break;
          }
        }

        const team = seatIndex % 2 === 0 ? 'A' : 'B';

        // 创建玩家记录
        await RoomPlayer.create({
          roomId: room._id,
          userId: user._id,
          seatIndex,
          team,
          isReady: false,
          isOwner: false
        });

        // 添加到游戏房间
        gameRoom.addPlayer(user._id.toString(), user.username, socket.id, seatIndex, team, false);

        socket.roomCode = roomCode;
        socket.seatIndex = seatIndex;

        // 通知其他玩家
        socket.to(roomCode).emit('room:player_joined', {
          userId: user._id,
          username: user.username,
          seatIndex,
          team
        });

        // 广播房间列表更新
        broadcastRoomList(io);

        // 获取当前房间所有玩家
        const players = Array.from(gameRoom.players.values()).map(p => ({
          userId: p.userId,
          username: p.username,
          seatIndex: p.seatIndex,
          team: p.team,
          isReady: p.isReady,
          isOwner: p.isOwner
        }));

        callback({
          success: true,
          data: {
            roomCode: room.roomCode,
            status: room.status,
            seatIndex,
            team,
            levelA: room.levelA,
            levelB: room.levelB,
            players
          }
        });

      } catch (error) {
        console.error('加入房间错误:', error);
        callback({ success: false, message: '服务器错误' });
      }
    });

    // 玩家准备
    socket.on('game:ready', async (data, callback) => {
      try {
        console.log(`[事件] game:ready - user: ${socket.username}`, { payload: data });
        const { roomCode, isReady } = data;
        const gameRoom = gameRoomManager.getRoom(roomCode);

        if (!gameRoom) {
          return callback({ success: false, message: '房间不存在' });
        }

        gameRoom.setPlayerReady(socket.userId, isReady);

        // 更新数据库
        await RoomPlayer.updateOne(
          { roomId: gameRoom.roomId, userId: socket.userId },
          { isReady }
        );

        // 广播准备状态
        io.to(roomCode).emit('room:player_ready', {
          userId: socket.userId,
          seatIndex: socket.seatIndex,
          isReady
        });

        callback({ success: true });

        // 检查是否所有人都准备了
        if (gameRoom.areAllPlayersReady()) {
          // 更新所有玩家的 socketId
          const roomSockets = await io.in(roomCode).fetchSockets();
          for (const sock of roomSockets) {
            if (sock.userId) {
              gameRoom.updateSocketId(sock.userId, sock.id);
            }
          }

          // 开始游戏
          const room = await Room.findById(gameRoom.roomId);
          room.status = 'playing';
          await room.save();

          io.to(roomCode).emit('room:game_starting', {});

          // 获取所有玩家
          const players = await RoomPlayer.find({ roomId: room._id }).sort({ seatIndex: 1 });
          for (const player of players) {
            const gPlayer = gameRoom.players.get(player.userId.toString());
            if (gPlayer) {
              gPlayer.isReady = true;
            }
          }

          // 开始游戏
          await gameRoom.startGame(room.levelA, room.levelB);
        }

      } catch (error) {
        console.error('准备错误:', error);
        callback({ success: false, message: '服务器错误' });
      }
    });

    // 抢庄
    socket.on('game:call_banker', async (data, callback) => {
      console.log(`[事件] game:call_banker - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleCallBanker(socket.userId, data.card);
      callback(result);
    });

    // 锁庄
    socket.on('game:lock_banker', async (data, callback) => {
      console.log(`[事件] game:lock_banker - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleLockBanker(socket.userId, data.card);
      callback(result);
    });

    // 反庄
    socket.on('game:reverse_banker', async (data, callback) => {
      console.log(`[事件] game:reverse_banker - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleReverseBanker(socket.userId, data.card);
      callback(result);
    });

    // 抢主色
    socket.on('game:call_trump', async (data, callback) => {
      console.log(`[事件] game:call_trump - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleCallTrump(socket.userId, data.card);
      callback(result);
    });

    // 锁主色
    socket.on('game:lock_trump', async (data, callback) => {
      console.log(`[事件] game:lock_trump - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleLockTrump(socket.userId, data.card);
      callback(result);
    });

    // 反主色
    socket.on('game:reverse_trump', async (data, callback) => {
      console.log(`[事件] game:reverse_trump - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleReverseTrump(socket.userId, data.card);
      callback(result);
    });

    // 埋底
    socket.on('game:bury_bottom', async (data, callback) => {
      console.log(`[事件] game:bury_bottom - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleBuryBottom(socket.userId, data.cards);
      callback(result);
    });

    // 抄底
    socket.on('game:take_bottom', async (data, callback) => {
      console.log(`[事件] game:take_bottom - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleTakeBottom(socket.userId, data);
      callback(result);
    });

    // 放弃抄底
    socket.on('game:skip_draw_bottom', async (data, callback) => {
      console.log(`[事件] game:skip_draw_bottom - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handleSkipDrawBottom(socket.userId);
      callback(result);
    });

    // 出牌
    socket.on('game:play_cards', async (data, callback) => {
      console.log(`[事件] game:play_cards - user: ${socket.username}`, { payload: data });
      const gameRoom = gameRoomManager.getRoom(socket.roomCode);
      if (!gameRoom) {
        return callback({ success: false, message: '游戏房间不存在' });
      }

      const result = await gameRoom.handlePlayCards(socket.userId, data.cards);
      callback(result);
    });

    // 离开房间/解散房间
    socket.on('room:leave', async (data, callback) => {
      try {
        console.log(`[事件] room:leave - user: ${socket.username}`, { payload: data });
        const { roomCode, isOwner } = data;
        const gameRoom = gameRoomManager.getRoom(roomCode);
        const room = await Room.findOne({ roomCode });
        
        let roomFinished = false;

        if (isOwner && room) {
          // 房主解散房间
          // 从游戏管理器中移除房间
          if (gameRoom) {
            gameRoomManager.removeRoom(roomCode);
          }
          
          // 删除房间记录
          await Room.deleteOne({ roomCode });
          
          // 一次性通知所有玩家房间被解散（包括自己）
          io.to(roomCode).emit('room:room_dismissed', {
            message: '房主已解散房间',
            isOwner: true  // 标识这是房主操作
          });
          
          // 销毁房间
          io.in(roomCode).socketsLeave(roomCode);
          
          roomFinished = true;
          
        } else {
          // 普通玩家离开房间
          if (gameRoom) {
            gameRoom.removePlayer(socket.userId);

            // 通知其他玩家
            socket.to(roomCode).emit('room:player_left', {
              userId: socket.userId,
              seatIndex: socket.seatIndex
            });

            // 广播房间列表更新
            broadcastRoomList(io);

            // 检查房间是否为空
            if (gameRoom.players.size === 0) {
              gameRoomManager.removeRoom(roomCode);
              await Room.findOneAndUpdate({ roomCode }, { status: 'finished' });
              roomFinished = true;
            }
          }

          socket.leave(roomCode);
          socket.roomCode = null;
          socket.seatIndex = null;

          // 广播房间列表更新
          broadcastRoomList(io);
        }

        // 广播房间列表更新
        if (roomFinished) {
          broadcastRoomList(io);
        }

        callback({ success: true });

      } catch (error) {
        console.error('离开房间错误:', error);
        callback({ success: false, message: '服务器错误' });
      }
    });

    // 断开连接
    socket.on('disconnect', async () => {
      console.log(`🔌 断开连接: ${socket.id}, userId: ${socket.userId}`);

      const userId = socketToUser.get(socket.id);
      if (userId) {
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);

        // 如果在房间中，标记离线状态
        const roomCode = socket.roomCode;
        if (roomCode) {
          const gameRoom = gameRoomManager.getRoom(roomCode);
          if (gameRoom) {
            gameRoom.playerManager.setDisconnected(userId, true);

            // 广播玩家离线
            io.to(roomCode).emit('room:player_disconnected', {
              userId: userId,
              seatIndex: socket.seatIndex
            });

// 设置2分钟定时器，超时后让玩家离开
            const timeoutId = setTimeout(async () => {
              console.log(`⏰ 离线超时，玩家离开房间: ${userId}`);

              // 移除玩家
              if (gameRoom) {
                gameRoom.removePlayer(userId);

                // 通知其他玩家
                io.to(roomCode).emit('room:player_left', {
                  userId: userId,
                  seatIndex: socket.seatIndex
                });

                // 检查房间是否为空
                if (gameRoom.players.size === 0) {
                  gameRoomManager.removeRoom(roomCode);
                }
              }
            }, 120000);

            // 保存定时器 ID 到 GameRoom
            gameRoom.setDisconnectTimer(userId, timeoutId);
          }
        }
      }
    });

    // 退出登录（清除连接信息）
    socket.on('auth:logout', async (data, callback) => {
      try {
        const userId = socket.userId;
        
        // 从在线用户中移除
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);

        // 断开 socket 连接
        socket.disconnect(true);

        callback({ success: true, message: '退出登录成功' });
      } catch (error) {
        console.error('退出登录错误:', error);
        callback({ success: false, message: '服务器错误' });
      }
    });
  });
}

module.exports = setupSocketHandlers;
