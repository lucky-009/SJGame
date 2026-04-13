/**
 * 规则引擎
 * 处理出牌校验、牌型判断等核心规则
 *
 * 核心概念：
 * - 主牌：固定主（红桃5、大王、小王、等级牌）+ 主花色牌
 * - 副牌：非主花色的普通牌
 * - playType：出牌类型（normal/trumpKill/discard）
 */

const {
    isTrump, isSameSuit, getTrumpWeight,
    isFixedTrump, LEVEL_RANKS
} = require('./CardUtils');

// 出牌类型定义（gameRule.md 第571行：毙牌 > 正常出牌 > 贴牌）
const PLAY_TYPES = {
    NORMAL: 'normal',        // 正常跟牌：满足跟牌规则（花色、牌型、张数一致）
    TRUMP_KILL: 'trumpKill', // 毙牌：没有该花色副牌时，用主牌压制
    DISCARD: 'discard'      // 贴牌：没有足够的主牌/副牌，用其他牌补足
};

/**
 * 分析牌型结构
 *
 * 输入：一组牌（玩家打出的牌）
 * 输出：牌型分析结果，包含：
 *   - isValid: 是否有效
 *   - isDiscard: 多花色直接判定位贴牌，（首家判定为不合法）
 *   - isAllTrump: 是否全为主牌
 *   - isLeadTrump: 是否为钓主（首家出主牌）
 *   - leadSuit: 主导花色（首家出的花色）
 *   - leadPattern: string（主导牌型：single/pair/pairSequence/510K/mixed）
 *   - subPatterns: array（排序后的子牌型数组，如 [{type:'510K',weight:1000}, {type:'pair',weight:40}]）
 *
 * 牌型结构：
 *   - single: 单张（1张）
 *   - pair: 对子（2张同花色同点数）
 *   - pairSequence: 连对（多组连续的同花色对子）
 *   - 510K: 5+10+K 同花色（3张）
 *   - mixed: 混合牌型（如对子+单张）
 */
function analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel) {
    console.log('=== analyzePlayPattern ===');
    console.log('cards:', cards.map(c => c.suit + c.rank));
    console.log('trumpSuit:', trumpSuit, 'isNoTrump:', isNoTrump, 'level:', currentLevel);

    if (!cards || cards.length === 0) {
        return {isValid: false, reason: '空牌'};
    }

    // 按花色分组（同一花色的牌为一组）
    const suitGroups = {};
    for (const card of cards) {
        if (!suitGroups[card.suit]) {
            suitGroups[card.suit] = [];
        }
        suitGroups[card.suit].push(card);
    }

    // 快速检查：非全主 + 多花色 = 贴牌（直接返回）
    const isAllTrump = cards.every(card =>
        isTrump(card, trumpSuit, isNoTrump, currentLevel)
    );
    console.log('isAllTrump:', isAllTrump);

    if (!isAllTrump && Object.keys(suitGroups).length > 1) {
        console.log('非全主+多花色= 贴牌');
        return {
            isValid: true,
            isDiscard: true,
            isAllTrump: false,
            isLeadTrump: false,
            leadSuit: null,
            leadPattern: null,
            subPatterns: []
        };
    }

    // 分析同一花色下的牌型组合
    let leadPattern = null;
    const allSubPatterns = [];

    for (const [suit, suitCards] of Object.entries(suitGroups)) {
        const isMainSuit = suit === 'joker' ||
            (trumpSuit && suit === trumpSuit) ||
            (isNoTrump && isFixedTrump({suit, rank: suitCards[0].rank}, currentLevel));

        console.log(`  suit: ${suit}, isMainSuit: ${isMainSuit}, cards: ${suitCards.map(c => c.rank).join(',')}`);

        const suitResult = analyzeSuitPattern(suitCards, isMainSuit, currentLevel, trumpSuit, isNoTrump);
        console.log(`    leadPattern: ${suitResult.leadPattern}, subPatterns: [${suitResult.subPatterns.map(sp => sp.type).join(',')}]`);

        // 首个花色决定leadPattern
        if (!leadPattern) {
            leadPattern = suitResult.leadPattern;
        }
        // 合并所有子牌型
        allSubPatterns.push(...suitResult.subPatterns);
    }

    // 如果是多花色（这里只会有一种情况：全主牌多花色），则混合
    const isLeadTrump = isAllTrump;
    console.log('leadSuit:', Object.keys(suitGroups)[0], 'isLeadTrump:', isLeadTrump, 'leadPattern:', leadPattern);

    return {
        isValid: true,
        isAllTrump,
        isLeadTrump,
        leadSuit: Object.keys(suitGroups)[0],
        leadPattern,
        subPatterns: allSubPatterns
    };
}

