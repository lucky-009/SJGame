/**
 * 牌工具函数
 */

import { SUITS, RANKS, SUIT_NAMES, RANK_NAMES } from './constants';

/**
 * 创建一张牌
 */
export const createCard = (suit, rank, id = null) => ({
  suit,
  rank,
  id: id || `${suit}_${rank}`,
  // 牌的显示名称，如 "♠A"
  displayName: () => `${SUIT_NAMES[suit]}${RANK_NAMES[rank]}`,
  // 牌的值（用于比较大小）
  value: () => RANKS[rank]
});

/**
 * 生成一副牌（108张，两副扑克）
 */
export const generateDeck = () => {
  const deck = [];
  const ranks = Object.keys(RANKS).filter(r => !isNaN(parseInt(r)) || ['J', 'Q', 'K', 'A'].includes(r));
  const suits = [SUITS.SPADE, SUITS.HEART, SUITS.CLUB, SUITS.DIAMOND];
  
  // 生成两副牌
  for (let i = 0; i < 2; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(createCard(suit, rank, `${suit}_${rank}_${i}`));
      }
    }
  }
  
  // 添加大小王
  deck.push(createCard('joker', 'small', 'joker_small_0'));
  deck.push(createCard('joker', 'small', 'joker_small_1'));
  deck.push(createCard('joker', 'big', 'joker_big_0'));
  deck.push(createCard('joker', 'big', 'joker_big_1'));
  
  return deck;
};

/**
 * 洗牌
 */
export const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * 发牌（每人25张，剩余8张底牌）
 */
export const dealCards = (deck, playerCount = 4) => {
  const hands = Array(playerCount).fill(null).map(() => []);
  let cardIndex = 0;
  
  // 每人发一张，循环直到发完100张
  while (cardIndex < 100) {
    for (let i = 0; i < playerCount && cardIndex < 100; i++) {
      hands[i].push(deck[cardIndex++]);
    }
  }
  
  // 剩余8张为底牌
  const bottomCards = deck.slice(100);
  
  return { hands, bottomCards };
};

/**
 * 牌排序（按花色和等级）
 */
export const sortCards = (cards, mainSuit = null, currentLevel = '2') => {
  const suitOrder = {
    [SUITS.HEART]: 0,    // 红桃优先级最高（主花色时）
    [SUITS.SPADE]: 1,
    [SUITS.CLUB]: 2,
    [SUITS.DIAMOND]: 3,
    'joker': 4          // 大小王
  };
  
  // 如果有主花色，调整花色顺序
  if (mainSuit && mainSuit !== SUITS.NONE) {
    suitOrder[mainSuit] = -1; // 主花色排最前
  }
  
  return [...cards].sort((a, b) => {
    // 先按花色排序
    const suitA = suitOrder[a.suit] ?? 5;
    const suitB = suitOrder[b.suit] ?? 5;
    
    if (suitA !== suitB) {
      return suitA - suitB;
    }
    
    // 再按等级排序
    const rankA = RANKS[a.rank] || 0;
    const rankB = RANKS[b.rank] || 0;
    
    return rankB - rankA; // 从大到小
  });
};

/**
 * 判断是否为固定主牌
 * 固定主：红桃5、大王、小王、等级牌
 */
export const isFixedTrump = (card, currentLevel = '2') => {
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
 * 判断是否为对子
 */
export const isPair = (cards) => {
  if (cards.length !== 2) return false;
  return isSameSuit(cards[0], cards[1]) && isSameRank(cards[0], cards[1]);
};

/**
 * 判断是否为连对
 */
export const isContinuousPair = (cards) => {
  if (cards.length < 4 || cards.length % 2 !== 0) return false;
  
  // 必须都是对子
  for (let i = 0; i < cards.length; i += 2) {
    if (!isPair([cards[i], cards[i + 1]])) {
      return false;
    }
  }
  
  // 必须花色相同且等级连续
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
  if (cards.length !== 3) return false;
  
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
 * 识别牌型
 */
export const identifyCardType = (cards) => {
  if (cards.length === 0) return null;
  
  if (cards.length === 1) {
    return { type: 'single', cards };
  }
  
  if (isPair(cards)) {
    return { type: 'pair', cards };
  }
  
  if (isContinuousPair(cards)) {
    return { type: 'continuous_pair', cards };
  }
  
  if (isFiveTenK(cards)) {
    return { type: 'five_ten_k', cards };
  }
  
  // 组合牌型（如对子+单张）
  return { type: 'combo', cards };
};
