/**
 * Socket 服务
 * 处理实时通信
 * 对接后端 Socket API (http://localhost:3000)
 */

import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

// Socket 实例
let socket = null;

// 事件监听器
const listeners = new Map();

/**
 * 初始化 Socket 连接
 */
export const initSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // 连接成功
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  // 认证失败
  socket.on('auth:failed', (data) => {
    console.error('Socket auth failed:', data.message);
  });

  // 连接错误
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  // 断开连接
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  // 重连成功
  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
  });

  return socket;
};

/**
 * 获取 Socket 实例
 */
export const getSocket = () => socket;

/**
 * 获取 Socket 连接状态
 */
export const isConnected = () => socket && socket.connected;

/**
 * 断开 Socket 连接
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * 发送事件（带回调）
 */
export const emit = (event, data = {}, callback = null) => {
  if (socket) {
    if (callback) {
      socket.emit(event, data, callback);
    } else {
      socket.emit(event, data);
    }
  } else {
    console.warn('Socket not connected, cannot emit:', event);
  }
};

/**
 * 发送事件（带 Promise 支持）
 */
export const emitAsync = (event, data = {}) => {
  return new Promise((resolve, reject) => {
    if (socket) {
      socket.emit(event, data, (response) => {
        if (response && response.success) {
          resolve(response.data || response);
        } else {
          reject(new Error(response?.message || 'Request failed'));
        }
      });
    } else {
      reject(new Error('Socket not connected'));
    }
  });
};

/**
 * 监听事件
 */
export const on = (event, callback) => {
  if (socket) {
    // 检查是否已经注册过相同的回调，避免重复注册
    if (listeners.has(event) && listeners.get(event).includes(callback)) {
      return;
    }

    socket.on(event, callback);

    // 保存监听器引用
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event).push(callback);
  }
};

/**
 * 移除事件监听
 */
export const off = (event, callback) => {
  if (socket) {
    socket.off(event, callback);

    // 从监听器列表中移除
    if (listeners.has(event)) {
      const callbacks = listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
};

/**
 * 移除所有事件监听
 */
export const removeAllListeners = () => {
  if (socket) {
    listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        socket.off(event, callback);
      });
    });
    listeners.clear();
  }
};

// ============================================================================
// 房间事件
// ============================================================================

/**
 * 加入房间
 * @param {string} roomCode - 6位房间号
 */
export const joinRoom = (roomCode) => {
  return emitAsync('room:join', { roomCode });
};

/**
 * 离开房间/解散房间
 * @param {string} roomCode - 6位房间号
 * @param {boolean} isOwner - 是否房主（解散房间）
 */
export const leaveRoom = (roomCode, isOwner = false) => {
  return emitAsync('room:leave', { roomCode, isOwner });
};

/**
 * 准备/取消准备
 * @param {string} roomCode - 房间号
 * @param {boolean} isReady - true=准备, false=取消准备
 */
export const playerReady = (roomCode, isReady) => {
  return emitAsync('game:ready', { roomCode, isReady });
};

// ============================================================================
// 游戏事件 - 客户端发送
// ============================================================================

/**
 * 抢庄
 * @param {string} card - 抢庄的牌 (如 "heart_2")
 */
export const callBanker = (card) => {
  return emitAsync('game:call_banker', { card });
};

/**
 * 锁庄
 * @param {string} card - 锁庄的牌 (对子)
 */
export const lockBanker = (card) => {
  return emitAsync('game:lock_banker', { card });
};

/**
 * 反庄
 * @param {string} card - 反庄的牌 (对子)
 */
export const reverseBanker = (card) => {
  return emitAsync('game:reverse_banker', { card });
};

/**
 * 抢主色
 * @param {string} card - 抢主的牌 (当前等级牌)
 */
export const callTrump = (card) => {
  return emitAsync('game:call_trump', { card });
};

/**
 * 锁主色
 * @param {string} card - 锁主的牌 (对子)
 */
