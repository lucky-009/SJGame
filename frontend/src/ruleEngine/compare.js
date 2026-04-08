/**
 * 大小比较模块
 */

import { 
  getCardWeight, 
  isPair, 
  isContinuousPair, 
  isFiveTenK,
  recognizeCardType 
} from './card';
import { CARD_TYPES } from '../utils/constants';

/**
 * 获取牌组中最大的牌
 */
export const getMaxCard = (cards, mainSuit, currentLevel) => {
  if (!cards || cards.length === 0) return null;
  
  let maxCard = cards[0];
  let maxWeight = getCardWeight(maxCard, mainSuit, currentLevel);
  
  for (let i = 1; i < cards.length; i++) {
    const weight = getCardWeight(cards[i], mainSuit, currentLevel);
    if (weight > maxWeight) {
      maxWeight = weight;
      maxCard = cards[i];
    }
  }
  
  return maxCard;
};

/**
 * 比较单张牌大小
 */
export const compareSingle = (card1, card2, mainSuit, currentLevel) => {
  const weight1 = getCardWeight(card1, mainSuit, currentLevel);
  const weight2 = getCardWeight(card2, mainSuit, currentLevel);
  
  if (weight1 > weight2) return 1;
  if (weight1 < weight2) return -1;
  
  // 权重相同，先出的大
  return 0; // 需要根据出牌顺序判断
};

/**
 * 比较对子大小
 */
export const comparePair = (cards1, cards2, mainSuit, currentLevel) => {
  // 对子只需要比较任意一张牌的大小（因为两张相同）
  const card1 = cards1[0];
  const card2 = cards2[0];
  
  const weight1 = getCardWeight(card1, mainSuit, currentLevel);
  const weight2 = getCardWeight(card2, mainSuit, currentLevel);
  
  if (weight1 > weight2) return 1;
  if (weight1 < weight2) return -1;
  
  return 0;
};

/**
 * 比较连对大小
 */
export const compareContinuousPair = (cards1, cards2, mainSuit, currentLevel) => {
  // 获取每组对子中最大的那张牌来比较
  const max1 = getMaxCard(cards1, mainSuit, currentLevel);
  const max2 = getMaxCard(cards2, mainSuit, currentLevel);
  
  const weight1 = getCardWeight(max1, mainSuit, currentLevel);
  const weight2 = getCardWeight(max2, mainSuit, currentLevel);
  
  if (weight1 > weight2) return 1;
  if (weight1 < weight2) return -1;
  
  return 0;
};

/**
 * 比较 510K 大小
 */
export const compareFiveTenK = (cards1, cards2, mainSuit, currentLevel) => {
  // 510K 固定牌型，直接比较任意一张
  const card1 = cards1[0];
  const card2 = cards2[0];
  
  const weight1 = getCardWeight(card1, mainSuit, currentLevel);
  const weight2 = getCardWeight(card2, mainSuit, currentLevel);
  
  if (weight1 > weight2) return 1;
  if (weight1 < weight2) return -1;
  
  return 0;
};

/**
 * 比较组合牌型（如对子+单张）
 * 优先级：按子牌型张数排序，从大到小比较
 */
export const compareCombo = (cards1, cards2, mainSuit, currentLevel) => {
  const type1 = recognizeCardType(cards1, mainSuit, currentLevel);
  const type2 = recognizeCardType(cards2, mainSuit, currentLevel);
  
  if (!type1 || !type2) return 0;
  
  if (type1.type !== 'combo' || type2.type !== 'combo') {
    // 其中一个不是组合牌型，转换为单一牌型比较
    return compareSingleCardType(cards1, cards2, mainSuit, currentLevel);
  }
  
  // 组合牌型比较：按子牌型张数从大到小比较
  const subTypes1 = type1.subTypes.sort((a, b) => b.cards.length - a.cards.length);
  const subTypes2 = type2.subTypes.sort((a, b) => b.cards.length - a.cards.length);
  
  for (let i = 0; i < Math.max(subTypes1.length, subTypes2.length); i++) {
    const sub1 = subTypes1[i];
    const sub2 = subTypes2[i];
    
    if (!sub1 && sub2) return -1;
    if (sub1 && !sub2) return 1;
    
    const result = compareSingleCardType(sub1.cards, sub2.cards, mainSuit, currentLevel);
    if (result !== 0) return result;
  }
  
  return 0;
};

