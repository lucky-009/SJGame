/**
 * 游戏状态 Slice
 * 管理核心对局逻辑
 */

import { createSlice } from '@reduxjs/toolkit';
import { GAME_PHASES, TEAMS, SUITS } from '../utils/constants';

const initialState = {
  // 游戏阶段
  phase: GAME_PHASES.NONE,

  // 庄家信息
  bankerId: '',           // 庄家玩家ID
  bankerTeam: TEAMS.A,   // 庄家队伍

  // 主牌信息
  mainSuit: SUITS.NONE,  // 主花色
  currentLevel: '2',     // 当前等级

  // 队伍等级
  levelA: '2',
  levelB: '2',

  // 队伍得分
  teamAScore: 0,
  teamBScore: 0,
  roundScore: 0,         // 当前回合得分

  // 手牌
  myHands: [],           // 我的手牌 [{ suit, rank, isMain, id }]
  selectedCards: [],     // 当前选中的牌索引

  // 牌桌
  turnSeatIndex: -1,      // 当前操作玩家座位索引 (-1表示无)
  deskCards: {},         // 桌面上的牌 { seat0: [], seat1: [], seat2: [], seat3: [] }
  leadSeatIndex: 0,      // 首家出牌座位索引

  // 底牌
  bottomCards: [],       // 底牌（庄家可见）
  hiddenBottom: [],       // 埋底后的隐藏底牌

  // 抢庄/抢主状态
  currentBidder: null,   // 当前抢庄/抢主玩家
  bidSuit: null,         // 抢庄/抢主使用的花色
  isLocked: false,       // 是否已锁定

  // 发牌进度
  dealProgress: {
    isDealing: false,
    current: 0,
    total: 100
  },

  // 投标状态（发牌过程中的实时状态）
  bidState: {
    hasBanker: false,
    bankerSeat: -1,
    hasTrump: false,
    trumpSuit: null,
    isLocked: false,
    trumpCallerSeat: -1
  },

  // 出牌信息
  leadSuit: null,        // 首家出牌花色
  leadCardType: null,    // 首家牌型

  // 计时器
  turnTimeLeft: 0,       // 剩余时间（秒）

  // 结算信息
  roundResult: null,     // 回合结算结果
  gameResult: null,      // 整局结算结果

  // 即将开始下一局提示
  showRoundStarting: false,
  roundStartingData: null,

  // 特殊状态
  canCallBanker: false,  // 是否可以抢庄
  canCallTrump: false,   // 是否可以抢主
  canTakeBottom: false,  // 是否可以抄底
  isMyTurn: false,       // 是否轮到自己操作

  // 新增：发牌过程中的操作权限
  canLockBanker: false,    // 是否可以锁庄
  canReverseBanker: false, // 是否可以反庄
  canLockTrump: false,     // 是否可以锁主
  canReverseTrump: false,  // 是否可以反主

  // 新增：可用于抢庄/抢主的卡片列表
  availableBankerCards: [],  // 可用于抢庄的卡片列表
  availableTrumpCards: [],  // 可用于抢主的卡片列表
  availableReverseCards: null, // 可用于反庄/反主的卡片信息 { type, suit, cards }
  reverseType: null,        // 反庄/反主类型
  reverseSuit: null,          // 反庄时的花色

  // 房间信息
  roundIndex: 0,         // 第几局
  totalRounds: 0,        // 总共多少局（可选）

  // 抄底阶段状态
  drawBottom: {
    isActive: false,     // 是否在抄底阶段
    currentAsker: -1,   // 当前被询问的玩家座位
    canDraw: false,     // 是否显示抄底按钮
    timeout: 10,         // 剩余时间
    drawableOptions: [], // 可抄底的牌型选项
    drawInfo: null       // 抄底成功后的信息（埋底时展示）
  },

  // 牌堆剩余张数
  remainingCards: 0,

  // 首家出牌数量（用于限制跟牌数量）
  leadPlayCardCount: 0
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    /**
     * 重置游戏状态
     */
    resetGame: () => initialState,

    /**
     * 设置游戏阶段
     */
    setPhase: (state, action) => {
      state.phase = action.payload;
    },

    /**
     * 设置庄家
     */
    setBanker: (state, action) => {
      const { bankerId, bankerTeam } = action.payload;
      state.bankerId = bankerId;
      state.bankerTeam = bankerTeam;
    },

    /**
     * 设置主花色
     */
    setMainSuit: (state, action) => {
      state.mainSuit = action.payload;
    },

    /**
     * 设置当前等级
     */
    setCurrentLevel: (state, action) => {
      state.currentLevel = action.payload;
    },

    /**
     * 设置队伍等级
     */
    setTeamLevel: (state, action) => {
      const { team, level } = action.payload;
      if (team === TEAMS.A) {
        state.levelA = level;
      } else {
        state.levelB = level;
      }
    },

    /**
     * 设置队伍得分
     */
    setTeamScore: (state, action) => {
      const { team, score } = action.payload;
      if (team === TEAMS.A) {
        state.teamAScore = score;
      } else {
        state.teamBScore = score;
      }
    },

    /**
     * 增加队伍得分
     */
    addTeamScore: (state, action) => {
      const { team, score } = action.payload;
      if (team === TEAMS.A) {
        state.teamAScore += score;
      } else {
        state.teamBScore += score;
      }
      state.roundScore += score;
    },

    /**
     * 重置回合得分
     */
    resetRoundScore: (state) => {
      state.roundScore = 0;
    },

    /**
     * 设置手牌
     */
    setMyHands: (state, action) => {
      state.myHands = action.payload;
    },

    /**
     * 添加手牌
     */
    addCard: (state, action) => {
      state.myHands.push(action.payload);
    },

    /**
     * 移除手牌
     */
    removeCards: (state, action) => {
      const indices = action.payload;
      // 按索引从大到小排序，避免删除时索引变化
      indices.sort((a, b) => b - a);
      indices.forEach(index => {
        state.myHands.splice(index, 1);
      });
      state.selectedCards = [];
    },

    /**
     * 选中/取消选中牌
     */
    toggleCardSelection: (state, action) => {
      const { index, isMultiSelect } = action.payload;
      const selectedIndex = state.selectedCards.indexOf(index);

      if (selectedIndex >= 0) {
        // 取消选中
        state.selectedCards.splice(selectedIndex, 1);
      } else {
        // 选中
        state.selectedCards.push(index);
        state.selectedCards.sort((a, b) => a - b);
      }
    },

    /**
     * 选中一组牌
     */
    selectCards: (state, action) => {
      state.selectedCards = action.payload;
    },

    /**
     * 清除选中
     */
    clearSelection: (state) => {
      state.selectedCards = [];
    },

    /**
     * 设置当前操作玩家
     */
    setTurnSeatIndex: (state, action) => {
      state.turnSeatIndex = action.payload;
    },

    /**
     * 设置桌面上的牌
     */
    setDeskCards: (state, action) => {
      const { seatIndex, cards } = action.payload;
      state.deskCards[seatIndex] = cards;
    },

    /**
     * 添加桌面上的牌
     */
    addDeskCard: (state, action) => {
      const { seatIndex, cards } = action.payload;
      if (!state.deskCards[seatIndex]) {
        state.deskCards[seatIndex] = [];
      }
      state.deskCards[seatIndex] = [...state.deskCards[seatIndex], ...cards];
    },

    /**
     * 清除桌面上的牌
     */
    clearDeskCards: (state) => {
      state.deskCards = {};
    },

    /**
     * 设置首家出牌索引
     */
    setLeadSeatIndex: (state, action) => {
      state.leadSeatIndex = action.payload;
    },

    /**
     * 设置底牌
     */
    setBottomCards: (state, action) => {
      state.bottomCards = action.payload;
    },

    /**
     * 设置埋底
     */
    setHiddenBottom: (state, action) => {
      state.hiddenBottom = action.payload;
      state.bottomCards = [];
    },

    /**
     * 设置抢庄/抢主状态
     */
    setBidState: (state, action) => {
      const { currentBidder, bidSuit, isLocked } = action.payload;
      state.currentBidder = currentBidder;
      state.bidSuit = bidSuit;
      state.isLocked = isLocked;
    },

    /**
     * 设置首家出牌花色
     */
    setLeadSuit: (state, action) => {
      state.leadSuit = action.payload;
    },

    /**
     * 设置首家牌型
     */
    setLeadCardType: (state, action) => {
      state.leadCardType = action.payload;
    },

    /**
     * 设置剩余时间
     */
    setTimeLeft: (state, action) => {
      state.turnTimeLeft = action.payload;
    },

    /**
     * 减少剩余时间
     */
    decrementTime: (state) => {
      if (state.turnTimeLeft > 0) {
        state.turnTimeLeft -= 1;
      }
    },

    /**
     * 设置回合结算结果
     */
    setRoundResult: (state, action) => {
      state.roundResult = action.payload;
    },

    /**
     * 设置整局结算结果
     */
    setGameResult: (state, action) => {
      state.gameResult = action.payload;
    },

    /**
     * 显示/隐藏即将开始下一局提示
     */
    setShowRoundStarting: (state, action) => {
      state.showRoundStarting = action.payload;
    },

    /**
     * 设置即将开始下一局数据
     */
    setRoundStartingData: (state, action) => {
      state.roundStartingData = action.payload;
    },

    /**
     * 设置是否可以抢庄
     */
    setCanCallBanker: (state, action) => {
      state.canCallBanker = action.payload;
    },

    /**
     * 设置是否可以抢主
     */
    setCanCallTrump: (state, action) => {
      state.canCallTrump = action.payload;
    },

    /**
     * 设置是否可以抄底
     */
    setCanTakeBottom: (state, action) => {
      state.canTakeBottom = action.payload;
    },

    /**
     * 设置是否轮到自己操作
     */
    setIsMyTurn: (state, action) => {
      state.isMyTurn = action.payload;
    },

    /**
     * 设置局数
     */
    setRoundIndex: (state, action) => {
      state.roundIndex = action.payload;
    },

    /**
     * 更新游戏状态（全量）
     */
    updateGameState: (state, action) => {
      return { ...state, ...action.payload };
    },

    /**
     * 初始化本局游戏
     */
    initRound: (state, action) => {
      const { bankerId, bankerTeam, mainSuit, currentLevel, levelA, levelB, roundIndex } = action.payload;
      state.phase = GAME_PHASES.DEALING;
      state.bankerId = bankerId;
      state.bankerTeam = bankerTeam;
      state.mainSuit = mainSuit;
      state.currentLevel = currentLevel;
      state.levelA = levelA;
      state.levelB = levelB;
      state.roundIndex = roundIndex;
      state.teamAScore = 0;
      state.teamBScore = 0;
      state.roundScore = 0;
      state.myHands = [];
      state.selectedCards = [];
      state.deskCards = {};
      state.bottomCards = [];
      state.roundResult = null;
      state.gameResult = null;
      state.dealProgress = { isDealing: false, current: 0, total: 100 };
      state.bidState = { hasBanker: false, bankerSeat: -1, hasTrump: false, trumpSuit: null, isLocked: false };
      state.canCallBanker = false;
      state.canCallTrump = false;
      state.canLockBanker = false;
      state.canReverseBanker = false;
      state.canLockTrump = false;
      state.canReverseTrump = false;
    },

    /**
     * 设置发牌进度
     */
    setDealProgress: (state, action) => {
      state.dealProgress = action.payload;
    },

    /**
     * 设置投标状态
     */
    setBidStateInfo: (state, action) => {
      state.bidState = action.payload;
    },

    /**
     * 设置是否可以锁庄
     */
    setCanLockBanker: (state, action) => {
      state.canLockBanker = action.payload;
    },

    /**
     * 设置是否可以反庄
     */
    setCanReverseBanker: (state, action) => {
      state.canReverseBanker = action.payload;
    },

    /**
     * 设置是否可以锁主
     */
    setCanLockTrump: (state, action) => {
      state.canLockTrump = action.payload;
    },

    /**
     * 设置是否可以反主
     */
    setCanReverseTrump: (state, action) => {
      state.canReverseTrump = action.payload;
    },

    /**
     * 设置可用于抢庄的卡片列表
     */
    setAvailableBankerCards: (state, action) => {
      state.availableBankerCards = action.payload;
    },

    /**
     * 设置可用于抢主的卡片列表
     */
    setAvailableTrumpCards: (state, action) => {
      state.availableTrumpCards = action.payload;
    },

    /**
     * 设置可用于反庄/反主的卡片列表
     */
    setAvailableReverseCards: (state, action) => {
      state.availableReverseCards = action.payload;
      state.reverseType = action.payload?.type || null;
      state.reverseSuit = action.payload?.suit || null;
    },

    /**
     * 清除所有发牌过程操作权限
     */
    clearDealingActions: (state) => {
      state.canCallBanker = false;
      state.canCallTrump = false;
      state.canLockBanker = false;
      state.canReverseBanker = false;
      state.canLockTrump = false;
      state.canReverseTrump = false;
      state.availableBankerCards = [];
      state.availableTrumpCards = [];
      state.availableReverseCards = [];
      state.reverseType = null;
      state.reverseSuit = null;
    },

    /**
     * 设置抄底阶段状态
     */
    setDrawBottomState: (state, action) => {
      state.drawBottom = { ...state.drawBottom, ...action.payload };
    },

    /**
     * 清除抄底阶段状态
     */
    clearDrawBottomState: (state) => {
      state.drawBottom = {
        isActive: false,
        currentAsker: -1,
        canDraw: false,
        timeout: 10,
        drawableOptions: [],
        drawInfo: null
      };
    },

    /**
     * 设置牌堆剩余张数
     */
    setRemainingCards: (state, action) => {
      state.remainingCards = action.payload;
    },

    /**
     * 设置首家出牌数量
     */
    setLeadPlayCardCount: (state, action) => {
      state.leadPlayCardCount = action.payload;
    },

  }
});