/**
 * 分析同花色牌的牌型
 *
 * 匹配优先级：510K → 连对 → 对子 → 单张
 *
 * 返回结构：
 *   - leadPattern: string（主导牌型：single/pair/pairSequence/510K/mixed）
 *   - subPatterns: array（所有子牌型类型数组，如 ['pair', 'single']）
 */
function analyzeSuitPattern(cards, isMainSuit, currentLevel, trumpSuit, isNoTrump) {
    console.log('=== analyzeSuitPattern ===');
    console.log('cards:', cards.map(c => c.suit + c.rank), 'isMainSuit:', isMainSuit);

    if (!cards || cards.length === 0) {
        return {leadPattern: null, subPatterns: []};
    }

    const subPatterns = [];
    const usedIndices = new Set();

    // 获取牌的value
    const getRankValue = (rank) => {
        if (rank === 'big') return 20;  // 大王
        if (rank === 'small') return 19;  // 小王
        return parseInt(rank);
    };

    // 按点数分组
    const rankGroups = {};
    cards.forEach((card, idx) => {
        if (!rankGroups[card.rank]) rankGroups[card.rank] = [];
        rankGroups[card.rank].push({card, idx, value: getRankValue(card.rank)});
    });

    // ========== 优先级1：匹配510K ==========
    if (rankGroups['5']?.length && rankGroups['10']?.length && rankGroups['K']?.length) {
        const five = rankGroups['5'].pop();
        const ten = rankGroups['10'].pop();
        const king = rankGroups['K'].pop();
        subPatterns.push({type: '510K', weight: 1000});
        usedIndices.add(five.idx);
        usedIndices.add(ten.idx);
        usedIndices.add(king.idx);
    }

// ========== 优先级2：匹配连对 ==========
    // 收集所有对子（保存value和idx）
    const allPairs = [];
    for (const group of Object.values(rankGroups)) {
        const pairCount = Math.floor(group.length / 2);
        for (let i = 0; i < pairCount; i++) {
            const p1 = group.pop();
            const p2 = group.pop();
            allPairs.push({v: p1.value, i1: p1.idx, i2: p2.idx});
        }
    }
    allPairs.sort((a, b) => a.v - b.v);

    // 找最长连续序列
    if (allPairs.length >= 2) {
        let maxStart = 0, maxLen = 0;
        let curStart = 0;

        for (let i = 1; i <= allPairs.length; i++) {
            if (i === allPairs.length || allPairs[i].v !== allPairs[i - 1].v + 1) {
                const len = i - curStart;
                if (len > maxLen) {
                    maxLen = len;
                    maxStart = curStart;
                }
                curStart = i;
            }
        }

        // 提取最长连续对子作为连对（需要>=2对）
        if (maxLen >= 2) {
            const pairSequenceCards = [];
            for (let i = maxStart; i < maxStart + maxLen; i++) {
                const p = allPairs[i];
                pairSequenceCards.push(cards[p.i1], cards[p.i2]);
                usedIndices.add(p.i1);
                usedIndices.add(p.i2);
            }
            subPatterns.push({type: 'pairSequence', weight: getPatternWeight(pairSequenceCards, 'pairSequence')});
        } else {
            // 不是连对，全部作为普通对子处理
            for (const p of allPairs) {
                const pairCards = [cards[p.i1], cards[p.i2]];
                subPatterns.push({
                    type: 'pair',
                    weight: getPatternWeight(pairCards, 'pair', trumpSuit, isNoTrump, currentLevel)
                });
                usedIndices.add(p.i1);
                usedIndices.add(p.i2);
            }
        }
    } else if (allPairs.length === 1) {
        // 只有1对，直接作为普通对子
        const p = allPairs[0];
        const pairCards = [cards[p.i1], cards[p.i2]];
        subPatterns.push({
            type: 'pair',
            weight: getPatternWeight(pairCards, 'pair', trumpSuit, isNoTrump, currentLevel)
        });
        usedIndices.add(p.i1);
        usedIndices.add(p.i2);
    }

    // ========== 优先级3：剩余单张 ==========
    for (let i = 0; i < cards.length; i++) {
        if (!usedIndices.has(i)) {
            const singleCard = [cards[i]];
            subPatterns.push({
                type: 'single',
                weight: getPatternWeight(singleCard, 'single', trumpSuit, isNoTrump, currentLevel)
            });
            usedIndices.add(i);
        }
    }

    // ========== 决定leadPattern ==========
    const uniqueTypes = [...new Set(subPatterns.map(sp => sp.type))];
    const hasPairSequence = uniqueTypes.includes('pairSequence');
    let leadPattern;

    console.log('DEBUG uniqueTypes:', uniqueTypes, 'size:', uniqueTypes.length, 'hasPairSequence:', hasPairSequence);

    if (hasPairSequence) {
        leadPattern = 'pairSequence';
    } else if (uniqueTypes.length === 1) {
        leadPattern = subPatterns[0].type;
    } else {
        leadPattern = 'mixed';
    }

    // 排序：先按类型优先级，再按权重降序
    const typePriority = {'510K': 4, 'pairSequence': 3, 'pair': 2, 'single': 1};
    subPatterns.sort((a, b) => {
        if (typePriority[a.type] !== typePriority[b.type]) {
            return typePriority[b.type] - typePriority[a.type];
        }
        return b.weight - a.weight;
    });

    console.log('  -> leadPattern:', leadPattern, 'subPatterns:', subPatterns);
    return {leadPattern, subPatterns};
}

