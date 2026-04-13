/**
 * 扑克牌工具类
 * 处理牌堆生成、洗牌、牌面解析等
 */

// 花色定义
/**
 * 扑克牌工具函数
 * 
 * 数据类型规范：
 * - currentLevel: 数字类型 2-14，表示游戏等级
 * - card.rank: 字符串类型 '2'-'10','J','Q','K','A','big','small'
 * - 两者比较时需要使用 getLevelRank() 转换，不能直接使用 String()
 */

const SUITS = {
    SPADE: 'spade',   // 黑桃
    HEART: 'heart',   // 红桃
    CLUB: 'club',     // 梅花
    DIAMOND: 'diamond', // 方块
    JOKER: 'joker'    // 大小王
};

const RANKS = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const LEVEL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 等级数字到牌面字符的映射
 * currentLevel: 2-14 (数字)
 * 返回: '2'-'10','J','Q','K','A' (字符串)
 */
const LEVEL_MAP = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
    8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

/**
 * 将等级数字转换为牌面字符
 * @param {number} currentLevel - 等级数字 2-14
 * @returns {string} 牌面字符 '2'-'10','J','Q','K','A'
 */
function getLevelRank(currentLevel) {
    return LEVEL_MAP[currentLevel] || '2';
}

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
                deck.push({suit, rank, value: RANKS[rank]});
            }
        }
    }

    // 大王小王各两张
    for (let i = 0; i < 2; i++) {
        deck.push({suit: SUITS.JOKER, rank: 'big', value: 16});   // 大王
        deck.push({suit: SUITS.JOKER, rank: 'small', value: 15}); // 小王
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
    return {suit, rank, value: getCardValue(rank)};
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
 * 固定主：红桃5、大王、小王、当前等级牌
 * @param {Object} card - 牌对象 {suit, rank}
 * @param {number} currentLevel - 等级数字 2-14
 */
function isFixedTrump(card, currentLevel = 2) {
    // 红桃5是固定主
    if (card.suit === 'heart' && card.rank === '5') return true;
    // 大王小王
    if (card.suit === 'joker') return true;
    // 等级固定主：根据 currentLevel 判断对应的等级牌
    // 注意：card.rank 是字符串 'J','Q','K','A'，需要用 getLevelRank 转换
    if (card.rank === getLevelRank(currentLevel)) return true;

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

    // 主花色的牌都是主牌（包括非当前等级的等级牌）
    if (trumpSuit && card.suit === trumpSuit) {
        return true;
    }

    return false;
}

/**
 * 获取牌的主牌权重（用于比较大小）
 * @param {Object} card - 牌对象 {suit, rank}
 * @param {string} trumpSuit - 主花色
 * @param {boolean} isNoTrump - 是否无主
 * @param {number} currentLevel - 等级数字 2-14
 */
function getTrumpWeight(card, trumpSuit, isNoTrump, currentLevel) {
    console.log('card ==', card)
    // 红桃5 - 最高
    if (card.suit === 'heart' && card.rank === '5') return 100;

    // 大王
    if (card.suit === 'joker' && card.rank === 'big') return 60;

    // 小王
    if (card.suit === 'joker' && card.rank === 'small') return 50;

    // 等级牌
    // 注意：card.rank 是字符串 'J','Q','K','A'，需要用 getLevelRank 转换
    if (card.rank === getLevelRank(currentLevel)) {
        const levelValue = RANKS[card.rank];
        // 无主时所有等级牌等价
        if (isNoTrump) {
            return 30 + levelValue;
        }
        // 主花色等级牌 > 其他花色等级牌
        if (trumpSuit && card.suit === trumpSuit) {
            return 35 + levelValue;
        }
        // 非主花色等级牌
        return 30 + levelValue;
    }

    // 主花色普通牌 17 -29
    if (!isNoTrump && trumpSuit && card.suit === trumpSuit) {
        return 15 + RANKS[card.rank];
    }

    // 副牌 2-14
    return RANKS[card.rank];
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
    LEVEL_MAP,
    generateDeck,
    shuffleDeck,
    cardToString,
    stringToCard,
    getCardValue,
    getLevelRank,
    isFixedTrump,
    isTrump,
    getTrumpWeight,
    isSameSuit,
    isSameCard,
    sortCards,
    getScoreValue
};