export const lockTrump = (card) => {
  return emitAsync('game:lock_trump', { card });
};

/**
 * 反主色
 * @param {string} card - 反主的牌 (对子)
 */
export const reverseTrump = (card) => {
  return emitAsync('game:reverse_trump', { card });
};

/**
 * 埋底
 * @param {Array} cards - 8张埋底牌
 */
export const buryBottom = (cards) => {
  return emitAsync('game:bury_bottom', { cards });
};

/**
 * 抄底
 * @param {string} drawType - 抄底类型 (big_joker_pair, small_joker_pair, hearts5_pair, trump_pair)
 * @param {string} chosenSuit - 选择的花色 (红桃5对时需要)
 * @param {Array} cards - 抄底的牌
 */
export const takeBottom = (drawType, chosenSuit, cards) => {
  return emitAsync('game:take_bottom', { drawType, chosenSuit, cards });
};

/**
 * 放弃抄底
 */
export const skipDrawBottom = () => {
  return emitAsync('game:skip_draw_bottom', {});
};

/**
 * 出牌
 * @param {Array} cards - 要出的牌
 */
export const playCards = (cards) => {
  return emitAsync('game:play_cards', { cards });
};

// ============================================================================
// 游戏事件 - 服务端推送（便捷方法）
// ============================================================================

/**
 * 玩家加入房间通知
 * 事件: room:player_joined
 */
export const onPlayerJoined = (callback) => {
  on('room:player_joined', callback);
};

/**
 * 玩家准备通知
 * 事件: room:player_ready
 */
export const onPlayerReady = (callback) => {
  on('room:player_ready', callback);
};

/**
 * 游戏即将开始
 * 事件: room:game_starting
 */
export const onGameStarting = (callback) => {
  on('room:game_starting', callback);
};

/**
 * 玩家离开通知
 * 事件: room:player_left
 */
export const onPlayerLeft = (callback) => {
  on('room:player_left', callback);
};

/**
 * 房间被解散通知
 * 事件: room:room_dismissed
 */
export const onRoomDismissed = (callback) => {
  on('room:room_dismissed', callback);
};

/**
 * 所有玩家被踢出房间通知
 * 事件: room:all_kicked
 */
export const onAllKicked = (callback) => {
  on('room:all_kicked', callback);
};

/**
 * 发牌完成
 * 事件: game:deal_complete
 */
export const onDealComplete = (callback) => {
  on('game:deal_complete', callback);
};

/**
 * 轮到你操作
 * 事件: game:your_turn
 */
export const onYourTurn = (callback) => {
  on('game:your_turn', callback);
};

/**
 * 抢庄通知
 * 事件: game:banker_called
 */
export const onBankerCalled = (callback) => {
  on('game:banker_called', callback);
};

/**
 * 锁庄通知
 * 事件: game:banker_locked
 * //TODO 暂时未监听该事件，后面需要再发牌过程中监听该事件，并toast 提示，有玩家锁庄
 */
export const onBankerLocked = (callback) => {
  on('game:banker_locked', callback);
};

/**
 * 反庄通知
 * 事件: game:banker_reversed
 */
export const onBankerReversed = (callback) => {
  on('game:banker_reversed', callback);
};

/**
 * 抢主通知
 * 事件: game:trump_called
 */
export const onTrumpCalled = (callback) => {
  on('game:trump_called', callback);
};

/**
 * 锁主通知
 * 事件: game:trump_locked
 */
export const onTrumpLocked = (callback) => {
  on('game:trump_locked', callback);
};

/**
 * 反主通知
 * 事件: game:trump_reversed
 */
export const onTrumpReversed = (callback) => {
  on('game:trump_reversed', callback);
};

/**
 * 补底通知
 * 事件: game:bottom_drawn
 */
export const onBottomDrawn = (callback) => {
  on('game:bottom_drawn', callback);
};

/**
 * 拿底牌通知（广播给房间内所有玩家）
 * 事件: game:bottom_taken
 */
