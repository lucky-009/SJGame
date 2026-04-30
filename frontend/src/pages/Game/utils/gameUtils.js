import { SUIT_NAMES, RED_SUITS } from '../../../utils/constants';
import { isFixedTrump as checkIsFixedTrump } from '../../../utils/cardUtils';

/**
 * 工具函数模块
 * 提供游戏相关的纯函数工具方法
 */

const SUIT_ORDER = {
  diamond: 0,
  club: 1,
  heart: 2,
  spade: 3,
  joker: 4
};

const RANK_ORDER = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
  'small': 15,
  'big': 16
};

/**
 * 解析牌字符串为 Card 对象
 * 例如: "diamond_9" -> { suit: 'diamond', rank: '9', displayName: '♦9' }
 */
export const parseCardString = (cardStr) => {
  if (!cardStr) return null;

  const parts = cardStr.split('_');
  if (parts.length !== 2) return null;

  const [suit, rank] = parts;
  const displayNames = {
    'spade': '♠',
    'heart': '♥',
    'club': '♣',
    'diamond': '♦',
    'joker': '🃏'
  };

  return {
    suit,
    rank,
    displayName: suit === 'joker' ? '🃏' : `${displayNames[suit] || ''}${rank}`
  };
};

const compareFixedTrump = (a, b) => {
  const FIXED_TRUMP_ORDER = {
    'heart_5': 0,
    'joker_big': 1,
    'joker_small': 2
  };

  const keyA = a.suit === 'joker' ? `joker_${a.rank}` : `${a.suit}_${a.rank}`;
  const keyB = b.suit === 'joker' ? `joker_${b.rank}` : `${b.suit}_${b.rank}`;

  const orderA = FIXED_TRUMP_ORDER[keyA] ?? 3;
  const orderB = FIXED_TRUMP_ORDER[keyB] ?? 3;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return (RANK_ORDER[b.rank] ?? 0) - (RANK_ORDER[a.rank] ?? 0);
};

/**
 * 按花色排序手牌
 * 排序顺序: 方片(♦) -> 梅花(♣) -> 红桃(♥) -> 黑桃(♠) -> 固定主
 * 固定主单独放到最右边，内部排序: 红桃5 > 大王 > 小王 > 等级固定主
 * @param {Array} hands - 手牌数组
 * @param {string} currentLevel - 当前等级
 */
export const sortHandCards = (hands, currentLevel = '2') => {
  if (!hands || !Array.isArray(hands)) return [];

  const isFixedTrump = (card) => checkIsFixedTrump(card, currentLevel);

  const sorted = [...hands].sort((a, b) => {
    const cardA = typeof a === 'string' ? parseCardString(a) : a;
    const cardB = typeof b === 'string' ? parseCardString(b) : b;

    const suitA = SUIT_ORDER[cardA?.suit] ?? 5;
    const suitB = SUIT_ORDER[cardB?.suit] ?? 5;

    if (suitA !== suitB) {
      return suitA - suitB;
    }

    const rankA = RANK_ORDER[cardA?.rank] ?? 0;
    const rankB = RANK_ORDER[cardB?.rank] ?? 0;

    return rankA - rankB;
  });

  const normalCards = sorted.filter(card => {
    const parsed = typeof card === 'string' ? parseCardString(card) : card;
    return !isFixedTrump(parsed);
  });

  const fixedTrumps = sorted.filter(card => {
    const parsed = typeof card === 'string' ? parseCardString(card) : card;
    return isFixedTrump(parsed);
  }).sort(compareFixedTrump);

  return [...normalCards, ...fixedTrumps];
};

/**
 * 获取座位位置名称
 * 返回: 'self', 'right', 'opponent', 'left'
 */
export const getSeatPosition = (seatIndex, mySeatIndex) => {
  const positions = ['self', 'right', 'opponent', 'left'];
  const relativeIndex = (seatIndex - mySeatIndex + 4) % 4;
  return positions[relativeIndex];
};

/**
 * 将 Card 对象数组转换为字符串数组
 */
export const cardsToStrings = (cards) => {
  if (!cards || !Array.isArray(cards)) return [];

  return cards.map(c => {
    if (typeof c === 'string') return c;
    return `${c.suit}_${c.rank}`;
  });
};

/**
 * 获取队伍的seatIndex
 */
export const getTeam = (seatIndex) => {
  return seatIndex % 2 === 0 ? 'A' : 'B';
};

export default {
  parseCardString,
  sortHandCards,
  getSeatPosition,
  cardsToStrings,
  getTeam
};
