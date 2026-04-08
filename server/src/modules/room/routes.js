/**
 * 房间管理路由
 * 处理房间创建、加入、查询
 */

const express = require('express');
const Room = require('../../models/Room');
const RoomPlayer = require('../../models/RoomPlayer');
const authMiddleware = require('../auth/middleware');

const GameRoomManager = require('../game/room/GameRoomManager');

const router = express.Router();

// 生成6位随机房间号
function generateRoomCode() {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 创建房间
router.post('/create', authMiddleware, async (req, res) => {
  try {
    // 生成唯一房间号
    let roomCode;
    let exists = true;
    while (exists) {
      roomCode = generateRoomCode();
      exists = await Room.findOne({ roomCode });
    }

    // 创建房间
    const room = new Room({
      roomCode,
      ownerId: req.userId,
      status: 'waiting',
      maxPlayers: 4,
      levelA: 2,
      levelB: 2
    });

    await room.save();

    // 创建房主玩家记录
    const roomPlayer = new RoomPlayer({
      roomId: room._id,
      userId: req.userId,
      seatIndex: 0,  // 1号位
      team: 'A',  // 1号位默认为A队
      isReady: false,
      isOwner: true
    });

    await roomPlayer.save();

    // 广播房间列表更新
    const io = req.app.get('io');
    if (io) {
      broadcastRoomList(io);
    }

    res.status(201).json({
      success: true,
      message: '房间创建成功',
      data: {
        room: {
          id: room._id,
          roomCode: room.roomCode,
          status: room.status,
          ownerId: room.ownerId
        },
        player: {
          seatIndex: 0,
          team: 'A',
          isOwner: true
        }
      }
    });
  } catch (error) {
    console.error('创建房间错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 加入房间
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.body;

    if (!roomCode) {
      return res.status(400).json({ success: false, message: '房间号不能为空' });
    }

    // 查找房间
    const room = await Room.findOne({ roomCode });
    if (!room) {
      return res.status(404).json({ success: false, message: '房间不存在' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ success: false, message: '游戏已开始，无法加入' });
    }

    // 检查是否已在房间中
    const existingPlayer = await RoomPlayer.findOne({
      roomId: room._id,
      userId: req.userId
    });

    if (existingPlayer) {
      return res.status(400).json({ success: false, message: '您已在房间中' });
    }

    // 获取当前房间人数
    const playerCount = await RoomPlayer.countDocuments({ roomId: room._id });

    if (playerCount >= room.maxPlayers) {
      return res.status(400).json({ success: false, message: '房间已满' });
    }

    // 分配座位
    const occupiedSeats = await RoomPlayer.find({ roomId: room._id }).select('seatIndex');
    const occupiedSeatSet = new Set(occupiedSeats.map(p => p.seatIndex));
    let seatIndex = -1;
    for (let i = 0; i < 4; i++) {
      if (!occupiedSeatSet.has(i)) {
        seatIndex = i;
        break;
      }
    }

    if (seatIndex === -1) {
      return res.status(400).json({ success: false, message: '房间已满' });
    }

    // 队伍分配: 0,2 为A队; 1,3 为B队
    const team = seatIndex % 2 === 0 ? 'A' : 'B';

    // 创建玩家记录
    const roomPlayer = new RoomPlayer({
      roomId: room._id,
      userId: req.userId,
      seatIndex,
      team,
      isReady: false,
      isOwner: false
    });

    await roomPlayer.save();

    // 广播房间列表更新
    const io = req.app.get('io');
    if (io) {
      broadcastRoomList(io);
    }

    res.status(201).json({
      success: true,
      message: '加入房间成功',
      data: {
        room: {
          id: room._id,
          roomCode: room.roomCode,
          status: room.status
        },
        player: {
          seatIndex,
          team,
          isOwner: false
        }
      }
    });
  } catch (error) {
    console.error('加入房间错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取房间信息
router.get('/:roomCode', authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await Room.findOne({ roomCode });
    if (!room) {
      return res.status(404).json({ success: false, message: '房间不存在' });
    }

    // 获取房间内所有玩家
    const players = await RoomPlayer.find({ roomId: room._id })
      .populate('userId', 'username nickname avatar')
      .sort({ seatIndex: 1 });

    const playerList = players.map(p => ({
      userId: p.userId._id,
      username: p.userId.username,
      nickname: p.userId.nickname,
      seatIndex: p.seatIndex,
      team: p.team,
      isReady: p.isReady,
      isOwner: p.isOwner
    }));

    res.json({
      success: true,
      data: {
        room: {
          id: room._id,
          roomCode: room.roomCode,
          status: room.status,
          levelA: room.levelA,
          levelB: room.levelB,
          currentRound: room.currentRound
        },
        players: playerList,
        playerCount: players.length
      }
    });
  } catch (error) {
    console.error('获取房间信息错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取房间列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'waiting' })
      .select('roomCode status currentRound levelA levelB created_at')
      .populate('ownerId', 'username')
      .sort({ created_at: -1 })
      .limit(50);

    // 获取每个房间的玩家数
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

    res.json({
      success: true,
      data: { rooms: roomsWithCount }
    });
  } catch (error) {
    console.error('获取房间列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

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

module.exports = router;