/**
 * 校验出牌是否合法
 */
function validatePlay(cards, handCards, firstPlay, trumpSuit, isNoTrump, currentLevel) {
    // 基础检查
    if (!cards || cards.length === 0) {
        return {isValid: false, reason: '请选择要出的牌'};
    }

    // 检查手牌是否包含这些牌
    const handStrs = handCards.map(c => `${c.suit}_${c.rank}`);
    for (const card of cards) {
        const cardStr = `${card.suit}_${card.rank}`;
        const idx = handStrs.indexOf(cardStr);
        if (idx === -1) {
            return {isValid: false, reason: `手牌中不存在 ${cardStr}`};
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
        return {isValid: false, reason: patternInfo.reason};
    }

    // 规则1：必须为同一花色体系（副牌 或 主牌）
    if (!patternInfo.isAllTrump && patternInfo.leadSuit && cards.some(c => c.suit !== patternInfo.leadSuit)) {
        return {isValid: false, reason: '首家出牌必须为同一花色'};
    }

    // 规则2：不允许主副混合（已通过 isDiscard 检查）

    return {isValid: true, patternInfo};
}

/**
 * 校验跟牌
 */
function validateFollowPlay(cards, trumpSuit, isNoTrump, currentLevel) {
    // 简化处理：牌型合法即可
    // 实际应该传入首家牌型进行严格校验
    return {isValid: true};
}

/**
 * 判断出牌类型（毙牌/正常/贴牌）
 *
 * 判定规则：
 * 1. 首家出主牌时：
 *    - 有主牌：正常跟牌
 *    - 无主牌：贴牌
 * 2. 首家出副牌时：
 *    - 有该花色副牌：正常跟牌
 *    - 无该花色副牌但全主牌+结构匹配：毙牌
 *    - 其他情况：贴牌
 *
 * @param {Array} cards 玩家打出的牌
 * @param {String} leadSuit 主导花色（首家出的花色）
 * @param {Object} leadPatternInfo 主导牌型信息（从 analyzePlayPattern 获得）
 * @param {String} trumpSuit 主花色
 * @param {Boolean} isNoTrump 是否无主
 * @param {Number} currentLevel 当前等级
 * @returns {String} playType: 'normal' | 'trumpKill' | 'discard'
 */
function classifyPlayType(cards, leadSuit, leadPatternInfo, trumpSuit, isNoTrump, currentLevel) {
    console.log('=== classifyPlayType ===');
    console.log('cards:', cards.map(c => c.suit + c.rank));
    console.log('leadSuit:', leadSuit, 'leadPattern:', leadPatternInfo?.leadPattern, 'leadSubPatterns:', leadPatternInfo?.subPatterns.map(sp => sp.type));

    const playerPattern = analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel);
    if (playerPattern.isDiscard) {
        console.log('出了多个花色，计算为贴牌');
        return PLAY_TYPES.DISCARD;
    }

    const leadPattern = leadPatternInfo?.leadPattern;
    const leadSubPatterns = leadPatternInfo?.subPatterns || [];
    const isLeadTrump = leadPatternInfo?.isLeadTrump;

    // 场景1：首家出的是主牌（钓主）
    if (isLeadTrump) {
        console.log('钓主');
        const hasTrump = cards.some(c => isTrump(c, trumpSuit, isNoTrump, currentLevel));
        if (!hasTrump) {
            console.log('结果: discard (无主牌)');
            return PLAY_TYPES.DISCARD;
        }

        const isAllTrump = playerPattern.isAllTrump;
        console.log('isAllTrump:', isAllTrump);
        if (!isAllTrump) {
            console.log('结果: discard (不全为主牌)');
            return PLAY_TYPES.DISCARD;
        }

        // 检查牌型结构是否匹配
        const playerPatternType = playerPattern.leadPattern;
        const playerSubPatterns = playerPattern.subPatterns || [];

        console.log('leadPattern:', leadPattern, 'playerPattern:', playerPatternType);

        // leadPattern相同，mixed或pairSequence时需要比对subPatterns
        if (leadPattern === playerPatternType) {
            if (leadPattern === 'mixed' || leadPattern === 'pairSequence') {
                const subMatch = compareSubPatterns(leadSubPatterns, playerSubPatterns);
                console.log('subPatterns match:', subMatch);
                if (subMatch) {
                    console.log('结果: normal (subPatterns匹配)');
                    return PLAY_TYPES.NORMAL;
                }
            } else {
                console.log('结果: normal (牌型匹配)');
                return PLAY_TYPES.NORMAL;
            }
        }
        console.log('结果: DISCARD (牌型不匹配)');
        return PLAY_TYPES.DISCARD;
    }

    // 场景2：首家出的是副牌
    console.log('场景2 - 首家出副牌');
    const hasLeadSuit = cards.some(c => c.suit === leadSuit && !isTrump(c, trumpSuit, isNoTrump, currentLevel));
    console.log('hasLeadSuit:', hasLeadSuit);

    if (!hasLeadSuit) {
        // 没有该花色副牌，检查是否满足毙牌条件
        if (playerPattern.isAllTrump) {
            const playerPatternType = playerPattern.leadPattern;
            const playerSubPatterns = playerPattern.subPatterns || [];

            console.log('leadPattern:', leadPattern, 'playerPattern:', playerPatternType);

            // 牌型结构完全匹配 → 毙牌
            if (leadPattern === playerPatternType) {
                if (leadPattern === 'mixed' || leadPattern === 'pairSequence') {
                    const subMatch = compareSubPatterns(leadSubPatterns, playerSubPatterns);
                    console.log('subPatterns match:', subMatch);
                    if (subMatch) {
                        console.log('结果: trumpKill');
                        return PLAY_TYPES.TRUMP_KILL;
                    }
                } else {
                    console.log('结果: trumpKill');
                    return PLAY_TYPES.TRUMP_KILL;
                }
            }
        }
        console.log('结果: discard (不满足毙牌条件)');
        return PLAY_TYPES.DISCARD;
    }

    // 有该花色副牌 → 正常跟牌
    console.log('结果: normal (有该花色副牌)');
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
    console.log('=== comparePlays ===');
    console.log('cards1:', cards1.map(c => c.suit + c.rank));
    console.log('cards2:', cards2.map(c => c.suit + c.rank));

    const pattern1 = analyzePlayPattern(cards1, trumpSuit, isNoTrump, currentLevel);
    const pattern2 = analyzePlayPattern(cards2, trumpSuit, isNoTrump, currentLevel);

    if (!pattern1.isValid || !pattern2.isValid) {
        console.log('isValid false, return 0');
        return 0;
    }

    // 快速检查：贴牌直接判小
    if (pattern1.isDiscard && !pattern2.isDiscard) {
        console.log('cards1 isDiscard, cards2 wins');
        return -1;
    }
    if (!pattern1.isDiscard && pattern2.isDiscard) {
        console.log('cards2 isDiscard, cards1 wins');
        return 1;
    }
    // 都是贴牌：首家赢
    if (pattern1.isDiscard && pattern2.isDiscard) {
        console.log('both isDiscard, first wins');
        return 1;
    }

    // 牌型结构不一致时，先出的赢
    console.log('pattern1:', pattern1.leadPattern, 'pattern2:', pattern2.leadPattern);
    if (pattern1.leadPattern !== pattern2.leadPattern) {
        console.log('牌型不同，首家获胜, result: 1');
        return 1;
    }

    // 直接比较最大的子牌型（subPatterns已按优先级排序）
    const typePriority = {'510K': 4, 'pairSequence': 3, 'pair': 2, 'single': 1};
    const sp1 = pattern1.subPatterns[0];
    const sp2 = pattern2.subPatterns[0];

    console.log('sp1:', sp1, 'sp2:', sp2);

    if (!sp1 || !sp2) {
        return 0;
    }

    // 先比类型
    if (typePriority[sp1.type] !== typePriority[sp2.type]) {
        const result = typePriority[sp1.type] > typePriority[sp2.type] ? 1 : -1;
        console.log('类型不同, result:', result);
        return result;
    }

    // 类型相同比权重
    if (sp1.weight > sp2.weight) {
        console.log('cards1大, result: 1');
        return 1;
    }
    if (sp1.weight < sp2.weight) {
        console.log('cards2大, result: -1');
        return -1;
    }

    console.log('相等, result: 0');
    return 0;
}

