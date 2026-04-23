/**
 * 房间模型
 * 存储房间基础信息
 */

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    length: 6  // 6位房间号
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  maxPlayers: {
    type: Number,
    default: 4
  },
  currentRound: {
    type: Number,
    default: 0  // 当前第几局
  },
  // 队伍等级
  levelA: {
    type: Number,
    default: 2
  },
  levelB: {
    type: Number,
    default: 2
  },
  // 守庄状态（是否已守庄成功跳过该等级）
  levelA_defended_2: {
    type: Boolean,
    default: false
  },
  levelA_defended_J: {
    type: Boolean,
    default: false
  },
  levelB_defended_2: {
    type: Boolean,
    default: false
  },
  levelB_defended_J: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// 生成6位随机房间号
roomSchema.statics.generateRoomCode = function() {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

module.exports = mongoose.model('Room', roomSchema);
