/**
 * 扑克牌工具类
 * 处理牌堆生成、洗牌、牌面解析等
 */

// 花色定义
const SUITS = {
  SPADE: 'spade',   // 黑桃
  HEART: 'heart',   // 红桃
  CLUB: 'club',     // 梅花
  DIAMOND: 'diamond', // 方片
  JOKER: 'joker'    // 王牌
};

// 点数定义
const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// 等级牌（用于确定主牌）
const LEVEL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 生成一副牌（108张）
 * 使用两副扑克牌
 */
function generateDeck() {
  const deck = [];
  const suitKeys = [SUITS.SPADE, SUITS.HEART, SUITS.CLUB, SUITS.DIAMOND];

  // 每种花色 A-K 各两张
  for (let i = 0; i < 2; i++) {
    for (const suit of suitKeys) {
      for (const rank of LEVEL_RANKS) {
        deck.push({ suit, rank, value: RANKS[rank] });
      }
    }
  }

  // 大王小王各两张
  for (let i = 0; i < 2; i++) {
    deck.push({ suit: SUITS.JOKER, rank: 'big', value: 16 });   // 大王
    deck.push({ suit: SUITS.JOKER, rank: 'small', value: 15 }); // 小王
  }

  return deck;
}

/**
 * 洗牌（Fisher-Yates 算法）
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 牌面转字符串
 */
function cardToString(card) {
  return `${card.suit}_${card.rank}`;
}

/**
 * 字符串转牌面
 */
function stringToCard(str) {
  if (!str) {
    return null;
  }
  const [suit, rank] = str.split('_');
  return { suit, rank, value: getCardValue(rank) };
}

/**
 * 获取牌的数值
 */
function getCardValue(rank) {
  if (rank === 'big') return 16;  // 大王
  if (rank === 'small') return 15; // 小王
  if (rank === '5' && this?.suit === 'heart') return 17; // 红桃5 - 在主牌判断中处理
  return RANKS[rank] || 0;
}

/**
 * 判断是否为固定主牌
 * 固定主：红桃5、大王、小王、等级牌
 */
function isFixedTrump(card, currentLevel = 2) {
  // 红桃5是固定主
  if (card.suit === 'heart' && card.rank === '5') return true;
  // 大王小王
  if (card.suit === 'joker') return true;
  // 等级牌
  if (LEVEL_RANKS.includes(card.rank)) return true;

  return false;
}

/**
 * 判断是否为主牌
 * 主牌包括：固定主 + 非固定主（主花色普通牌）
 */
function isTrump(card, trumpSuit, isNoTrump, currentLevel) {
  // 固定主
  if (isFixedTrump(card, currentLevel)) return true;

  // 无主模式：无主花色，非固定主都不是主牌
  if (isNoTrump) return false;

  // 非固定主：主花色的普通牌
  if (trumpSuit && card.suit === trumpSuit && !LEVEL_RANKS.includes(card.rank)) {
    return true;
  }

  return false;
}

/**
 * 获取牌的主牌权重（用于比较大小）
 */
function getTrumpWeight(card, trumpSuit, isNoTrump, currentLevel) {
  // 红桃5 - 最高
  if (card.suit === 'heart' && card.rank === '5') return 100;

  // 大王
  if (card.suit === 'joker' && card.rank === 'big') return 99;

  // 小王
  if (card.suit === 'joker' && card.rank === 'small') return 98;

  // 等级牌
  if (LEVEL_RANKS.includes(card.rank)) {
    const levelValue = RANKS[card.rank];
    // 主花色等级牌 > 其他花色等级牌
    if (trumpSuit && card.suit === trumpSuit) {
      return 50 + levelValue;
    }
    // 无主时所有等级牌等价
    if (isNoTrump) {
      return 30 + levelValue;
    }
    // 非主花色等级牌
    return 20 + levelValue;
  }

  // 主花色普通牌
  if (!isNoTrump && trumpSuit && card.suit === trumpSuit) {
    return 10 + card.value;
  }

  // 副牌
  return card.value;
}

/**
 * 判断是否为等级牌
 */
function isLevelCard(rank) {
  return LEVEL_RANKS.includes(rank);
}

/**
 * 获取等级牌的等级值
 */
function getLevelValue(rank) {
  return RANKS[rank] || 0;
}

/**
 * 判断两牌是否同花色
 */
function isSameSuit(cardA, cardB) {
  return cardA.suit === cardB.suit;
}

/**
 * 判断两牌是否相同（花色和点数都相同）
 */
function isSameCard(cardA, cardB) {
  return cardA.suit === cardB.suit && cardA.rank === cardB.rank;
}

/**
 * 牌排序（用于手牌排序）
 */
function sortCards(cards, trumpSuit, isNoTrump, currentLevel) {
  return [...cards].sort((a, b) => {
    // 主牌排在副牌前面
    const aTrump = isTrump(a, trumpSuit, isNoTrump, currentLevel);
    const bTrump = isTrump(b, trumpSuit, isNoTrump, currentLevel);

    if (aTrump && !bTrump) return -1;
    if (!aTrump && bTrump) return 1;

    // 同为主牌/副牌，按权重排序
    const aWeight = getTrumpWeight(a, trumpSuit, isNoTrump, currentLevel);
    const bWeight = getTrumpWeight(b, trumpSuit, isNoTrump, currentLevel);

    return bWeight - aWeight; // 从大到小
  });
}

/**
 * 获取分数牌的分值
 * 5=5分, 10=10分, K=10分
 */
function getScoreValue(card) {
  if (card.rank === '5') return 5;
  if (card.rank === '10') return 10;
  if (card.rank === 'K') return 10;
  return 0;
}

module.exports = {
  SUITS,
  RANKS,
  LEVEL_RANKS,
  generateDeck,
  shuffleDeck,
  cardToString,
  stringToCard,
  getCardValue,
  isFixedTrump,
  isTrump,
  getTrumpWeight,
  isLevelCard,
  getLevelValue,
  isSameSuit,
  isSameCard,
  sortCards,
  getScoreValue
};
