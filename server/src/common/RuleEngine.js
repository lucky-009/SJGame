/**
 * 规则引擎
 * 处理出牌校验、牌型判断等核心规则
 */

const {
  isTrump, isSameSuit, isLevelCard, getTrumpWeight,
  isFixedTrump, getLevelValue, LEVEL_RANKS
} = require('./CardUtils');

// 牌型定义
const PLAY_TYPES = {
  NORMAL: 'normal',     // 正常跟牌
  TRUMP_KILL: 'trumpKill',  // 毙牌
  DISCARD: 'discard'   // 贴牌
};

/**
 * 分析牌型结构
 * 返回牌型信息：类型、各子牌型
 */
function analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel) {
  if (!cards || cards.length === 0) {
    return { isValid: false, reason: '空牌' };
  }

  // 按花色分组
  const suitGroups = {};
  for (const card of cards) {
    if (!suitGroups[card.suit]) {
      suitGroups[card.suit] = [];
    }
    suitGroups[card.suit].push(card);
  }

  // 判断是否为全部主牌
  const isAllTrump = cards.every(card =>
    isTrump(card, trumpSuit, isNoTrump, currentLevel)
  );

  // 分析每个花色组的牌型
  const patterns = [];
  for (const [suit, suitCards] of Object.entries(suitGroups)) {
    // 该花色是否为主牌
    const isMainSuit = suit === 'joker' ||
      (trumpSuit && suit === trumpSuit) ||
      (isNoTrump && isFixedTrump({ suit, rank: suitCards[0].rank }, currentLevel));

    const pattern = analyzeSuitPattern(suitCards, isMainSuit, currentLevel);
    patterns.push({
      suit,
      isMainSuit,
      ...pattern
    });
  }

  // 确定主导类型
  const leadPattern = patterns[0]; // 首家出的花色
  const isLeadTrump = isAllTrump; // 是否为主牌局

  return {
    isValid: true,
    isAllTrump,
    isLeadTrump,
    leadSuit: leadPattern?.suit,
    leadPattern: leadPattern?.pattern || null,
    patterns
  };
}

/**
 * 分析同花色牌的牌型
 */
function analyzeSuitPattern(cards, isMainSuit, currentLevel) {
  const count = cards.length;

  // 按点数分组
  const rankGroups = {};
  for (const card of cards) {
    if (!rankGroups[card.rank]) {
      rankGroups[card.rank] = [];
    }
    rankGroups[card.rank].push(card);
  }

  const rankCounts = Object.values(rankGroups).map(g => g.length);
  const hasPairs = rankCounts.includes(2);
  const hasTriple = rankCounts.includes(3);

  // 1张 - 单张
  if (count === 1) {
    return {
      pattern: 'single',
      subPatterns: [{ type: 'single', count: 1, cards }]
    };
  }

  // 2张 - 对子或两张单张
  if (count === 2) {
    if (hasPairs) {
      // 检查是否为连对（主花色连对）
      if (isMainSuit) {
        const ranks = Object.keys(rankGroups).sort((a, b) => {
          const va = isLevelCard(a) ? getLevelValue(a) : parseInt(a);
          const vb = isLevelCard(b) ? getLevelValue(b) : parseInt(b);
          return va - vb;
        });
        if (ranks.length === 2) {
          const r1 = ranks[0];
          const r2 = ranks[1];
          const v1 = isLevelCard(r1) ? getLevelValue(r1) : parseInt(r1);
          const v2 = isLevelCard(r2) ? getLevelValue(r2) : parseInt(r2);
          if (Math.abs(v2 - v1) === 1) {
            return {
              pattern: 'pairSequence',
              subPatterns: [
                { type: 'pair', count: 2, rank: r1, cards: rankGroups[r1] },
                { type: 'pair', count: 2, rank: r2, cards: rankGroups[r2] }
              ]
            };
          }
        }
      }
      return {
        pattern: 'pair',
        subPatterns: [{ type: 'pair', count: 2, cards }]
      };
    }
    return {
      pattern: 'twoSingle',
      subPatterns: [
        { type: 'single', count: 1, cards: [cards[0]] },
        { type: 'single', count: 1, cards: [cards[1]] }
      ]
    };
  }

  // 3张 - 510K 或 三张
  if (count === 3) {
    const ranks = Object.keys(rankGroups);
    if (ranks.includes('5') && ranks.includes('10') && ranks.includes('K')) {
      return {
        pattern: '510K',
        subPatterns: [{ type: '510K', count: 3, cards }]
      };
    }
    if (hasTriple) {
      return {
        pattern: 'triple',
        subPatterns: [{ type: 'triple', count: 3, cards }]
      };
    }
    // 对子 + 单张
    if (hasPairs) {
      const pairRank = ranks.find(r => rankGroups[r].length === 2);
      const singleRank = ranks.find(r => rankGroups[r].length === 1);
      return {
        pattern: 'pairPlusSingle',
        subPatterns: [
          { type: 'pair', count: 2, rank: pairRank, cards: rankGroups[pairRank] },
          { type: 'single', count: 1, rank: singleRank, cards: rankGroups[singleRank] }
        ]
      };
    }
    // 三张单张
    return {
      pattern: 'threeSingle',
      subPatterns: [
        { type: 'single', count: 1, cards: [cards[0]] },
        { type: 'single', count: 1, cards: [cards[1]] },
        { type: 'single', count: 1, cards: [cards[2]] }
      ]
    };
  }

  // 4张及以上 - 复杂牌型
  // 检查是否为连对
  const sortedRanks = Object.keys(rankGroups).sort((a, b) => {
    const va = isLevelCard(a) ? getLevelValue(a) : parseInt(a);
    const vb = isLevelCard(b) ? getLevelValue(b) : parseInt(b);
    return va - vb;
  });

  // 检查连对
  if (isMainSuit && sortedRanks.length >= 2) {
    let isSequence = true;
    let prevValue = -1;
    for (const rank of sortedRanks) {
      if (rankGroups[rank].length !== 2) {
        isSequence = false;
        break;
      }
      const value = isLevelCard(rank) ? getLevelValue(rank) : parseInt(rank);
      if (prevValue !== -1 && value !== prevValue + 1) {
        // 允许跳过等级牌
        if (prevValue + 2 === value && isLevelCard(String(prevValue + 1))) {
          // 跳过等级牌，继续检查
        } else {
          isSequence = false;
          break;
        }
      }
      prevValue = value;
    }
    if (isSequence && sortedRanks.length >= 2) {
      return {
        pattern: 'pairSequence',
        subPatterns: sortedRanks.map(rank => ({
          type: 'pair',
          count: 2,
          rank,
          cards: rankGroups[rank]
        }))
      };
    }
  }

  // 默认：混合牌型（按子牌型大小排序）
  const subPatterns = [];
  for (const [rank, groupCards] of Object.entries(rankGroups)) {
    subPatterns.push({
      type: groupCards.length === 1 ? 'single' :
            groupCards.length === 2 ? 'pair' : 'triple',
      count: groupCards.length,
      rank,
      cards: groupCards
    });
  }

  // 按数量降序排列
  subPatterns.sort((a, b) => b.count - a.count);

  return {
    pattern: 'mixed',
    subPatterns
  };
}