/**
 * 比较单一牌型
 */
export const compareSingleCardType = (cards1, cards2, mainSuit, currentLevel) => {
  const type1 = recognizeCardType(cards1, mainSuit, currentLevel);
  const type2 = recognizeCardType(cards2, mainSuit, currentLevel);
  
  if (!type1 || !type2) return 0;
  
  // 牌型优先级：510K > 连对 > 对子 > 单张
  const typePriority = {
    [CARD_TYPES.FIVE_TEN_K]: 4,
    [CARD_TYPES.CONTINUOUS_PAIR]: 3,
    [CARD_TYPES.PAIR]: 2,
    [CARD_TYPES.SINGLE]: 1
  };
  
  const priority1 = typePriority[type1.type] || 0;
  const priority2 = typePriority[type2.type] || 0;
  
  if (priority1 > priority2) return 1;
  if (priority1 < priority2) return -1;
  
  // 同类型牌型，比较具体大小
  switch (type1.type) {
    case CARD_TYPES.SINGLE:
      return compareSingle(cards1[0], cards2[0], mainSuit, currentLevel);
    case CARD_TYPES.PAIR:
      return comparePair(cards1, cards2, mainSuit, currentLevel);
    case CARD_TYPES.CONTINUOUS_PAIR:
      return compareContinuousPair(cards1, cards2, mainSuit, currentLevel);
    case CARD_TYPES.FIVE_TEN_K:
      return compareFiveTenK(cards1, cards2, mainSuit, currentLevel);
    default:
      return 0;
  }
};

/**
 * 主比较函数
 * @returns 1: cards1大, -1: cards2大, 0: 相等
 */
export const compareCards = (cards1, cards2, mainSuit, currentLevel) => {
  if (!cards1 || cards1.length === 0) return -1;
  if (!cards2 || cards2.length === 0) return 1;
  
  // 首先比较牌型
  const type1 = recognizeCardType(cards1, mainSuit, currentLevel);
  const type2 = recognizeCardType(cards2, mainSuit, currentLevel);
  
  // 组合牌型
  if (type1?.type === 'combo' || type2?.type === 'combo') {
    return compareCombo(cards1, cards2, mainSuit, currentLevel);
  }
  
  return compareSingleCardType(cards1, cards2, mainSuit, currentLevel);
};

/**
 * 获取最大牌组
 */
export const getWinnerCards = (allCards, mainSuit, currentLevel) => {
  if (!allCards || Object.keys(allCards).length === 0) return null;
  
  let winnerSeat = null;
  let winnerCards = null;
  let maxWeight = -1;
  
  Object.entries(allCards).forEach(([seat, cards]) => {
    if (!cards || cards.length === 0) return;
    
    const weight = getMaxCard(cards, mainSuit, currentLevel);
    const cardWeight = getCardWeight(weight, mainSuit, currentLevel);
    
    if (cardWeight > maxWeight) {
      maxWeight = cardWeight;
      winnerSeat = seat;
      winnerCards = cards;
    }
  });
  
  return {
    seat: winnerSeat,
    cards: winnerCards,
    weight: maxWeight
  };
};

/**
 * 计算抠底倍数
 */
export const calculateBottomMultiplier = (winningCards) => {
  if (!winningCards || winningCards.length === 0) return 1;
  
  const type = recognizeCardType(winningCards);
  
  if (!type) return 1;
  
  switch (type.type) {
    case CARD_TYPES.SINGLE:
      return 2;
    case CARD_TYPES.PAIR:
      return 4;
    case CARD_TYPES.CONTINUOUS_PAIR:
      return winningCards.length * 2;
    case CARD_TYPES.FIVE_TEN_K:
      return 8;
    default:
      return 1;
  }
};
