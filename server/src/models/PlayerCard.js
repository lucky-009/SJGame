/**
 * 玩家手牌模型
 * 存储玩家手牌信息
 */

const mongoose = require('mongoose');

const playerCardSchema = new mongoose.Schema({
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameRound',
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
    enum: [0, 1, 2, 3]
  },
  cards: [{
    type: String  // 牌面，如 'spade_A', 'heart_5', 'joker_big'
  }]
}, {
  timestamps: true
});

// 复合索引
playerCardSchema.index({ roundId: 1, userId: 1 }, { unique: true });
playerCardSchema.index({ roundId: 1, seatIndex: 1 }, { unique: true });

module.exports = mongoose.model('PlayerCard', playerCardSchema);