/**
 * 校验出牌是否合法
 */
function validatePlay(cards, handCards, firstPlay, trumpSuit, isNoTrump, currentLevel) {
  // 基础检查
  if (!cards || cards.length === 0) {
    return { isValid: false, reason: '请选择要出的牌' };
  }

  // 检查手牌是否包含这些牌
  const handStrs = handCards.map(c => `${c.suit}_${c.rank}`);
  for (const card of cards) {
    const cardStr = `${card.suit}_${card.rank}`;
    const idx = handStrs.indexOf(cardStr);
    if (idx === -1) {
      return { isValid: false, reason: `手牌中不存在 ${cardStr}` };
    }
  }

  // 首家出牌检查
  if (firstPlay) {
    return validateFirstPlay(cards, trumpSuit, isNoTrump, currentLevel);
  }

  // 跟牌检查
  return validateFollowPlay(cards, trumpSuit, isNoTrump, currentLevel);
}

/**
 * 校验首家出牌
 */
function validateFirstPlay(cards, trumpSuit, isNoTrump, currentLevel) {
  // 牌型分析
  const patternInfo = analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel);
  if (!patternInfo.isValid) {
    return { isValid: false, reason: patternInfo.reason };
  }

  // 规则1：必须为同一花色体系（副牌 或 主牌）
  if (!patternInfo.isAllTrump && Object.keys(patternInfo.patterns).length > 1) {
    return { isValid: false, reason: '首家出牌必须为同一花色' };
  }

  // 规则2：不允许主副混合
  const suits = Object.keys(patternInfo.patterns);
  if (suits.length > 1) {
    const hasTrump = suits.some(s => patternInfo.patterns.find(p => p.suit === s)?.isMainSuit);
    const hasNonTrump = suits.some(s => patternInfo.patterns.find(p => p.suit === s)?.isMainSuit === false);
    if (hasTrump && hasNonTrump) {
      return { isValid: false, reason: '主牌和副牌不能混合出' };
    }
  }

  return { isValid: true, patternInfo };
}

/**
 * 校验跟牌
 */
function validateFollowPlay(cards, trumpSuit, isNoTrump, currentLevel) {
  // 简化处理：牌型合法即可
  // 实际应该传入首家牌型进行严格校验
  return { isValid: true };
}

/**
 * 判断出牌类型（毙牌/正常/贴牌）
 */
