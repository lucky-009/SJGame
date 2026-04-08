/**
 * 房间玩家模型
 * 存储房间内玩家关系信息
 */

const mongoose = require('mongoose');

const roomPlayerSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seatIndex: {
    type: Number,
    required: true,
    enum: [0, 1, 2, 3]  // 0-3 对应 1-4 号位
  },
  team: {
    type: String,
    enum: ['A', 'B'],
    required: true
  },
  isReady: {
    type: Boolean,
    default: false
  },
  isOwner: {
    type: Boolean,
    default: false
  },
  joinTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 复合唯一索引：房间 + 座位
roomPlayerSchema.index({ roomId: 1, seatIndex: 1 }, { unique: true });
// 复合唯一索引：房间 + 用户
roomPlayerSchema.index({ roomId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('RoomPlayer', roomPlayerSchema);