export const onBottomTaken = (callback) => {
  on('game:bottom_taken', callback);
};

/**
 * 埋底完成
 * 事件: game:bottom_buried
 */
export const onBottomBuried = (callback) => {
  on('game:bottom_buried', callback);
};

/**
 * 出牌阶段开始
 * 事件: game:playing_start
 */
export const onPlayingStart = (callback) => {
  on('game:playing_start', callback);
};

/**
 * 出牌通知
 * 事件: game:card_played
 */
export const onCardPlayed = (callback) => {
  on('game:card_played', callback);
};

/**
 * 罚分通知
 * 事件: game:play_penalty
 */
export const onPlayPenalty = (callback) => {
  on('game:play_penalty', callback);
};

/**
 * 回合结果
 * 事件: game:turn_result
 */
export const onTurnResult = (callback) => {
  on('game:turn_result', callback);
};

/**
 * 单局结果
 * 事件: game:round_result
 */
export const onRoundResult = (callback) => {
  on('game:round_result', callback);
};

/**
 * 即将开始下一局
 * 事件: game:round_starting
 */
export const onRoundStarting = (callback) => {
  on('game:round_starting', callback);
};

/**
 * 游戏结束
 * 事件: game:game_over
 */
export const onGameOver = (callback) => {
  on('game:game_over', callback);
};

// ============================================================================
// 新增发牌过程事件
// ============================================================================

/**
 * 开始发牌
 * 事件: game:deal_start
 */
export const onDealStart = (callback) => {
  on('game:deal_start', callback);
};

/**
 * 单张发牌
 * 事件: game:card_dealt
 */
export const onCardDealt = (callback) => {
  on('game:card_dealt', callback);
};

/**
 * 手牌更新
 * 事件: game:hand_updated
 */
export const onHandUpdated = (callback) => {
  on('game:hand_updated', callback);
};

/**
 * 可以抢庄
 * 事件: game:can_call_banker
 */
export const onCanCallBanker = (callback) => {
  on('game:can_call_banker', callback);
};

/**
 * 可以锁庄
 * 事件: game:can_lock_banker
 */
export const onCanLockBanker = (callback) => {
  on('game:can_lock_banker', callback);
};

/**
 * 可以反庄
 * 事件: game:can_reverse_banker
 */
export const onCanReverseBanker = (callback) => {
  on('game:can_reverse_banker', callback);
};

/**
 * 可以抢主色
 * 事件: game:can_call_trump
 */
export const onCanCallTrump = (callback) => {
  on('game:can_call_trump', callback);
};

/**
 * 可以锁主色
 * 事件: game:can_lock_trump
 */
export const onCanLockTrump = (callback) => {
  on('game:can_lock_trump', callback);
};

/**
 * 可以反主色
 * 事件: game:can_reverse_trump
 */
export const onCanReverseTrump = (callback) => {
  on('game:can_reverse_trump', callback);
};

/**
 * 投标状态变化
 * 事件: game:bid_state_changed
 */
export const onBidStateChanged = (callback) => {
  on('game:bid_state_changed', callback);
};

/**
 * 操作被拒绝
 * 事件: game:bid_rejected
 */
export const onBidRejected = (callback) => {
  on('game:bid_rejected', callback);
};

/**
 * 投标超时（10秒倒计时结束）
 * 事件: game:bid_timeout
 */
export const onBidTimeout = (callback) => {
  on('game:bid_timeout', callback);
};

// ============================================================================
// 重新发牌事件
// ============================================================================

/**
 * 重新发牌触发
 * 事件: game:redeal_triggered
 */
export const onRedealTriggered = (callback) => {
  on('game:redeal_triggered', callback);
};

/**
 * 重新发牌开始
 * 事件: game:redeal_start
 */
export const onRedealStart = (callback) => {
  on('game:redeal_start', callback);
};

/**
 * 重新发牌完成
 * 事件: game:redeal_complete
 */
