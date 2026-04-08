/**
 * 跟牌规则模块
 */

import { isTrump, isSameSuit } from './card';
import { SUITS, PLAY_TYPES } from '../utils/constants';

/**
 * 判断是否需要跟牌
 * @param {Array} hand - 玩家手牌
 * @param {String} leadSuit - 首家出牌花色
 * @param {String} mainSuit - 主花色
 * @param {String} currentLevel - 当前等级
 * @returns {Boolean} - 是否需要跟牌
 */
export const needToFollowSuit = (hand, leadSuit, mainSuit, currentLevel) => {
  if (!leadSuit) return false;
  
  // 首家出主牌，不需要跟牌
  // 这里需要判断首家是否出的是主牌
  // 简化处理：如果是主花色或者leadSuit是主牌的花色
  return true;
};

/**
 * 获取某花色的牌
 */
export const getSuitCards = (cards, suit) => {
  return cards.filter(card => card.suit === suit);
};

/**
 * 获取主牌
 */
export const getTrumpCards = (cards, mainSuit, currentLevel) => {
  return cards.filter(card => isTrump(card, mainSuit, currentLevel));
};

/**
 * 获取副牌（非主牌）
 */
export const getNonTrumpCards = (cards, mainSuit, currentLevel) => {
  return cards.filter(card => !isTrump(card, mainSuit, currentLevel));
};

/**
 * 判断玩家是否有某花色的牌
 */
export const hasSuit = (hand, suit) => {
  return hand.some(card => card.suit === suit);
};

/**
 * 判断玩家是否有主牌
 */
export const hasTrump = (hand, mainSuit, currentLevel) => {
  return hand.some(card => isTrump(card, mainSuit, currentLevel));
};

/**
 * 校验首家出牌是否合法
 */
export const validateLeadPlay = (cards) => {
  if (!cards || cards.length === 0) {
    return { valid: false, error: '请选择要出的牌' };
  }
  
  // 检查是否所有牌都是同一花色（主牌或副牌）
  const suits = new Set(cards.map(c => c.suit));
  
  // 主牌可以混合花色（大王、小王、等级牌）
  const mainSuits = new Set(['joker', 'joker_big', 'joker_small']);
  const isAllMain = cards.every(card => 
    mainSuits.has(card.suit) || card.suit === 'joker' || card.rank === '2' || card.rank === '3' || 
    card.rank === '4' || card.rank === '5' || card.rank === '6' || card.rank === '7' || 
    card.rank === '8' || card.rank === '9' || card.rank === '10' || card.rank === 'J' ||
    card.rank === 'Q' || card.rank === 'K' || card.rank === 'A'
  );
  
  // 副牌必须是同一花色
  const nonMainCards = cards.filter(card => {
    if (card.suit === 'joker') return false;
    if (card.rank === '5' && card.suit === 'heart') return false; // 红桃5是主牌
    return card.suit !== 'joker';
  });
  
  if (nonMainCards.length > 0) {
    const nonMainSuits = new Set(nonMainCards.map(c => c.suit));
    if (nonMainSuits.size > 1) {
      return { valid: false, error: '副牌必须为同一花色' };
    }
  }
  
  return { valid: true };
};

/**
 * 校验跟牌是否合法
 */
