/**
 * 游戏局模型
 * 存储每局游戏信息
 */

const mongoose = require('mongoose');

const gameRoundSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  roundIndex: {
    type: Number,
    required: true  // 第几局
  },
  bankerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bankerSeatIndex: {
    type: Number,
    enum: [0, 1, 2, 3]
  },
  bankerTeam: {
    type: String,
    enum: ['A', 'B']
  },
  // 主花色: 'spade', 'heart', 'club', 'diamond', null(无主)
  trumpSuit: {
    type: String,
    enum: ['spade', 'heart', 'club', 'diamond', null],
    default: null
  },
  // 是否无主
  isNoTrump: {
    type: Boolean,
    default: false
  },
  // 当前等级
  level: {
    type: Number,
    default: 2  // 2-A (11-14)
  },
  // 当前游戏阶段
  phase: {
    type: String,
    enum: ['dealing','dealEnd', 'bottoming', 'playing', 'settling', 'finished'],
    default: 'dealing'
  },
  // 抢庄状态
  bankerCall: {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    card: String,
    seatIndex: Number,
    isLocked: { type: Boolean, default: false },
    isReversed: { type: Boolean, default: false }
  },
  // 抢主状态
  trumpCall: {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    suit: String,
    seatIndex: Number,
    isLocked: { type: Boolean, default: false },
    isReversed: { type: Boolean, default: false }
  },
  // 当前操作玩家座位
  currentTurnSeat: {
    type: Number,
    enum: [0, 1, 2, 3]
  },
  // 当前回合（第几轮）
  currentTurn: {
    type: Number,
    default: 0
  },
  // 庄家是否已补底
  bankerTookBottom: {
    type: Boolean,
    default: false
  },
  // 庄家是否已埋底
  bankerBuriedBottom: {
    type: Boolean,
    default: false
  },
  // 底牌
  bottomCards: [{
    type: String
  }],
  // 游戏状态
  status: {
    type: String,
    enum: ['pending', 'active', 'finished'],
    default: 'pending'
  },
  // 下一局庄家信息
  nextBankerSeat: {
    type: Number,
    enum: [0, 1, 2, 3]
  },
  nextBankerTeam: {
    type: String,
    enum: ['A', 'B']
  }
}, {
  timestamps: true
});

// 索引
gameRoundSchema.index({ roomId: 1, roundIndex: 1 }, { unique: true });

module.exports = mongoose.model('GameRound', gameRoundSchema);
