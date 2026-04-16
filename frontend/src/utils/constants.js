/**
 * 游戏常量定义
 */

// 牌的花色
export const SUITS = {
  SPADE: 'spade',     // 黑桃 ♠
  HEART: 'heart',     // 红桃 ♥
  CLUB: 'club',       // 梅花 ♣
  DIAMOND: 'diamond', // 方片 ♦
  NONE: 'none'        // 无主
};

// 牌的等级（从小到大）
export const RANKS = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

// 花色显示名称
export const SUIT_NAMES = {
  [SUITS.SPADE]: '♠',
  [SUITS.HEART]: '♥',
  [SUITS.CLUB]: '♣',
  [SUITS.DIAMOND]: '♦',
  [SUITS.NONE]: '无主'
};

// 等级显示名称
export const RANK_NAMES = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  '11': 'J',
  '12': 'Q',
  '13': 'K',
  '14': 'A'
};

// 等级顺序
export const LEVEL_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// 游戏阶段
export const GAME_PHASES = {
  NONE: 'none',
  DEALING: 'dealing',     // 发牌阶段
  DEALEND: 'dealEnd',   // 发牌完成，等待补底
  BOTTOMING: 'bottoming',// 底牌处理阶段
  PLAYING: 'playing',    // 出牌阶段
  SETTLING: 'settling'   // 结算阶段
};

// 房间状态
export const ROOM_STATUS = {
  WAITING: 'waiting',    // 等待中
  PLAYING: 'playing',    // 游戏中
  FINISHED: 'finished'   // 已结束
};

// 队伍
export const TEAMS = {
  A: 'A',
  B: 'B'
};

// 座位索引（相对于自己）
export const SEAT_POSITIONS = {
  SELF: 0,    // 自己
  RIGHT: 1,  // 下家
  OPPONENT: 2, // 对家
  LEFT: 3    // 上家
};

// 牌型
export const CARD_TYPES = {
  SINGLE: 'single',     // 单张
  PAIR: 'pair',         // 对子
  CONTINUOUS_PAIR: 'continuous_pair', // 连对
  FIVE_TEN_K: 'five_ten_k' // 510K
};

// 出牌类型
export const PLAY_TYPES = {
  NORMAL: 'normal',     // 正常跟牌
  TRUMP: 'trump',       // 毙牌
  DISCARD: 'discard'    // 贴牌
};

// 分数牌
export const SCORE_CARDS = {
  '5': 5,
  '10': 10,
  'K': 10
};

// Socket 事件名称（根据 API.md）
export const SOCKET_EVENTS = {
  // ========== 客户端上报 ==========
  // 准备
  READY: 'game:ready',
  // 抢庄
  CALL_BANKER: 'game:call_banker',
  LOCK_BANKER: 'game:lock_banker',
  REVERSE_BANKER: 'game:reverse_banker',
  // 抢主
  CALL_TRUMP: 'game:call_trump',
  LOCK_TRUMP: 'game:lock_trump',
  REVERSE_TRUMP: 'game:reverse_trump',
  // 埋底
  BURY_BOTTOM: 'game:bury_bottom',
  // 出牌
  PLAY_CARDS: 'game:play_cards',

  // ========== 服务端推送 ==========
  // 认证
  AUTH_FAILED: 'auth:failed',
  // 房间
  PLAYER_JOINED: 'room:player_joined',
  PLAYER_READY: 'room:player_ready',
  GAME_STARTING: 'room:game_starting',
  PLAYER_LEFT: 'room:player_left',
  // 游戏
  DEAL_COMPLETE: 'game:deal_complete',
  YOUR_TURN: 'game:your_turn',
  BANKER_CALLED: 'game:banker_called',
  BANKER_LOCKED: 'game:banker_locked',
  BANKER_REVERSED: 'game:banker_reversed',
  TRUMP_CALLED: 'game:trump_called',
  TRUMP_LOCKED: 'game:trump_locked',
  TRUMP_REVERSED: 'game:trump_reversed',
  BOTTOM_DRAWN: 'game:bottom_drawn',
  BOTTOM_BURIED: 'game:bottom_buried',
  PLAYING_START: 'game:playing_start',
  CARD_PLAYED: 'game:card_played',
  PLAY_PENALTY: 'game:play_penalty',
  TURN_RESULT: 'game:turn_result',
  ROUND_RESULT: 'game:round_result',
  GAME_OVER: 'game:game_over'
};

// 游戏操作类型（根据 API.md）
export const GAME_ACTIONS = {
  CALL_BANKER: 'call_banker',
  LOCK_BANKER: 'lock_banker',
  REVERSE_BANKER: 'reverse_banker',
  CALL_TRUMP: 'call_trump',
  LOCK_TRUMP: 'lock_trump',
  REVERSE_TRUMP: 'reverse_trump',
  BURY_BOTTOM: 'bury_bottom',
  PLAY_CARDS: 'play_cards'
};

// API 基础 URL
export const API_BASE_URL = 'http://localhost:3000/api';

// Socket 基础 URL
export const SOCKET_URL = 'http://localhost:3000';

// // API 基础 URL
// export const API_BASE_URL = 'http://47.77.221.30:3000/api';
//
// // Socket 基础 URL
// export const SOCKET_URL = 'http://47.77.221.30:3000';