function classifyPlayType(cards, leadSuit, leadPattern, trumpSuit, isNoTrump, currentLevel) {
  // 如果首家是主牌
  if (leadPattern?.isLeadTrump) {
    // 有主必须出主
    const hasTrump = cards.some(c => isTrump(c, trumpSuit, isNoTrump, currentLevel));
    if (!hasTrump) {
      return PLAY_TYPES.DISCARD; // 贴牌
    }
    // 结构匹配为毙牌，否则为贴牌
    return analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel).isAllTrump
      ? PLAY_TYPES.TRUMP_KILL
      : PLAY_TYPES.DISCARD;
  }

  // 首家是副牌
  // 检查是否有该花色副牌
  const hasLeadSuit = cards.some(c => c.suit === leadSuit && !isTrump(c, trumpSuit, isNoTrump, currentLevel));

  if (!hasLeadSuit) {
    // 没有该花色副牌，检查是否可以用主牌毙牌
    const isAllTrump = cards.every(c => isTrump(c, trumpSuit, isNoTrump, currentLevel));
    if (isAllTrump) {
      return PLAY_TYPES.TRUMP_KILL;
    }
    return PLAY_TYPES.DISCARD;
  }

  return PLAY_TYPES.NORMAL;
}

/**
 * 比较两副牌的大小
 * @param {Array} cards1 第一副牌
 * @param {Array} cards2 第二副牌
 * @param {String} trumpSuit 主花色
 * @param {Boolean} isNoTrump 是否无主
 * @param {Number} currentLevel 当前等级
 * @param {Number} seat1 第一副牌的座位
 * @param {Number} seat2 第二副牌的座位
 * @returns {Number} 1: cards1大, -1: cards2大, 0: 相等
 */
function comparePlays(cards1, cards2, trumpSuit, isNoTrump, currentLevel, seat1, seat2) {
  const pattern1 = analyzePlayPattern(cards1, trumpSuit, isNoTrump, currentLevel);
  const pattern2 = analyzePlayPattern(cards2, trumpSuit, isNoTrump, currentLevel);

  if (!pattern1.isValid || !pattern2.isValid) {
    return 0;
  }

  // 牌型结构不一致时，先出的赢
  if (pattern1.leadPattern?.pattern !== pattern2.leadPattern?.pattern) {
    // 优先比较子牌型数量
    const subCount1 = pattern1.leadPattern?.subPatterns?.length || 0;
    const subCount2 = pattern2.leadPattern?.subPatterns?.length || 0;
    if (subCount1 !== subCount2) {
      return subCount2 - subCount1 > 0 ? -1 : 1;
    }
  }

  // 找出最大的子牌型进行比较
  const maxSub1 = getMaxSubPattern(cards1, trumpSuit, isNoTrump, currentLevel);
  const maxSub2 = getMaxSubPattern(cards2, trumpSuit, isNoTrump, currentLevel);

  const weight1 = getSubPatternWeight(maxSub1, trumpSuit, isNoTrump, currentLevel);
  const weight2 = getSubPatternWeight(maxSub2, trumpSuit, isNoTrump, currentLevel);

  if (weight1 > weight2) return 1;
  if (weight1 < weight2) return -1;

  // 同大小，先出赢
  return 0;
}

/**
 * 获取最大的子牌型
 */
function getMaxSubPattern(cards, trumpSuit, isNoTrump, currentLevel) {
  const pattern = analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel);
  const subPatterns = pattern.leadPattern?.subPatterns || [];

  if (subPatterns.length === 0) return null;

  // 按子牌型数量降序，然后按权重降序
  return subPatterns.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const wa = getSubPatternWeight(a, trumpSuit, isNoTrump, currentLevel);
    const wb = getSubPatternWeight(b, trumpSuit, isNoTrump, currentLevel);
    return wb - wa;
  })[0];
}

/**
 * 获取子牌型权重
 */
function getSubPatternWeight(subPattern, trumpSuit, isNoTrump, currentLevel) {
  if (!subPattern) return 0;

  if (subPattern.type === 'single') {
    const card = subPattern.cards[0];
    return getTrumpWeight(card, trumpSuit, isNoTrump, currentLevel);
  }

  if (subPattern.type === 'pair') {
    const card = subPattern.cards[0];
    return getTrumpWeight(card, trumpSuit, isNoTrump, currentLevel) * 1.5;
  }

  if (subPattern.type === 'triple') {
    const card = subPattern.cards[0];
    return getTrumpWeight(card, trumpSuit, isNoTrump, currentLevel) * 2;
  }

  if (subPattern.type === '510K') {
    return 1000; // 510K 最大
  }

  return 0;
}

/**
 * 计算抠底倍数
 */
function getBottomMultiplier(cards, trumpSuit, isNoTrump, currentLevel) {
  const pattern = analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel);
  const mainPattern = pattern.leadPattern?.pattern;

  if (mainPattern === 'single') return 2;
  if (mainPattern === 'pair') return 4;
  if (mainPattern === 'pairSequence') {
    return cards.length * 2;
  }
  if (mainPattern === '510K') return 8;

  return 2; // 默认
}

module.exports = {
  PLAY_TYPES,
  analyzePlayPattern,
  analyzeSuitPattern,
  validatePlay,
  validateFirstPlay,
  validateFollowPlay,
  classifyPlayType,
  comparePlays,
  getBottomMultiplier
};