/**
 * 牌型类型优先级（用于 getMaxSubPattern 排序）
 * 优先级：510K > 连对 > 对子 > 单张
 */
const PATTERN_TYPE_PRIORITY = {
    '510K': 4,
    'pairSequence': 3,  // 特殊处理：需要根据 pattern 判断
    'pair': 2,
    'single': 1
};

/**
 * 获取牌型权重
 * 510K: 1000
 * pairSequence: pairCount×30 + maxRank
 * pair: rank×5
 * single: rank
 */
function getPatternWeight(cards, type, trumpSuit, isNoTrump, currentLevel) {
    if (!cards || !cards.length) return 0;

    const getRankValue = (rank) => {
        if (rank === 'big') return 20;
        if (rank === 'small') return 19;
        return parseInt(rank);
    };

    // 510K：固定1000
    if (type === '510K') {
        return 1000;
    }

    // 连对：pairCount×30 + maxRank
    if (type === 'pairSequence') {
        const pairCount = Math.floor(cards.length / 2);
        let maxRank = 0;
        for (const card of cards) {
            const v = getRankValue(card.rank);
            if (v > maxRank) maxRank = v;
        }
        return pairCount * 30 + maxRank;
    }

    // 对子：rank×5
    if (type === 'pair') {
        return getTrumpWeight(cards[0], trumpSuit, isNoTrump, currentLevel) * 2;
    }

    // 单张：rank
    if (type === 'single') {
        return getTrumpWeight(cards[0], trumpSuit, isNoTrump, currentLevel);
    }

    return 0;
}