export const onRedealComplete = (callback) => {
  on('game:redeal_complete', callback);
};

/**
 * 重新发牌失败（超过最大次数）
 * 事件: game:redeal_failed
 */
export const onRedealFailed = (callback) => {
  on('game:redeal_failed', callback);
};

// ============================================================================
// 抄底阶段事件
// ============================================================================

/**
 * 询问抄底
 * 事件: game:ask_draw_bottom
 */
export const onAskDrawBottom = (callback) => {
  on('game:ask_draw_bottom', callback);
};

/**
 * 抄底成功
 * 事件: game:draw_bottom_success
 */
export const onDrawBottomSuccess = (callback) => {
  on('game:draw_bottom_success', callback);
};

/**
 * 抄底失败
 * 事件: game:draw_bottom_failed
 */
export const onDrawBottomFailed = (callback) => {
  on('game:draw_bottom_failed', callback);
};

/**
 * 抄底超时放弃
 * 事件: game:draw_bottom_timeout
 */
export const onDrawBottomTimeout = (callback) => {
  on('game:draw_bottom_timeout', callback);
};

/**
 * 玩家放弃抄底
 * 事件: game:draw_bottom_skipped
 */
export const onDrawBottomSkipped = (callback) => {
  on('game:draw_bottom_skipped', callback);
};

/**
 * 抄底阶段完成
 * 事件: game:draw_bottom_complete
 */
export const onDrawBottomComplete = (callback) => {
  on('game:draw_bottom_complete', callback);
};

/**
 * 抄底阶段致命错误（A级底牌有分）
 * 事件: game:draw_bottom_fatal
 */
export const onDrawBottomFatal = (callback) => {
  on('game:draw_bottom_fatal', callback);
};

/**
 * 抠底揭示
 * 事件: game:bottom_reveal
 */
export const onBottomReveal = (callback) => {
  on('game:bottom_reveal', callback);
};

// ============================================================================
// 便捷别名（兼容旧代码）
// ============================================================================

// 旧事件名兼容（已在 utils/constants.js 中定义）
// 这些只是为了保持向后兼容，实际使用请使用新的事件名

export default {
  initSocket,
  getSocket,
  isConnected,
  disconnectSocket,
  emit,
  emitAsync,
  on,
  off,
  removeAllListeners,

  // 房间
  joinRoom,
  leaveRoom,
  playerReady,

  // 游戏操作
  callBanker,
  lockBanker,
  reverseBanker,
  callTrump,
  lockTrump,
  reverseTrump,
  buryBottom,
  takeBottom,
  skipDrawBottom,
  playCards,

  // 服务端事件
  onPlayerJoined,
  onPlayerReady,
  onGameStarting,
  onPlayerLeft,
  onDealComplete,
  onYourTurn,
  onBankerCalled,
  onBankerLocked,
  onBankerReversed,
  onTrumpCalled,
  onTrumpLocked,
  onTrumpReversed,
  onBottomDrawn,
  onBottomTaken,
  onBottomBuried,
  onPlayingStart,
  onCardPlayed,
  onPlayPenalty,
  onTurnResult,
  onRoundResult,
  onRoundStarting,
  onGameOver,

  // 新增发牌过程事件
  onDealStart,
  onCardDealt,
  onHandUpdated,
  onCanCallBanker,
  onCanLockBanker,
  onCanReverseBanker,
  onCanCallTrump,
  onCanLockTrump,
  onCanReverseTrump,
  onBidStateChanged,
  onBidRejected,

  // 重新发牌事件
  onRedealTriggered,
  onRedealStart,
  onRedealComplete,
  onRedealFailed,

  // 抄底阶段事件
  onAskDrawBottom,
  onDrawBottomSuccess,
  onDrawBottomFailed,
  onDrawBottomTimeout,
  onDrawBottomSkipped,
  onDrawBottomComplete,
  onDrawBottomFatal,
  onBottomReveal,

  // 房间解散事件
  onRoomDismissed,
  onAllKicked
};
