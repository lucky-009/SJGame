/**
 * 游戏规则引擎入口
 */

import * as card from './card';
import * as follow from './follow';
import * as compareModule from './compare';

/**
 * 校验出牌是否合法
 */
export const checkValid = (selectedCards, leadCards, hand, leadSuit, mainSuit, currentLevel) => {
  if (!selectedCards || selectedCards.length === 0) {
    return { valid: false, error: '请选择要出的牌' };
  }
  
  // 首家出牌
  if (!leadCards || leadCards.length === 0) {
    return follow.validateLeadPlay(selectedCards);
  }
  
  // 跟牌
  return follow.validateFollowPlay(
    selectedCards,
    hand,
    leadCards,
    leadSuit,
    null, // leadCardType
    mainSuit,
    currentLevel
  );
};

/**
 * 获取出牌提示
 */
export const getPlayHint = (hand, leadCards, leadSuit, mainSuit, currentLevel) => {
  return follow.getFollowHint(hand, leadCards, leadSuit, mainSuit, currentLevel);
};

/**
 * 比较两组牌的大小
 */
export const compare = (cards1, cards2, mainSuit, currentLevel) => {
  return compareModule.compareCards(cards1, cards2, mainSuit, currentLevel);
};

/**
 * 识别牌型
 */
export const recognize = (cards, mainSuit, currentLevel) => {
  return card.recognizeCardType(cards, mainSuit, currentLevel);
};

/**
 * 判断是否为主牌
 */
export const isTrump = (card, mainSuit, currentLevel) => {
  return card.isTrump(card, mainSuit, currentLevel);
};

/**
 * 计算分数
 */
export const calculateScore = (cards) => {
  return card.calculateScore(cards);
};

/**
 * 计算抠底分数
 */
export const calculateBottomScore = (bottomCards, winningCards, mainSuit, currentLevel) => {
  const baseScore = card.calculateScore(bottomCards);
  const multiplier = compareModule.calculateBottomMultiplier(winningCards);
  return baseScore * multiplier;
};

/**
 * 获取最大牌
 */
export const getMaxCard = (cards, mainSuit, currentLevel) => {
  return compareModule.getMaxCard(cards, mainSuit, currentLevel);
};

/**
 * 获取赢牌方
 */
export const getWinner = (allCards, mainSuit, currentLevel) => {
  return compareModule.getWinnerCards(allCards, mainSuit, currentLevel);
};

export default {
  checkValid,
  getPlayHint,
  compare,
  recognize,
  isTrump,
  calculateScore,
  calculateBottomScore,
  getMaxCard,
  getWinner
};
