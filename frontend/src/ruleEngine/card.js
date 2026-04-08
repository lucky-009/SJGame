/**
 * 牌型判断模块
 */

import { RANKS, SUITS, CARD_TYPES } from '../utils/constants';

/**
 * 判断是否为固定主牌
 * 固定主：红桃5、大王、小王、等级牌
 */
export const isFixedTrump = (card, currentLevel = '2') => {
  if (!card) return false;
  
  // 红桃5
  if (card.suit === SUITS.HEART && card.rank === '5') {
    return true;
  }
  
  // 大小王
  if (card.suit === 'joker') {
    return true;
  }
  
  // 等级牌
  if (card.rank === currentLevel) {
    return true;
  }
  
  return false;
};

/**
 * 判断是否为主牌
 */
export const isTrump = (card, mainSuit = null, currentLevel = '2') => {
  if (!card) return false;
  
  // 固定主
  if (isFixedTrump(card, currentLevel)) {
    return true;
  }
  
  // 主花色非固定主
  if (mainSuit && mainSuit !== SUITS.NONE && card.suit === mainSuit) {
    return true;
  }
  
  return false;
};

/**
 * 获取牌的权重（用于比较大小）
 */
export const getCardWeight = (card, mainSuit = null, currentLevel = '2') => {
  if (!card) return 0;
  
  const rankValue = RANKS[card.rank] || 0;
  
  // 大小王
  if (card.suit === 'joker') {
    if (card.rank === 'big') return 100; // 大王
    if (card.rank === 'small') return 99; // 小王
  }
  
  // 红桃5
  if (card.suit === SUITS.HEART && card.rank === '5') {
    return 98;
  }
  
  // 等级牌
  if (card.rank === currentLevel) {
    // 主花色等级牌 > 非主花色等级牌
    if (card.suit === mainSuit) {
      return 90 + rankValue;
    }
    return 80 + rankValue;
  }
  
  // 主花色普通牌
  if (mainSuit && card.suit === mainSuit) {
    return 50 + rankValue;
  }
  
  // 副牌
  return rankValue;
};

/**
 * 判断花色是否相同
 */
export const isSameSuit = (cardA, cardB) => {
  return cardA.suit === cardB.suit;
};

/**
 * 判断等级是否相同
 */
export const isSameRank = (cardA, cardB) => {
  return cardA.rank === cardB.rank;
};

/**
 * 判断是否为分数牌
 */
export const isScoreCard = (card) => {
  return card.rank === '5' || card.rank === '10' || card.rank === 'K';
};

/**
 * 计算分数
 */
export const calculateScore = (cards) => {
  return cards.reduce((score, card) => {
    if (card.rank === '5') return score + 5;
    if (card.rank === '10') return score + 10;
    if (card.rank === 'K') return score + 10;
    return score;
  }, 0);
};

/**
 * 判断是否为对子
 */
export const isPair = (cards) => {
  if (!cards || cards.length !== 2) return false;
  return isSameSuit(cards[0], cards[1]) && isSameRank(cards[0], cards[1]);
};

/**
 * 判断是否为连对
 */
export const isContinuousPair = (cards, mainSuit = null, currentLevel = '2') => {
  if (!cards || cards.length < 4 || cards.length % 2 !== 0) return false;
  
  // 必须都是对子且同花色
  for (let i = 0; i < cards.length; i += 2) {
    const pair = [cards[i], cards[i + 1]];
    if (!isPair(pair)) {
      return false;
    }
    // 检查花色一致（连对必须同花色）
    if (i > 0 && cards[i].suit !== cards[i - 2].suit) {
      return false;
    }
  }
  
  // 必须等级连续
  for (let i = 0; i < cards.length - 2; i += 2) {
    const rank1 = RANKS[cards[i].rank];
    const rank2 = RANKS[cards[i + 2].rank];
    if (rank1 - rank2 !== 1) {
      return false;
    }
  }
  
  return true;
};

/**
 * 判断是否为 510K
 */
export const isFiveTenK = (cards) => {
  if (!cards || cards.length !== 3) return false;
  
  // 必须同花色
  const suit = cards[0].suit;
  if (!cards.every(card => card.suit === suit)) {
    return false;
  }
  
  // 必须包含 5、10、K
  const ranks = cards.map(c => c.rank).sort();
  return ranks.includes('5') && ranks.includes('10') && ranks.includes('K');
};

/**
 * 识别单种牌型
 */
export const identifyCardType = (cards) => {
  if (!cards || cards.length === 0) return null;
  
  if (cards.length === 1) {
    return { type: CARD_TYPES.SINGLE, mainType: 'single', cards };
  }
  
  if (isPair(cards)) {
    return { type: CARD_TYPES.PAIR, mainType: 'pair', cards };
  }
  
  if (isContinuousPair(cards)) {
    return { type: CARD_TYPES.CONTINUOUS_PAIR, mainType: 'continuous_pair', cards };
  }
  
  if (isFiveTenK(cards)) {
    return { type: CARD_TYPES.FIVE_TEN_K, mainType: 'five_ten_k', cards };
  }
  
  return null;
};

/**
 * 分析组合牌型（如对子+单张）
 */
export const analyzeCombo = (cards, mainSuit = null, currentLevel = '2') => {
  if (!cards || cards.length === 0) return null;
  
  // 按花色分组
  const suitGroups = {};
  cards.forEach(card => {
    if (!suitGroups[card.suit]) {
      suitGroups[card.suit] = [];
    }
    suitGroups[card.suit].push(card);
  });
  
  // 识别各花色中的牌型
  const subTypes = [];
  Object.entries(suitGroups).forEach(([suit, suitCards]) => {
    const type = identifyCardType(suitCards);
    if (type) {
      subTypes.push({ ...type, suit });
    }
  });
  
  // 按张数排序（从多到少）
  subTypes.sort((a, b) => b.cards.length - a.cards.length);
  
  if (subTypes.length > 0) {
    return {
      type: 'combo',
      subTypes,
      cards
    };
  }
  
  return null;
};

/**
 * 识别牌型（入口函数）
 */
export const recognizeCardType = (cards, mainSuit = null, currentLevel = '2') => {
  if (!cards || cards.length === 0) return null;
  
  // 先尝试识别单一牌型
  const singleType = identifyCardType(cards);
  if (singleType) {
    return singleType;
  }
  
  // 尝试识别组合牌型
  return analyzeCombo(cards, mainSuit, currentLevel);
};
