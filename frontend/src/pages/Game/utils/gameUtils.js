import { SUIT_NAMES, RED_SUITS } from '../../../utils/constants';

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

/**
 * 按花色排序手牌
 * 排序顺序: 方片(♦) -> 梅花(♣) -> 红桃(♥) -> 黑桃(♠) -> 大王 -> 小王
 * 每种花色内按点数: 2-10,J,Q,K,A
 */
export const sortHandCards = (hands) => {
  if (!hands || !Array.isArray(hands)) return [];

  return [...hands].sort((a, b) => {
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