/**
 * 计算抠底倍数
 */
function getBottomMultiplier(cards, trumpSuit, isNoTrump, currentLevel) {
    const pattern = analyzePlayPattern(cards, trumpSuit, isNoTrump, currentLevel);
    const mainPattern = pattern.leadPattern;

    if (mainPattern === 'single') return 2;
    if (mainPattern === 'pair') return 4;
    if (mainPattern === 'pairSequence') {
        return cards.length * 2;
    }
    if (mainPattern === '510K') return 8;

    return 2; // 默认
}

/**
 * 比较两个子牌型数组是否完全匹配（只比较类型，不比较权重）
 * @param {Array} patterns1 第一个子牌型数组，如 [{type:'pair',weight:xx}, {type:'single',weight:xx}]
 * @param {Array} patterns2 第二个子牌型数组
 * @returns {Boolean} 是否完全匹配
 */
function compareSubPatterns(patterns1, patterns2) {
    if (!patterns1 || !patterns2) return false;
    if (patterns1.length !== patterns2.length) return false;

    const typePriority = {'510K': 4, 'pairSequence': 3, 'pair': 2, 'single': 1};

    // 只按类型优先级排序后比较
    const sorted1 = [...patterns1].sort((a, b) => typePriority[b.type] - typePriority[a.type]);
    const sorted2 = [...patterns2].sort((a, b) => typePriority[b.type] - typePriority[a.type]);

    return sorted1.every((p, i) => p.type === sorted2[i].type);
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
    getBottomMultiplier,
    compareSubPatterns
};
