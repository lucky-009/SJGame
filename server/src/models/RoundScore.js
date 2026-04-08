/**
 * 回合得分模型
 * 存储每局得分信息
 */

const mongoose = require('mongoose');

const roundScoreSchema = new mongoose.Schema({
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameRound',
    required: true
  },
  turnIndex: {
    type: Number,
    required: true  // 第几轮
  },
  winnerSeat: {
    type: Number,
    required: true,
    enum: [0, 1, 2, 3]
  },
  winnerTeam: {
    type: String,
    enum: ['A', 'B'],
    required: true
  },
  baseScore: {
    type: Number,
    default: 0  // 基础得分（5/10/K）
  },
  bottomScore: {
    type: Number,
    default: 0  // 抠底得分
  },
  totalScore: {
    type: Number,
    default: 0  // 总分
  },
  // 队伍累计得分
  teamAScore: {
    type: Number,
    default: 0
  },
  teamBScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
roundScoreSchema.index({ roundId: 1, turnIndex: 1 });

module.exports = mongoose.model('RoundScore', roundScoreSchema);