export const {
  resetGame,
  setPhase,
  setBanker,
  setMainSuit,
  setCurrentLevel,
  setTeamLevel,
  setTeamScore,
  addTeamScore,
  resetRoundScore,
  setMyHands,
  addCard,
  removeCards,
  toggleCardSelection,
  selectCards,
  clearSelection,
  setTurnSeatIndex,
  setDeskCards,
  addDeskCard,
  clearDeskCards,
  setLeadSeatIndex,
  setBottomCards,
  setHiddenBottom,
  setBidState,
  setLeadSuit,
  setLeadCardType,
  setTimeLeft,
  decrementTime,
  setRoundResult,
  setGameResult,
  setShowRoundStarting,
  setRoundStartingData,
  setCanCallBanker,
  setCanCallTrump,
  setCanTakeBottom,
  setIsMyTurn,
  setRoundIndex,
  updateGameState,
  initRound,
  setDealProgress,
  setBidStateInfo,
  setCanLockBanker,
  setCanReverseBanker,
  setCanLockTrump,
  setCanReverseTrump,
  setAvailableBankerCards,
  setAvailableTrumpCards,
  setAvailableReverseCards,
  clearDealingActions,
  setDrawBottomState,
  clearDrawBottomState,
  setRemainingCards,
  setLeadPlayCardCount
} = gameSlice.actions;

export default gameSlice.reducer;