export const validateFollowPlay = (selectedCards, hand, leadCards, leadSuit, leadCardType, mainSuit, currentLevel) => {
  // 获取首家出的牌的花色
  const leadCardsGrouped = groupCardsBySuit(leadCards);
  const leadGroupSuits = Object.keys(leadCardsGrouped);
  
  // 如果首家出的是主牌
  const leadIsTrump = leadGroupSuits.every(suit => {
    if (suit === 'joker') return true;
    return isTrump({ suit, rank: 'A' }, mainSuit, currentLevel); // 简化判断
  });
  
  if (leadIsTrump) {
    // 首家出主牌：必须出主牌，如果没有主牌则可以贴牌
    const myTrumps = getTrumpCards(hand, mainSuit, currentLevel);
    if (myTrumps.length === 0) {
      // 没有主牌，可以贴任意牌
      return { valid: true, playType: PLAY_TYPES.DISCARD };
    }
    
    // 检查是否出的是主牌
    const selectedTrumps = getTrumpCards(selectedCards, mainSuit, currentLevel);
    if (selectedTrumps.length < selectedCards.length) {
      // 混入了副牌，贴牌
      return { valid: true, playType: PLAY_TYPES.DISCARD };
    }
    
    return { valid: true, playType: PLAY_TYPES.NORMAL };
  }
  
  // 首家出副牌
  const leadNonTrumpSuit = leadGroupSuits.find(suit => !isTrump({ suit, rank: 'A' }, mainSuit, currentLevel));
  
  // 检查玩家是否有该花色副牌
  const hasLeadSuit = hasSuit(hand, leadNonTrumpSuit);
  
  if (hasLeadSuit) {
    // 有该花色副牌，必须跟该花色
    const selectedNonTrumps = selectedCards.filter(card => 
      !isTrump(card, mainSuit, currentLevel)
    );
    
    const selectedLeadSuitCards = selectedNonTrumps.filter(card => 
      card.suit === leadNonTrumpSuit
    );
    
    if (selectedLeadSuitCards.length < selectedNonTrumps.length) {
      // 混入了其他花色，不合法
      return { valid: false, error: '必须跟牌' };
    }
    
    // 检查张数是否足够
    const leadSuitCount = hand.filter(card => card.suit === leadNonTrumpSuit).length;
    if (selectedLeadSuitCards.length < leadSuitCount && selectedLeadSuitCards.length < leadCards.length) {
      // 贴牌
      return { valid: true, playType: PLAY_TYPES.DISCARD };
    }
    
    return { valid: true, playType: PLAY_TYPES.NORMAL };
  } else {
    // 没有该花色副牌，可以毙牌或贴牌
    
    // 判断是否全主牌且结构匹配（毙牌）
    const allTrump = selectedCards.every(card => 
      isTrump(card, mainSuit, currentLevel)
    );
    
    // 检查结构是否匹配
    const structureMatch = checkStructureMatch(selectedCards, leadCards);
    
    if (allTrump && structureMatch) {
      return { valid: true, playType: PLAY_TYPES.TRUMP };
    }
    
    // 否则为贴牌
    return { valid: true, playType: PLAY_TYPES.DISCARD };
  }
};

/**
 * 按花色分组
 */
export const groupCardsBySuit = (cards) => {
  const groups = {};
  cards.forEach(card => {
    if (!groups[card.suit]) {
      groups[card.suit] = [];
    }
    groups[card.suit].push(card);
  });
  return groups;
};

/**
 * 检查结构是否匹配
 */
export const checkStructureMatch = (cards1, cards2) => {
  const group1 = groupCardsBySuit(cards1);
  const group2 = groupCardsBySuit(cards2);
  
  const size1 = Object.values(group1).map(g => g.length).sort((a, b) => b - a);
  const size2 = Object.values(group2).map(g => g.length).sort((a, b) => b - a);
  
  return size1.join(',') === size2.join(',');
};

/**
 * 获取跟牌提示
 */
export const getFollowHint = (hand, leadCards, leadSuit, mainSuit, currentLevel) => {
  const hints = {
    mustFollow: false,
    canTrump: false,
    canDiscard: false,
    followSuit: null
  };
  
  // 判断首家是否出主牌
  const leadIsTrump = leadCards.every(card => 
    isTrump(card, mainSuit, currentLevel)
  );
  
  if (leadIsTrump) {
    // 首家出主牌
    const myTrumps = getTrumpCards(hand, mainSuit, currentLevel);
    if (myTrumps.length > 0) {
      hints.mustFollow = true;
      hints.canTrump = true;
    } else {
      hints.canDiscard = true;
    }
  } else {
    // 首家出副牌
    const leadNonTrumpSuit = leadCards.find(card => 
      !isTrump(card, mainSuit, currentLevel)
    )?.suit;
    
    if (leadNonTrumpSuit) {
      const hasLeadSuit = hasSuit(hand, leadNonTrumpSuit);
      
      if (hasLeadSuit) {
        hints.mustFollow = true;
        hints.followSuit = leadNonTrumpSuit;
      } else {
        // 没有该花色，可以毙牌或贴牌
        const myTrumps = getTrumpCards(hand, mainSuit, currentLevel);
        if (myTrumps.length > 0) {
          hints.canTrump = true;
        }
        hints.canDiscard = true;
      }
    }
  }
  
  return hints;
};
