/**
 * 出牌记录模型
 * 存储每轮出牌信息
 */

const mongoose = require('mongoose');

const playRecordSchema = new mongoose.Schema({
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameRound',
    required: true
  },
  turnIndex: {
    type: Number,
    required: true  // 第几轮
  },
  seatIndex: {
    type: Number,
    required: true,
    enum: [0, 1, 2, 3]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cards: [{
    type: String  // 出牌内容
  }],
  // 出牌类型: 'normal'(正常), 'trumpKill'(毙牌), 'discard'(贴牌)
  playType: {
    type: String,
    enum: ['normal', 'trumpKill', 'discard'],
    default: 'normal'
  },
  // 是否是抽大经
  isBigJing: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// 索引
playRecordSchema.index({ roundId: 1, turnIndex: 1, seatIndex: 1 });

module.exports = mongoose.model('PlayRecord', playRecordSchema);
