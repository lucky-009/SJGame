/**
 * 游戏房间管理器
 * 管理内存中的游戏房间状态，包含智能重新发牌功能
 *
 * 主要特性：
 * - 自动检测玩家手牌总分
 * - 手牌总分不足时自动重新发牌
 * - 防重复重发机制（最多3次）
 * - 实时状态同步到所有客户端
 */

const {
    generateDeck, shuffleDeck, cardToString, stringToCard,
    isTrump, isSameSuit, getTrumpWeight, getScoreValue, getLevelRank
} = require('../../../common/CardUtils');

const {
    validatePlay,
    classifyPlayType,
    comparePlays,
    getBottomMultiplier,
    analyzePlayPattern
} = require('../../../common/RuleEngine');

const Room = require('../../../models/Room');
const RoomPlayer = require('../../../models/RoomPlayer');
const GameRound = require('../../../models/GameRound');
const PlayerCard = require('../../../models/PlayerCard');
const PlayRecord = require('../../../models/PlayRecord');
const RoundScore = require('../../../models/RoundScore');

// 游戏阶段
const GAME_PHASES = {
    DEALING: 'dealing',       // 发牌阶段
    DEALEND: 'dealEnd',      // 发牌完成
    BOTTOMING: 'bottoming',   // 底牌阶段
    PLAYING: 'playing',       // 出牌阶段
    SETTLING: 'settling',     // 结算阶段
    FINISHED: 'finished'      // 结束
};

// 等级映射
const LEVEL_MAP = {
    2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
    8: 8, 9: 9, 10: 10, 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

class GameRoom {
    constructor(roomId, roomCode, io) {
        this.roomId = roomId;
        this.roomCode = roomCode;
        this.io = io;
        this.players = new Map();  // userId -> playerInfo
        this.gameRound = null;     // 当前游戏局
        this.deck = [];            // 牌堆
        this.currentLevel = 2;     // 当前等级 注意：currentLevel 是数字 2-14，需要用 getLevelRank 转换
        this.phase = GAME_PHASES.DEALING;
        this.turnIndex = 0;        // 当前回合
        this.turnSeat = 0;         // 当前操作玩家座位
        this.turnCards = new Map();  // 当前回合各玩家出的牌（使用Map保持插入顺序，格式：seat -> { cards: [], playType: 'normal'|'trumpKill'|'discard' }）
        this.teamAScore = 0;       // A队得分
        this.teamBScore = 0;       // B队得分
        this.isFirstRound = true; // 是否第一局

        // 发牌状态
        this.dealingState = {
            isDealing: false,
            cardIndex: 0,
            currentPlayer: 0,
            dealInterval: null,
            responded: {
                bankerCall: false,
                bankerLock: false,
                bankerReverse: false,
                trumpCall: false,
                trumpLock: false,
                trumpReverse: false
            },
            bidState: {
                hasBanker: false,     //是否有庄
                bankerSeat: -1,
                bankerSuit: null,     // 抢庄时使用的花色
                hasTrump: false,      //是否确定了主色
                trumpSuit: null,
                trumpCallerSuit: null, // 抢主时使用的花色
                isLocked: false
            }
        };
        this.bidTimeout = null;  // 投标超时定时器

        // 抄底阶段状态
        this.drawBottomState = {
            isActive: false,
            currentAskerSeat: -1,
            askedPlayers: [],
            skippedTrumpCaller: false,
            hasDrawer: false,
            drawTimeout: null,
            isWaitingBury: false,
            pendingDrawer: null
        };

        // 出牌阶段状态
        this.leadPlayCardCount = 0;  // 首家的出牌数量
    }

    /**
     * 添加玩家
     */
    addPlayer(userId, username, socketId, seatIndex, team, isOwner) {
        this.players.set(userId, {
            userId,
            username,
            socketId,
            seatIndex,
            team,
            isOwner,
            isReady: false,
            handCards: []
        });
    }

    /**
     * 移除玩家
     */
    removePlayer(userId) {
        this.players.delete(userId);
    }

    /**
     * 更新玩家准备状态
     */
    setPlayerReady(userId, isReady) {
        const player = this.players.get(userId);
        if (player) {
            player.isReady = isReady;
        }
    }

    /**
     * 更新玩家 Socket ID
     */
    updateSocketId(userId, socketId) {
        const player = this.players.get(userId);
        if (player) {
            player.socketId = socketId;
        }
    }

    /**
     * 检查是否所有玩家都已准备
     */
    areAllPlayersReady() {
        if (this.players.size < 4) return false;
        return Array.from(this.players.values()).every(p => p.isReady);
    }

    /**
     * 开始游戏 - 单张发牌模式
     */
    async startGame(levelA = 2, levelB = 2) {
        this.currentLevel = 2;
        this.teamAScore = 0;
        this.teamBScore = 0;
        this.isFirstRound = true;

        // 初始化发牌状态
        this.dealingState = {
            isDealing: true,
            cardIndex: 0,
            currentPlayer: 0,
            dealInterval: null,
            responded: {
                bankerCall: false,
                bankerLock: false,
                bankerReverse: false,
                trumpCall: false,
                trumpLock: false,
                trumpReverse: false
            },
            bidState: {
                hasBanker: false,
                bankerSeat: -1,
                bankerSuit: null,
                hasTrump: false,
                trumpSuit: null,
                trumpCallerSuit: null,
                isLocked: false
            }
        };

        // 生成并洗牌
        this.deck = shuffleDeck(generateDeck());

        // 底牌
        const bottomCards = this.deck.slice(100);
        console.log('--底牌是：', bottomCards)

        // 创建游戏局记录
        const round = new GameRound({
            roomId: this.roomId,
            roundIndex: 1,
            level: 2,
            phase: GAME_PHASES.DEALING,
            status: 'active',
            bottomCards: bottomCards.map(c => cardToString(c))
        });

        await round.save();
        this.gameRound = round;

        // 初始化玩家手牌 - 按座位号顺序排序
        const sortedPlayers = Array.from(this.players.values()).sort((a, b) => a.seatIndex - b.seatIndex);
        for (let i = 0; i < 4; i++) {
            const player = sortedPlayers.find(p => p.seatIndex === i);
            if (player) {
                player.handCards = [];
            }
        }

        this.phase = GAME_PHASES.DEALING;
        this.turnIndex = 1;

        // 广播开始发牌
        this.io.to(this.roomCode).emit('game:deal_start', {
            totalCards: 100,
            isFirstRound: this.isFirstRound,
            level: this.currentLevel
        });

        // 开始单张发牌，每125ms发一张（1秒8张）
        this.dealingState.dealInterval = setInterval(() => {
            this.dealOneCard();
        }, 125);
    }

    /**
     * 单张发牌
     */
    dealOneCard() {
        if (this.dealingState.cardIndex >= 100) {
            // 发牌完成
            clearInterval(this.dealingState.dealInterval);
            this.dealingState.isDealing = false;
            this.onDealingComplete();
            return;
        }

        const card = this.deck[this.dealingState.cardIndex];
        const playerIndex = this.dealingState.currentPlayer;
        const player = Array.from(this.players.values()).find(p => p.seatIndex === playerIndex);

        if (player) {
            player.handCards.push(card);

            // 广播单张发牌
            this.io.to(this.roomCode).emit('game:card_dealt', {
                seatIndex: playerIndex,
                cardCount: player.handCards.length,
                cardIndex: this.dealingState.cardIndex + 1,
                totalCards: 100
            });

            // 给该玩家发送手牌更新
            if (player.socketId) {
                this.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => cardToString(c)),
                    seatIndex: playerIndex
                });
            }

            // 检测触发事件
            this.checkDealingEvents(player, card);
        }

        // 移动到下一个玩家和下一张牌
        this.dealingState.cardIndex++;
        this.dealingState.currentPlayer = (this.dealingState.currentPlayer + 1) % 4;
    }

    /**
     * 发牌完成后的处理
     */
    async onDealingComplete() {
        // 检查玩家手牌总分
        const {needsRedeal, lowScorePlayers} = this.checkPlayerHandScores();

        if (needsRedeal) {
            // 需要重新发牌
            console.log(`检测到玩家手牌总分不足，需要重新发牌:`, lowScorePlayers);
            await this.handleRedeal(lowScorePlayers);
            return;
        }

        // 保存手牌到数据库
        for (let i = 0; i < 4; i++) {
            const player = Array.from(this.players.values()).find(p => p.seatIndex === i);
            if (player) {
                await PlayerCard.create({
                    roundId: this.gameRound._id,
                    userId: player.userId,
                    seatIndex: i,
                    cards: player.handCards.map(c => cardToString(c))
                });
            }
        }

        this.phase = GAME_PHASES.DEALEND;

        // 广播发牌完成
        this.io.to(this.roomCode).emit('game:deal_complete', {
            players: Array.from(this.players.values()).map(p => ({
                seatIndex: p.seatIndex,
                cardCount: p.handCards.length,
                name: p.username,
                userId: p.userId
            })),
            isFirstRound: this.isFirstRound
        });

        // 给每个玩家发送完整手牌
        for (const player of this.players.values()) {
            if (player.socketId) {
                this.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => cardToString(c)),
                    seatIndex: player.seatIndex
                });
            }
        }

        // 广播当前投标状态
        this.broadcastBidState();

        // 如果已经锁庄或者锁主，直接补底，否则等待
        if (this.dealingState.bidState.isLocked) {
            this.performBottomSupplement();
        } else {
            // 通知前端进入等待操作阶段，并开始10s倒计时
            this.notifyWaitForOperation();
            this.startBidTimeout(10000);
        }

    }

    /**
     * 通知前端进入等待操作阶段（反庄、反主、锁主）
     */
    notifyWaitForOperation() {
        const {bidState} = this.dealingState;
        let waitType = [];

        if (this.isFirstRound) {
            if (!bidState.hasBanker) {
                waitType.push('call_banker');
            } else if (!bidState.isLocked) {
                waitType.push('reverse_banker');
                waitType.push('lock_banker');
            }
        } else {
            if (!bidState.hasTrump) {
                waitType.push('call_trump');
            } else if (!bidState.isLocked) {
                waitType.push('reverse_trump');
                waitType.push('lock_trump');
            }
        }

        this.io.to(this.roomCode).emit('game:wait_for_operation', {
            phase: this.phase,
            waitType,
            timeout: 10,
            bidState: {
                hasBanker: bidState.hasBanker,
                bankerSeat: bidState.bankerSeat,
                bankerSuit: bidState.bankerSuit,
                hasTrump: bidState.hasTrump,
                trumpSuit: bidState.trumpSuit,
                trumpCallerSuit: bidState.trumpCallerSuit,
                isLocked: bidState.isLocked
            }
        });
    }

    /**
     * 启动投标超时定时器 - 发牌完成后等待10秒
     */
    startBidTimeout(t = 10000) {
        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
        }
        this.bidTimeout = setTimeout(() => {
            this.checkBidTimeout();
        }, t);
    }

    /**
     * 检查投标是否超时
     */
    checkBidTimeout() {
        if (this.phase !== GAME_PHASES.DEALEND && this.phase !== GAME_PHASES.DEALING) {
            return;
        }
        const {bidState} = this.dealingState;

        // 通知前端倒计时结束，清除操作按钮
        this.io.to(this.roomCode).emit('game:bid_timeout', {
            bidState: {
                hasBanker: bidState.hasBanker,
                bankerSeat: bidState.bankerSeat,
                hasTrump: bidState.hasTrump,
                isLocked: bidState.isLocked
            }
        });

        // 等待了10秒，如果有庄家（可能没人锁或反），则进行补底
        if (bidState.hasBanker) {
            // 进行补底（将底牌发给庄家）
            this.performBottomSupplement();

            // 补底完成后进入埋底阶段
            this.phase = GAME_PHASES.BOTTOMING;
            this.notifyTakeBottom();
        }
    }

    /**
     * 执行专家补底操作
     */
    performBottomSupplement() {
        const banker = Array.from(this.players.values()).find(p => p.seatIndex === this.dealingState.bidState.bankerSeat);
        console.log('当前庄家信息:', banker);
        if (!banker) return;

        // 将底牌发给庄家
        const bottomCards = this.gameRound.bottomCards.map(c => stringToCard(c));
        banker.handCards.push(...bottomCards);

        // 广播补底
        this.io.to(this.roomCode).emit('game:bottom_supplemented', {
            seatIndex: banker.seatIndex,
            bottomCards: this.gameRound.bottomCards,
            totalCards: banker.handCards.length
        });

        // 保存补底状态
        this.gameRound.bottomSupplemented = true;
        this.gameRound.bottomCards = [];
        this.gameRound.save();
    }

    /**
     * 检测发牌过程中的事件
     */
    checkDealingEvents(player, card) {
        const {bidState, responded} = this.dealingState;
        // 注意：currentLevel 是数字 2-14，card.rank 是字符串 '2'-'10','J','Q','K','A'
        // 必须使用 getLevelRank() 转换，不能用 String()
        const levelRank = getLevelRank(this.currentLevel);

        // 第一局：抢庄阶段
        if (this.isFirstRound && !bidState.hasBanker) {
            // 抢庄：任意玩家获得任意花色2
            if (card.rank === '2' && !responded.bankerCall) {
                // 检查是否已经有同花色的2
                const sameSuit2s = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                if (sameSuit2s.length >= 2) {
                    // 如果有一对同花色的2，并且没有玩家抢庄，直接提供锁庄选项
                    const availableCards = sameSuit2s.map(c => cardToString(c));
                    this.io.to(player.socketId).emit('game:can_lock_banker', {
                        seatIndex: player.seatIndex,
                        availableCards
                    });
                } else {
                    // 找出该玩家手牌中所有的2
                    const availableCards = player.handCards
                        .filter(c => c.rank === '2')
                        .map(c => cardToString(c));
                    this.io.to(player.socketId).emit('game:can_call_banker', {
                        seatIndex: player.seatIndex,
                        level: this.currentLevel,
                        availableCards
                    });
                }
            }
        }

        // 第一局：锁庄条件
        if (this.isFirstRound && bidState.hasBanker && !bidState.isLocked) {
            const banker = Array.from(this.players.values()).find(p => p.seatIndex === bidState.bankerSeat);
            // 抢庄玩家再次获得与抢庄花色相同的2形成对子才能锁庄
            if (card.rank === '2' && player.seatIndex === bidState.bankerSeat && !responded.bankerLock) {
                const bankerSuit = bidState.bankerSuit;
                if (card.suit === bankerSuit) {
                    const sameSuit2s = player.handCards.filter(c => c.suit === bankerSuit && c.rank === '2');
                    if (sameSuit2s.length >= 2) {
                        const availableCards = sameSuit2s.map(c => cardToString(c));
                        this.io.to(player.socketId).emit('game:can_lock_banker', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    }
                }
            }
            // 其他玩家获得同花色2对子可以反庄
            if (card.rank === '2' && player.seatIndex !== bidState.bankerSeat && !responded.bankerReverse) {
                const sameSuitCards = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                if (sameSuitCards.length >= 2) {
                    const cardStr = cardToString(card);
                    this.io.to(player.socketId).emit('game:can_reverse_banker', {
                        seatIndex: player.seatIndex,
                        suit: card.suit,
                        card: cardStr
                    });
                }
            }
        }

        // 非第一局：抢主色阶段
        if (!this.isFirstRound && !bidState.hasTrump) {
            // 抢主色：玩家获得当前等级牌
            if (card.rank === levelRank && !responded.trumpCall) {
                // 检查是否已经有同花色的当前等级牌形成对子
                const sameSuitLevelCards = player.handCards.filter(c => c.suit === card.suit && c.rank === levelRank);
                if (sameSuitLevelCards.length >= 2) {
                    // 如果有一对同花色的当前等级牌，并且没有玩家抢主，直接提供锁主选项
                    const availableCards = sameSuitLevelCards.map(c => cardToString(c));
                    this.io.to(player.socketId).emit('game:can_lock_trump', {
                        seatIndex: player.seatIndex,
                        availableCards
                    });
                } else {
                    // 找出该玩家手牌中所有的当前等级牌
                    const availableCards = player.handCards
                        .filter(c => c.rank === levelRank)
                        .map(c => cardToString(c));
                    this.io.to(player.socketId).emit('game:can_call_trump', {
                        seatIndex: player.seatIndex,
                        level: this.currentLevel,
                        availableCards
                    });
                }
            }
        }

        // 非第一局：锁主色/反主色条件
        if (!this.isFirstRound && bidState.hasTrump && !bidState.isLocked) {
            // 抢主玩家再次获得与抢主花色相同的等级牌形成对子才能锁主
            if (card.rank === levelRank && player.seatIndex === bidState.bankerSeat && !responded.trumpLock) {
                const trumpCallerSuit = bidState.trumpCallerSuit;
                if (card.suit === trumpCallerSuit) {
                    const sameSuitLevelCards = player.handCards.filter(c => c.suit === trumpCallerSuit && c.rank === levelRank);
                    if (sameSuitLevelCards.length >= 2) {
                        const availableCards = sameSuitLevelCards.map(c => cardToString(c));
                        this.io.to(player.socketId).emit('game:can_lock_trump', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    }
                }
            }
            // 庄家玩家获得更高优先级主牌对子可以反主
            if (player.seatIndex === bidState.bankerSeat && !responded.trumpReverse) {
                const pairs = this.findTrumpPairs(player.handCards);
                if (pairs.length > 0) {
                    const highestPair = pairs[0];
                    if (this.isHigherTrump(highestPair.rank, bidState.trumpSuit)) {
                        this.io.to(player.socketId).emit('game:can_reverse_trump', {
                            seatIndex: player.seatIndex,
                            availablePairs: pairs.map(p => cardToString(p.cards[0]))
                        });
                    }
                }
            }
        }
    }

    /**
     * 查找玩家手牌中的主牌对子
     */
    findTrumpPairs(handCards) {
        const pairs = [];
        const ranks = ['5', 'big', 'small'];

        // 红桃5对子
        const hearts5 = handCards.filter(c => c.suit === 'heart' && c.rank === '5');
        if (hearts5.length >= 2) {
            pairs.push({rank: '5', cards: hearts5.slice(0, 2), priority: 1});
        }

        // 大王对子
        const bigJokers = handCards.filter(c => c.rank === 'big');
        if (bigJokers.length >= 2) {
            pairs.push({rank: 'big', cards: bigJokers.slice(0, 2), priority: 2});
        }

        // 小王对子
        const smallJokers = handCards.filter(c => c.rank === 'small');
        if (smallJokers.length >= 2) {
            pairs.push({rank: 'small', cards: smallJokers.slice(0, 2), priority: 3});
        }

        return pairs.sort((a, b) => a.priority - b.priority);
    }

    /**
     * 判断主牌是否更高优先级
     */
    isHigherTrump(rank, currentTrumpSuit) {
        const priorityOrder = ['5', 'small', 'big'];
        // 注意：currentLevel 是数字 2-14，需要用 getLevelRank 转换
        const currentRank = currentTrumpSuit ? getLevelRank(this.currentLevel) : null;

        const currentIdx = currentRank ? priorityOrder.indexOf(currentRank) : -1;
        const newIdx = priorityOrder.indexOf(rank);

        return newIdx < currentIdx || currentIdx === -1;
    }

    /**
     * 广播投标状态
     */
    broadcastBidState() {
        const {bidState} = this.dealingState;

        // 确定主来源玩家
        let trumpCallerSeat = -1;
        let mainSuit = bidState.trumpSuit;

        if (this.isFirstRound) {
            // 第一局：使用庄家作为主来源
            if (bidState.hasBanker) {
                trumpCallerSeat = bidState.bankerSeat;
            }
        } else {
            // 非第一局：使用抢主玩家作为主来源
            if (this.gameRound.trumpCall) {
                trumpCallerSeat = this.gameRound.trumpCall.seatIndex;
            }
        }

        // 检查是否有反主，反主会改变主花色
        if (this.gameRound.trumpCall && this.gameRound.trumpCall.isReversed) {
            mainSuit = this.gameRound.trumpCall.suit;
            if (this.gameRound.isNoTrump) {
                mainSuit = null;
            }
        }

        this.io.to(this.roomCode).emit('game:bid_state_changed', {
            hasBanker: bidState.hasBanker,
            bankerSeat: bidState.bankerSeat,
            hasTrump: bidState.hasTrump,
            trumpSuit: mainSuit,
            isLocked: bidState.isLocked,
            trumpCallerSeat
        });
    }

    /**
     * 检查并触发补底
     */
    checkAndTriggerTakeBottom() {
        // 只有在发牌完成后才触发
        if (this.dealingState.isDealing) {
            return;
        }

        if (this.canTakeBottom()) {
            // 直接执行补底，不要调用 checkBidTimeout()
            this.performBottomSupplement();
            
            // 进入埋底阶段
            this.phase = GAME_PHASES.BOTTOMING;
            this.notifyTakeBottom();
        }
    }

    /**
     * 检查是否可以补底
     */
    canTakeBottom() {
        const {bidState} = this.dealingState;
        if (this.isFirstRound) {
            return bidState.hasBanker && bidState.isLocked;
        } else {
            return bidState.hasBanker && bidState.hasTrump;
        }
    }

    /**
     * 通知当前玩家抢庄/抢主
     */
    notifyBankerCall() {
        const player = Array.from(this.players.values()).find(p => p.seatIndex === this.turnSeat);
        if (!player) return;

        this.io.to(player.socketId).emit('game:your_turn', {
            action: this.isFirstRound ? 'call_banker' : 'call_trump',
            seatIndex: this.turnSeat,
            level: this.currentLevel,
            handCards: player.handCards.map(c => cardToString(c))
        });
    }

    /**
     * 处理抢庄 - 发牌过程中的事件响应
     */
    async handleCallBanker(userId, cardStr) {
        const player = this.players.get(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        // 检查是否已有玩家抢庄（先到先得）
        if (this.dealingState.responded.bankerCall) {
            return {success: false, message: '已有玩家抢庄', code: 'BID_REJECTED'};
        }

        const card = stringToCard(cardStr);
        if (card.rank !== '2') {
            return {success: false, message: '抢庄必须使用2'};
        }

        // 抢庄不改变手牌，只记录主花色

        // 标记已响应
        this.dealingState.responded.bankerCall = true;
        this.dealingState.bidState.hasBanker = true;
        this.dealingState.bidState.hasTrump = true;
        this.dealingState.bidState.bankerSeat = player.seatIndex;
        this.dealingState.bidState.trumpSuit = card.suit;
        this.dealingState.bidState.bankerSuit = card.suit; // 记录抢庄时使用的花色

        console.log('抢庄状态变更信息:', this.dealingState.bidState)

        // 更新游戏局
        this.gameRound.bankerCall = {
            caller: userId,
            card: cardStr,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };
        this.gameRound.bankerTeam = player.team;
        this.gameRound.bankerUserId = userId;
        this.gameRound.bankerSeatIndex = player.seatIndex;
        this.gameRound.trumpSuit = card.suit;
        this.gameRound.level = this.currentLevel;

        // 第一局抢庄时，设置主花色来源
        this.gameRound.trumpCall = {
            caller: userId,
            suit: card.suit,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };

        await this.gameRound.save();

        // 广播抢庄信息
        this.io.to(this.roomCode).emit('game:banker_called', {
            seatIndex: player.seatIndex,
            team: player.team,
            card: cardStr,
            suit: card.suit
        });
        // 广播投标状态变化
        this.broadcastBidState();
        return {success: true};
    }

    /**
     * 处理锁庄 - 发牌过程中的事件响应
     */
    async handleLockBanker(userId, cardStr) {
        const player = this.players.get(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        // 检查是否已有玩家操作
        if (this.dealingState.responded.bankerLock) {
            return {success: false, message: '已有玩家锁庄', code: 'BID_REJECTED'};
        }

        const card = stringToCard(cardStr);
        if (!card) {
            return {success: false, message: '无效的牌'};
        }

        // 锁庄不改变手牌，只记录主花色，标记已响应
        this.dealingState.responded.bankerLock = true;
        this.dealingState.bidState.isLocked = true;

        // 如果还没有庄家，设置该玩家为庄家并锁庄
        if (!this.dealingState.bidState.hasBanker) {
            this.dealingState.bidState.hasBanker = true;
            this.dealingState.bidState.bankerSeat = player.seatIndex;
            this.dealingState.bidState.bankerSuit = card.suit;
            this.dealingState.bidState.trumpSuit = card.suit;

            // 更新游戏局
            this.gameRound.bankerCall = {
                caller: userId,
                card: cardStr,
                seatIndex: player.seatIndex,
                isLocked: true,
                isReversed: false
            };
            this.gameRound.bankerTeam = player.team;
            this.gameRound.bankerUserId = userId;
            this.gameRound.bankerSeatIndex = player.seatIndex;
            this.gameRound.trumpSuit = card.suit;
            this.gameRound.level = this.currentLevel;

            // 设置主花色来源
            this.gameRound.trumpCall = {
                caller: userId,
                suit: card.suit,
                seatIndex: player.seatIndex,
                isLocked: false,
                isReversed: false
            };
        } else {
            // 已有庄家，只进行锁庄
            this.gameRound.bankerCall.isLocked = true;
        }

        await this.gameRound.save();

        this.io.to(this.roomCode).emit('game:banker_locked', {
            seatIndex: player.seatIndex,
            card: cardStr
        });

        // 广播投标状态变化
        this.broadcastBidState();

        // 清除超时定时器
        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
            this.bidTimeout = null;
        }

        // 检查是否可以触发补底（如果发牌已完成）
        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    /**
     * 处理反庄 - 发牌过程中的事件响应
     */
    async handleReverseBanker(userId, cardStr) {
        const player = this.players.get(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        // 检查是否已有玩家操作
        if (this.dealingState.responded.bankerReverse) {
            return {success: false, message: '已有玩家反庄', code: 'BID_REJECTED'};
        }

        const card = stringToCard(cardStr);
        if (!card) {
            return {success: false, message: '无效的卡牌', code: 'INVALID_CARD'};
        }

        // 反庄不改变手牌，只记录主花色

        // 标记已响应
        this.dealingState.responded.bankerReverse = true;
        this.dealingState.bidState.hasBanker = true;
        this.dealingState.bidState.bankerSeat = player.seatIndex;
        this.dealingState.bidState.bankerSuit = card.suit;
        this.dealingState.bidState.trumpSuit = card.suit;
        this.dealingState.bidState.isLocked = true;

        // 反庄成功
        this.gameRound.bankerCall = {
            caller: userId,
            card: cardStr,
            seatIndex: player.seatIndex,
            isLocked: true,
            isReversed: true
        };
        this.gameRound.bankerTeam = player.team;
        this.gameRound.bankerUserId = userId;
        this.gameRound.bankerSeatIndex = player.seatIndex;
        this.gameRound.trumpSuit = card.suit;

        // 更新主花色来源为反庄玩家
        this.gameRound.trumpCall = {
            caller: userId,
            suit: card.suit,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };

        await this.gameRound.save();

        // 广播反庄
        this.io.to(this.roomCode).emit('game:banker_reversed', {
            seatIndex: player.seatIndex,
            team: player.team,
            card: cardStr,
            suit: card.suit
        });

        // 广播投标状态变化
        this.broadcastBidState();

        // 清除超时定时器
        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
            this.bidTimeout = null;
        }

        // 检查是否可以触发补底（如果发牌已完成）
        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    /**
     * 通知抢主色
     */
    notifyTrumpCall() {
        const player = Array.from(this.players.values()).find(p => p.seatIndex === this.turnSeat);
        if (!player) return;

        this.io.to(player.socketId).emit('game:your_turn', {
            action: 'call_trump',
            seatIndex: this.turnSeat,
            level: this.currentLevel,
            trumpSuit: this.gameRound.trumpSuit,
            handCards: player.handCards.map(c => cardToString(c))
        });
    }

    /**
     * 处理抢主色 - 发牌过程中的事件响应
     */
    async handleCallTrump(userId, cardStr) {
        const player = this.players.get(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        // 检查是否已有玩家抢主（先到先得）
        if (this.dealingState.responded.trumpCall) {
            return {success: false, message: '已有玩家抢主', code: 'BID_REJECTED'};
        }

        const card = stringToCard(cardStr);
        // 注意：currentLevel 是数字 2-14，card.rank 是字符串，需要用 getLevelRank 转换
        const levelRank = getLevelRank(this.currentLevel);

        if (card.rank !== levelRank) {
            return {success: false, message: `抢主必须使用${levelRank}`};
        }

        // 抢主不改变手牌，只记录主花色

        // 标记已响应
        this.dealingState.responded.trumpCall = true;
        this.dealingState.bidState.hasTrump = true;
        this.dealingState.bidState.trumpSuit = card.suit;
        this.dealingState.bidState.trumpCallerSuit = card.suit;

        // 更新主花色
        this.gameRound.trumpCall = {
            caller: userId,
            suit: card.suit,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };
        this.gameRound.trumpSuit = card.suit;
        this.gameRound.isNoTrump = false;

        // 非第一局抢主时，明确设置主来源玩家
        this.gameRound.trumpCall.seatIndex = player.seatIndex;

        await this.gameRound.save();

        // 广播抢主
        this.io.to(this.roomCode).emit('game:trump_called', {
            seatIndex: player.seatIndex,
            suit: card.suit
        });

        // 广播投标状态变化
        this.broadcastBidState();

        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
            this.bidTimeout = null;
        }

        return {success: true};
    }

    /**
     * 处理锁主色 - 发牌过程中的事件响应
     */
    async handleLockTrump(userId, cardStr) {
        const player = this.players.get(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        // 检查是否已有玩家操作
        if (this.dealingState.responded.trumpLock) {
            return {success: false, message: '已有玩家锁主', code: 'BID_REJECTED'};
        }

        const card = stringToCard(cardStr);
        // 锁主不改变手牌，只记录主花色

        // 标记已响应
        this.dealingState.responded.trumpLock = true;
        this.dealingState.bidState.isLocked = true;

        // 如果还没有主花色，设置该玩家为抢主玩家并锁主
        if (!this.dealingState.bidState.hasTrump) {
            this.dealingState.bidState.hasTrump = true;
            this.dealingState.bidState.trumpSuit = card.suit;
            this.dealingState.bidState.trumpCallerSuit = card.suit;

            // 更新游戏局
            this.gameRound.trumpCall = {
                caller: userId,
                suit: card.suit,
                seatIndex: player.seatIndex,
                isLocked: true,
                isReversed: false
            };
            this.gameRound.trumpSuit = card.suit;
            this.gameRound.isNoTrump = false;
            this.gameRound.trumpCall.seatIndex = player.seatIndex;
        } else {
            // 已有主花色，只进行锁主
            this.gameRound.trumpCall.isLocked = true;
        }

        await this.gameRound.save();

        // 广播锁主
        if (!this.dealingState.bidState.hasTrump) {
            // 直接锁主（没有抢主过程）
            this.io.to(this.roomCode).emit('game:trump_locked_direct', {
                seatIndex: player.seatIndex,
                card: cardStr
            });
        } else {
            // 抢主后的锁主
            this.io.to(this.roomCode).emit('game:trump_locked', {
                seatIndex: player.seatIndex,
                card: cardStr
            });
        }

        // 广播投标状态变化
        this.broadcastBidState();

        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
            this.bidTimeout = null;
        }

        return {success: true};
    }

    /**
     * 处理反主色 - 发牌过程中的事件响应
     */
    async handleReverseTrump(userId, cardStr) {
        const player = this.players.get(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        // 检查是否已有玩家操作
        if (this.dealingState.responded.trumpReverse) {
            return {success: false, message: '已有玩家反主', code: 'BID_REJECTED'};
        }

        const card = stringToCard(cardStr);
        let newSuit = card.suit;
        let isNoTrump = false;

        // 判断反主类型
        if (card.rank === 'big') {
            isNoTrump = true; // 大王对 -> 无主
        } else if (card.rank === 'small') {
            isNoTrump = true; // 小王对 -> 无主
        } else if (card.rank === '5') {
            // 红桃5对 -> 可选花色
            // 这里需要前端传递选择的花色，暂时按无主处理
            isNoTrump = true;
        }

        // 反主不改变手牌，只记录主花色

        // 标记已响应
        this.dealingState.responded.trumpReverse = true;
        this.dealingState.bidState.hasTrump = true;
        this.dealingState.bidState.trumpSuit = isNoTrump ? null : newSuit;
        this.dealingState.bidState.trumpCallerSuit = isNoTrump ? null : newSuit;
        this.dealingState.bidState.isLocked = true;

        // 反主成功
        this.gameRound.trumpCall = {
            caller: userId,
            suit: newSuit,
            seatIndex: player.seatIndex,
            isLocked: true,
            isReversed: true
        };
        this.gameRound.trumpSuit = newSuit;
        this.gameRound.isNoTrump = isNoTrump;

        // 更新主来源为反主玩家
        this.gameRound.trumpCall.seatIndex = player.seatIndex;
        this.gameRound.trumpCall.suit = newSuit;
        this.gameRound.trumpCall.isReversed = true;

        await this.gameRound.save();

        // 广播反主
        this.io.to(this.roomCode).emit('game:trump_reversed', {
            seatIndex: player.seatIndex,
            suit: newSuit,
            isNoTrump
        });

        // 广播投标状态变化
        this.broadcastBidState();

        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
            this.bidTimeout = null;
        }

        return {success: true};
    }

    /**
     * 通知庄家埋底 - 此时底牌已经补给了庄家
     */
    notifyTakeBottom() {
        const banker = Array.from(this.players.values()).find(p => p.seatIndex === this.dealingState.bidState.bankerSeat);
        if (!banker) return;

        this.turnSeat = banker.seatIndex;

        // 通知庄家埋底（底牌已经在 performBottomSupplement 中补给了庄家）
        this.io.to(banker.socketId).emit('game:your_turn', {
            action: 'bury_bottom',
            seatIndex: this.turnSeat,
            handCards: banker.handCards.map(c => cardToString(c)),
            drawInfo: null // 首次埋底无抄底信息
        });
    }

    /**
     * 埋底完成后启动抄底流程
     */
    startDrawBottom() {
        this.drawBottomState.isActive = true;
        this.drawBottomState.currentAskerSeat = (this.dealingState.bidState.bankerSeat + 1) % 4;
        this.drawBottomState.askedPlayers = [];
        this.drawBottomState.skippedTrumpCaller = false;
        this.drawBottomState.hasDrawer = false;
        this.drawBottomState.isWaitingBury = false;
        this.drawBottomState.pendingDrawer = null;

        console.log('--埋底1', this.drawBottomState)
        console.log('--埋底2', this.dealingState)

        this.askNextPlayerDrawBottom();
    }

    /**
     * 判断是否应跳过该玩家
     */
    shouldSkipPlayer(seat) {
        const {bidState} = this.dealingState;
        const {hasDrawer, askedPlayers} = this.drawBottomState;

        // 非第一局：始终跳过庄家（抢主玩家）
        if (!this.isFirstRound) {
            return seat === bidState.bankerSeat;
        }

        // 第一局：已有人抄底 且 抢主玩家未询问
        if (hasDrawer && !askedPlayers.includes(bidState.trumpCallerSeat)) {
            return seat === bidState.trumpCallerSeat;
        }

        return false;
    }

    /**
     * 获取玩家可抄底的牌型选项
     */
    getDrawableOptions(seatIndex) {
        const player = Array.from(this.players.values()).find(p => p.seatIndex === seatIndex);
        if (!player) return [];

        const options = [];
        const handCards = player.handCards;
        const trumpSuit = this.gameRound.trumpSuit;
        const isNoTrump = this.gameRound.isNoTrump;

        // 统计各牌型数量
        const cardCount = {};
        for (const card of handCards) {
            const key = `${card.suit}_${card.rank}`;
            cardCount[key] = (cardCount[key] || 0) + 1;
        }

        // 检查红桃5对
        const hearts5 = handCards.filter(c => c.suit === 'heart' && c.rank === '5');
        if (hearts5.length >= 2) {
            options.push({
                type: 'hearts5_pair',
                cards: ['♥5', '♥5'],
                label: '红桃5对'
            });
        }

        // 检查大王对子
        const bigJokers = handCards.filter(c => c.rank === 'big');
        if (bigJokers.length >= 2) {
            options.push({
                type: 'big_joker_pair',
                cards: ['big', 'big'],
                label: '大王×2'
            });
        }

        // 检查小王对子
        const smallJokers = handCards.filter(c => c.rank === 'small');
        if (smallJokers.length >= 2) {
            options.push({
                type: 'small_joker_pair',
                cards: ['small', 'small'],
                label: '小王×2'
            });
        }

        // 检查等级对子（只有符合抄底规则的对子才显示）
        if (this.currentLevel === 2) {
            for (const card of handCards) {
                const key = `${card.suit}_${card.rank}`;
                if (cardCount[key] >= 2 && card.rank === '2') {
                    // 排除红桃5（已单独处理）
                    if (!(card.suit === 'heart' && card.rank === '5')) {
                        options.push({
                            type: 'trump_pair',
                            cards: [cardToString(card), cardToString(card)],
                            label: `${this.getSuitLabel(card.suit)}2对`
                        });
                    }
                }
            }
        }

        return options;
    }

    /**
     * 获取花色标签
     */
    getSuitLabel(suit) {
        const suitLabels = {
            'spade': '♠',
            'heart': '♥',
            'club': '♣',
            'diamond': '♦'
        };
        return suitLabels[suit] || suit;
    }

    /**
     * 询问下一位玩家抄底
     */
    askNextPlayerDrawBottom() {
        // 检查是否所有玩家都已询问
        const allSeats = [0, 1, 2, 3];
        const remainingSeats = allSeats.filter(s => !this.drawBottomState.askedPlayers.includes(s));

        // 所有人都已经问过
        if (remainingSeats.length === 0 || this.drawBottomState.currentAskerSeat === -1) {
            this.finishDrawBottom();
            return;
        }

        const currentSeat = this.drawBottomState.currentAskerSeat;

        //TODO 检查是否应跳过该玩家，这里的算法需要检查
        if (this.shouldSkipPlayer(currentSeat)) {
            if (!this.drawBottomState.askedPlayers.includes(currentSeat)) {
                this.drawBottomState.askedPlayers.push(currentSeat);
            }
            // 移动到下一位
            this.drawBottomState.currentAskerSeat = (currentSeat + 1) % 4;
            this.askNextPlayerDrawBottom();
            return;
        }

        // 检查是否已有可抄底的牌型
        const options = this.getDrawableOptions(currentSeat);

        if (options.length === 0) {
            // 无可抄底牌型，记录并继续
            this.drawBottomState.askedPlayers.push(currentSeat);
            this.drawBottomState.currentAskerSeat = (currentSeat + 1) % 4;
            this.askNextPlayerDrawBottom();
            return;
        }

        // 发送询问事件
        const player = Array.from(this.players.values()).find(p => p.seatIndex === currentSeat);
        if (!player) {
            this.drawBottomState.currentAskerSeat = (currentSeat + 1) % 4;
            this.askNextPlayerDrawBottom();
            return;
        }

        this.io.to(this.roomCode).emit('game:ask_draw_bottom', {
            seatIndex: currentSeat,
            timeout: 10,
            drawableOptions: options,
            currentMainSuit: this.gameRound.trumpSuit,
            isNoTrump: this.gameRound.isNoTrump,
            currentLevel: this.currentLevel
        });

        // 启动5秒超时
        if (this.drawBottomState.drawTimeout) {
            clearTimeout(this.drawBottomState.drawTimeout);
        }
        // TODO 询问抄底计时器，每人5s
        this.drawBottomState.drawTimeout = setTimeout(() => {
            this.handleDrawBottomTimeout();
        }, 5000);
    }

    /**
     * 处理抄底超时
     */
    handleDrawBottomTimeout() {
        const currentSeat = this.drawBottomState.currentAskerSeat;

        // 广播超时
        this.io.to(this.roomCode).emit('game:draw_bottom_timeout', {
            seatIndex: currentSeat
        });

        // 记录已询问
        this.drawBottomState.askedPlayers.push(currentSeat);

        // 继续询问下一位
        this.drawBottomState.currentAskerSeat = (currentSeat + 1) % 4;
        this.askNextPlayerDrawBottom();
    }

    /**
     * 处理玩家抄底
     */
    async handleTakeBottom(userId, data) {
        const player = this.players.get(userId);
        if (!player || player.seatIndex !== this.drawBottomState.currentAskerSeat) {
            return {success: false, message: '当前不是您的操作回合'};
        }

        const {drawType, chosenSuit, cards} = data;

        // 校验牌型
        const validation = this.validateDrawBottomCards(cards, drawType);
        if (!validation.valid) {
            return {success: false, message: validation.message};
        }

        // 获取当前底牌
        const bottomCards = this.gameRound.bottomCards.map(c => stringToCard(c));

        // 补底：将底牌加入玩家手牌
        player.handCards.push(...bottomCards);

        // 计算新主花色
        const {newSuit, isNoTrump} = this.calculateNewMainSuit(drawType, chosenSuit);

        // 更新主花色
        this.gameRound.trumpSuit = newSuit;
        this.gameRound.isNoTrump = isNoTrump;
        this.gameRound.bottomCards = cards; // 抄底使用的牌作为新底牌

        // 标记已有玩家抄底
        this.drawBottomState.hasDrawer = true;
        this.drawBottomState.isWaitingBury = true;
        this.drawBottomState.pendingDrawer = {
            userId: userId,
            seatIndex: player.seatIndex,
            drawType: drawType,
            chosenSuit: chosenSuit,
            cards: cards
        };

        await this.gameRound.save();

        // 广播抄底成功
        this.io.to(this.roomCode).emit('game:draw_bottom_success', {
            seatIndex: player.seatIndex,
            drawType: drawType,
            drawCards: cards,
            mainSuit: newSuit,
            isNoTrump: isNoTrump,
            addedCards: bottomCards.map(c => cardToString(c)),
            totalCards: player.handCards.length
        });

        // 更新投标状态
        this.broadcastBidState();

        // 通知玩家埋底
        this.turnSeat = player.seatIndex;
        const drawInfo = {
            drawType: drawType,
            drawCards: cards,
            mainSuit: newSuit,
            isNoTrump: isNoTrump
        };

        this.io.to(player.socketId).emit('game:your_turn', {
            action: 'bury_bottom',
            seatIndex: player.seatIndex,
            handCards: player.handCards.map(c => cardToString(c)),
            drawInfo: drawInfo
        });

        return {success: true};
    }

    /**
     * 校验抄底牌型
     */
    validateDrawBottomCards(cards, drawType) {
        if (!cards || cards.length !== 2) {
            return {valid: false, message: '需要2张牌'};
        }

        const c1 = stringToCard(cards[0]);
        const c2 = stringToCard(cards[1]);

        if (!c1 || !c2) {
            return {valid: false, message: '无效的牌'};
        }

        switch (drawType) {
            case 'big_joker_pair':
                if (c1.rank === 'big' && c2.rank === 'big') {
                    return {valid: true};
                }
                return {valid: false, message: '必须是两张大王'};

            case 'small_joker_pair':
                if (c1.rank === 'small' && c2.rank === 'small') {
                    return {valid: true};
                }
                return {valid: false, message: '必须是两张小王'};

            case 'hearts5_pair':
                if (c1.suit === 'heart' && c2.suit === 'heart' && c1.rank === '5' && c2.rank === '5') {
                    return {valid: true};
                }
                return {valid: false, message: '必须是红桃5对'};

            case 'trump_pair':
                // 必须是同花色对子
                if (c1.suit !== c2.suit || c1.rank !== c2.rank) {
                    return {valid: false, message: '必须是同花色对子'};
                }

                // 检查是否为符合抄底规则的对子
                const card = c1; // 两张牌相同

                // 固定主对儿：红桃5对、大王对、小王对
                if ((card.suit === 'heart' && card.rank === '5') || // 红桃5对
                    (card.suit === 'joker' && card.rank === 'big') || // 大王对
                    (card.suit === 'joker' && card.rank === 'small')) { // 小王对
                    return {valid: true};
                }

                // 本局等级是2，所以同花色对2才满足
                if (this.currentLevel === 2 && card.rank === '2') {
                    return {valid: true};
                }

                return {valid: false, message: '必须是红桃5对、大王对、小王对或同花色对2'};

            default:
                return {valid: false, message: '无效的抄底类型'};
        }
    }

    /**
     * 计算抄底后的新主花色
     */
    calculateNewMainSuit(drawType, chosenSuit) {
        switch (drawType) {
            case 'big_joker_pair':
                return {newSuit: null, isNoTrump: true};

            case 'small_joker_pair':
                return {newSuit: null, isNoTrump: true};

            case 'hearts5_pair':
                return {newSuit: chosenSuit, isNoTrump: false};

            case 'trump_pair':
                // 直接使用传入的cards参数，而不是依赖pendingDrawer
                const card = stringToCard(cards[0]);
                return {newSuit: card.suit, isNoTrump: false};

            default:
                return {newSuit: this.gameRound.trumpSuit, isNoTrump: this.gameRound.isNoTrump};
        }
    }

    /**
     * 抄底后埋底完成，继续询问下一位
     */
    continueDrawBottom() {
        const currentSeat = this.drawBottomState.currentAskerSeat;
        this.drawBottomState.askedPlayers.push(currentSeat);
        this.drawBottomState.currentAskerSeat = (currentSeat + 1) % 4;
        this.askNextPlayerDrawBottom();
    }

    /**
     * 抄底阶段结束，进入出牌阶段
     */
    finishDrawBottom() {
        this.drawBottomState.isActive = false;

        if (this.drawBottomState.drawTimeout) {
            clearTimeout(this.drawBottomState.drawTimeout);
            this.drawBottomState.drawTimeout = null;
        }

        // 广播抄底阶段完成
        this.io.to(this.roomCode).emit('game:draw_bottom_complete', {
            finalMainSuit: this.gameRound.trumpSuit,
            isNoTrump: this.gameRound.isNoTrump,
            hasDrawer: this.drawBottomState.hasDrawer
        });

        // 进入出牌阶段
        this.phase = GAME_PHASES.PLAYING;
        this.turnIndex = 1;
        this.turnSeat = this.gameRound.bankerSeatIndex;
        this.turnCards = new Map();  // 初始化出牌记录（使用Map保持插入顺序）
        this.leadPlayCardCount = 0;  // 重置首家出牌数量

        // 广播游戏开始
        this.io.to(this.roomCode).emit('game:playing_start', {
            bankerSeat: this.gameRound.bankerSeatIndex,
            bankerTeam: this.gameRound.bankerTeam,
            trumpSuit: this.gameRound.trumpSuit,
            isNoTrump: this.gameRound.isNoTrump,
            level: this.currentLevel,
            currentTurn: this.turnIndex
        });

        // 通知首家出牌
        this.notifyPlay();
    }

    /**
     * 处理玩家放弃抄底
     */
    handleSkipDrawBottom(userId) {
        const player = this.players.get(userId);
        if (!player || player.seatIndex !== this.drawBottomState.currentAskerSeat) {
            return {success: false, message: '当前不是您的操作回合'};
        }

        // 清除超时
        if (this.drawBottomState.drawTimeout) {
            clearTimeout(this.drawBottomState.drawTimeout);
            this.drawBottomState.drawTimeout = null;
        }

        // 广播放弃
        this.io.to(this.roomCode).emit('game:draw_bottom_skipped', {
            seatIndex: player.seatIndex
        });

        // 记录并继续
        this.drawBottomState.askedPlayers.push(this.drawBottomState.currentAskerSeat);
        this.drawBottomState.currentAskerSeat = (this.drawBottomState.currentAskerSeat + 1) % 4;
        this.askNextPlayerDrawBottom();

        return {success: true};
    }

    /**
     * 处理埋底
     */
    async handleBuryBottom(userId, buryCards) {
        const player = this.players.get(userId);
        if (!player || player.seatIndex !== this.turnSeat) {
            return {success: false, message: '当前不是您的操作回合'};
        }

        if (buryCards.length !== 8) {
            return {success: false, message: '必须埋8张底牌'};
        }

// --- 修复部分：统计每张要埋的牌出现的次数 ---
        const buryCountMap = {};
        for (const card of buryCards) {
            buryCountMap[card] = (buryCountMap[card] || 0) + 1;
        }

        // 移除埋的牌
        player.handCards = player.handCards.filter(c => {
            const str = cardToString(c);
            if (buryCountMap[str] > 0) {
                buryCountMap[str]--; // 消耗一个计数
                return false; // 移除这副牌
            }
            return true; // 保留
        });

        // 更新底牌
        this.gameRound.bottomCards = buryCards;
        this.gameRound.bankerBuriedBottom = true;
        await this.gameRound.save();

        // 广播埋底完成
        this.io.to(this.roomCode).emit('game:bottom_buried', {
            seatIndex: this.turnSeat,
            buryCount: 8,
            remainingCards: this.gameRound.bottomCards.length
        });

        // 给该玩家发送手牌更新
        this.io.to(player.socketId).emit('game:hand_updated', {
            handCards: player.handCards.map(c => cardToString(c)),
            seatIndex: player.seatIndex
        });

        // 判断是普通埋底还是抄底后的埋底
        if (this.drawBottomState.isWaitingBury) {
            // 抄底后的埋底完成，继续询问下一位玩家
            this.drawBottomState.isWaitingBury = false;
            this.drawBottomState.pendingDrawer = null;
            this.continueDrawBottom();
        } else {
            // 庄家埋底完成后，启动抄底流程
            this.startDrawBottom();
        }

        return {success: true};
    }

    /**
     * 通知出牌
     */
    notifyPlay() {
        const player = Array.from(this.players.values()).find(p => p.seatIndex === this.turnSeat);
        if (!player) return;

        // 发送当前玩家出牌指令
        // deskCards 需转换为普通对象，因为 Map 序列化后是空对象
        // 内部存储仍是 Map（保持插入顺序），这里只是为了发送给客户端
        this.io.to(player.socketId).emit('game:your_turn', {
            action: 'play_cards',
            seatIndex: this.turnSeat,
            currentTurn: this.turnIndex,
            handCards: player.handCards.map(c => cardToString(c)),
            deskCards: Object.fromEntries(this.turnCards.entries()),
            trumpSuit: this.gameRound.trumpSuit,
            isNoTrump: this.gameRound.isNoTrump,
            level: this.currentLevel
        });
    }

    /**
     * 处理出牌
     */
    async handlePlayCards(userId, cardStrs) {
        const player = this.players.get(userId);
        if (!player || player.seatIndex !== this.turnSeat) {
            return {success: false, message: '当前不是您的操作回合'};
        }

        const cards = cardStrs.map(c => stringToCard(c));

        const handStrs = player.handCards.map(c => cardToString(c));
        // 1. 统计玩家手牌中每种牌的数量
        const handCountMap = {};
        for (const card of handStrs) {
            handCountMap[card] = (handCountMap[card] || 0) + 1;
        }
        // 2. 校验需要的牌是否足够
        for (const reqCard of cardStrs) {
            if (!handCountMap[reqCard] || handCountMap[reqCard] <= 0) {
                return {
                    success: false,
                    message: `手牌中 ${reqCard} 数量不足`
                };
            }
            // 每匹配到一张，就在计数器中减 1
            handCountMap[reqCard] -= 1;
        }

        // 验证出牌是否合法
        // 使用 Map.size 判断是否首家出牌（不能使用 Object.keys() 因为数字键会被排序）
        const isFirstPlay = this.turnCards.size === 0;

        // 如果不是首家，检查出牌数量是否与首家相同
        if (!isFirstPlay && cardStrs.length !== this.leadPlayCardCount) {
            return {
                success: false,
                message: `出牌数量必须与首家相同（首家出了${this.leadPlayCardCount}张）`
            };
        }

        const validation = validatePlay(
            cards,
            player.handCards,
            isFirstPlay,
            this.gameRound.trumpSuit,
            this.gameRound.isNoTrump,
            this.currentLevel
        );

        if (!validation.isValid) {
            // 计算罚分
            const pattern = analyzePlayPattern(cards, this.gameRound.trumpSuit, this.gameRound.isNoTrump, this.currentLevel);
            const maxSubCount = Math.max(...(pattern.leadPattern?.subPatterns?.map(sp => sp.weight) || [1]));
            const penalty = maxSubCount * 10;

            // 罚分归属
            const penaltyTeam = player.team;
            if (penaltyTeam === 'A') {
                this.teamBScore += penalty;
            } else {
                this.teamAScore += penalty;
            }

            // 广播罚分
            this.io.to(this.roomCode).emit('game:play_penalty', {
                seatIndex: this.turnSeat,
                penalty,
                reason: validation.reason
            });

            return {success: false, message: validation.reason, penalty};
        }

        // 如果是首家出牌且验证通过，记录出牌数量（即使被罚也要记录）
        if (isFirstPlay) {
            this.leadPlayCardCount = cardStrs.length;
        }

        // 移除手牌中对应的牌
        const playCountMap = {};
        for (const card of cardStrs) {
            playCountMap[card] = (playCountMap[card] || 0) + 1;
        }
        player.handCards = player.handCards.filter(c => {
            const str = cardToString(c);
            if (playCountMap[str] > 0) {
                playCountMap[str]--; // 消耗一个计数
                return false; // 移除这副牌
            }
            return true; // 保留
        });

        // 判断出牌类型（用于结算时的优先级判断）
        // playType 取值：normal(正常跟牌)、trumpKill(毙牌)、discard(贴牌)
        // 结算优先级：毙牌 > 正常出牌 > 贴牌
        let playType = 'normal';
        if (!isFirstPlay) {
            // 获取首家出的牌，根据首家的牌型计算，其他玩家是毙牌还是贴（Map 的第一个值即是首家）
            const leadCards = this.turnCards.values().next().value.cards;

            const leadPattern = analyzePlayPattern(
                leadCards,
                this.gameRound.trumpSuit,
                this.gameRound.isNoTrump,
                this.currentLevel
            );
            playType = classifyPlayType(
                cards,
                leadPattern.leadSuit,
                leadPattern,
                this.gameRound.trumpSuit,
                this.gameRound.isNoTrump,
                this.currentLevel
            );
            console.log('--本轮玩家出牌类型', playType);
        }

        // 记录出牌（使用 Map 保持插入顺序，便于结算时判断出牌顺序）
        // 存储格式：{ cards: 牌数组, playType: 出牌类型 }
        this.turnCards.set(this.turnSeat, {cards, playType});

        // 保存到数据库
        await PlayRecord.create({
            roundId: this.gameRound._id,
            turnIndex: this.turnIndex,
            seatIndex: this.turnSeat,
            userId: userId,
            cards: cardStrs,
            playType
        });

        // 广播出牌
        const playerCardCounts = {};
        for (const player of this.players.values()) {
            playerCardCounts[`seat${player.seatIndex}`] = player.handCards.length;
        }
        this.io.to(this.roomCode).emit('game:card_played', {
            seatIndex: this.turnSeat,
            cards: cardStrs,
            playType,
            playerCardCounts,
            leadPlayCardCount: this.leadPlayCardCount
        });

        // 给该玩家发送手牌更新
        this.io.to(player.socketId).emit('game:hand_updated', {
            handCards: player.handCards.map(c => cardToString(c)),
            seatIndex: player.seatIndex
        });

        // 检查是否所有人都出了牌（4名玩家）
        if (this.turnCards.size === 4) {
            // 回合结算
            await this.settleTurn();
        } else {
            // 继续下一个玩家
            this.turnSeat = (this.turnSeat + 1) % 4;
            this.notifyPlay();
        }

        return {success: true};
    }

    /**
     * 回合结算
     * 规则：毙牌 > 正常出牌 > 贴牌
     * 同牌型时比较大小，同大小时先出赢
     *
     * 比较优先级说明（gameRule.md 第571行）：
     * 1. 首先按 playType 优先级：毙牌(3) > 正常(2) > 贴牌(1)
     * 2. 若 playType 相同，则用 comparePlays 比较牌型大小
     * 3. 若牌型大小也相同，则先出的玩家获胜（Map 保持插入顺序）
     */
    async settleTurn() {
        // 使用 Map.entries() 获取按出牌顺序的数组
        // 注意：不能使用 Object.entries()，因为数字键会被排序
        const entries = Array.from(this.turnCards.entries());

        console.log('========== 回合结算 ==========');
        console.log('出牌顺序:', entries.map(([seat, data]) => `${seat}号位(${data.playType}): ${data.cards.map(c => c.suit + c.rank).join(',')}`));

        // entries[0] 是首家出的牌
        const leadCards = entries[0][1].cards;

        const trumpSuit = this.gameRound.trumpSuit;
        const isNoTrump = this.gameRound.isNoTrump;
        const currentLevel = this.currentLevel;

        let maxSeat = -1;        // 当前最大牌的玩家座位
        let maxCards = null;     // 当前最大牌的牌数组
        let maxPlayType = null;  // 当前最大牌的出牌类型
        let winnerTeam = '';     // 获胜队伍

        // 遍历所有出牌，按出牌顺序比较
        for (const [seat, data] of entries) {
            const turnCards = data.cards;
            const playType = data.playType;

            let isWin = false;

            // 首家直接获胜
            if (maxCards === null) {
                isWin = true;
                console.log(`  座位${seat}: 首家，直接获胜`);
            } else {
                // 比较优先级：毙牌(3) > 正常(2) > 贴牌(1)
                const playTypeOrder = {trumpKill: 3, normal: 2, discard: 1};
                const currentTypeOrder = playTypeOrder[playType] || 2;
                const maxTypeOrder = playTypeOrder[maxPlayType] || 2;

                if (currentTypeOrder > maxTypeOrder) {
                    // playType 优先级更高，直接获胜
                    isWin = true;
                    console.log(`  座位${seat}: ${playType}(${currentTypeOrder}) > ${maxPlayType}(${maxTypeOrder})，获胜`);
                } else if (currentTypeOrder === maxTypeOrder) {
                    // 贴/毙/跟类型 相同，用 comparePlays 比较牌型大小
                    const result = comparePlays(
                        maxCards,
                        turnCards,
                        trumpSuit,
                        isNoTrump,
                        currentLevel,
                        maxSeat,
                        seat
                    );

                    if (result > 0) {
                        // maxCards 大，当前玩家输
                        console.log(`  座位${seat}: 贴/毙/跟类型相同，牌型比座位${maxSeat}小，失败`);
                    } else if (result < 0) {
                        // turnCards 大，当前玩家赢
                        isWin = true;
                        console.log(`  座位${seat}: 贴/毙/跟类型相同，牌型比座位${maxSeat}大，获胜`);
                    } else {
                        // 牌型大小也相同，按出牌顺序，先出的赢
                        const currentIndex = entries.findIndex(e => e[0] === seat);
                        const maxIndex = entries.findIndex(e => e[0] === maxSeat);
                        if (currentIndex < maxIndex) {
                            isWin = true;
                            console.log(`  座位${seat}: 贴/毙/跟和牌型都相同，先出(index${currentIndex} < index${maxIndex})，获胜`);
                        } else {
                            console.log(`  座位${seat}: 贴/毙/跟和牌型都相同，后出(index${currentIndex} > index${maxIndex})，失败`);
                        }
                    }
                } else {
                    console.log(`  座位${seat}: ${playType}(${currentTypeOrder}) < ${maxPlayType}(${maxTypeOrder})，失败`);
                }
            }

            // 更新当前最大牌
            if (isWin) {
                maxSeat = seat;
                maxCards = turnCards;
                maxPlayType = playType;
                const winner = Array.from(this.players.values()).find(p => p.seatIndex === seat);
                winnerTeam = winner.team;
            }
        }

        // 计算本回合得分（所有玩家打出的分数牌）
        let roundScore = 0;
        for (const [, data] of entries) {
            for (const card of data.cards) {
                roundScore += getScoreValue(card);
            }
        }

        // 只有闲家获胜才能得分
        if (winnerTeam !== this.gameRound.bankerTeam) {
            if (winnerTeam === 'A') {
                this.teamAScore += roundScore;
            } else {
                this.teamBScore += roundScore;
            }
        }
        console.log(`最终获胜: 座位${maxSeat} (${maxPlayType}), 队伍: ${winnerTeam}, 分值: ${roundScore}`);
        console.log(`A队得分: ${this.teamAScore}, B队得分: ${this.teamBScore}`);
        console.log('========== 回合结算结束 ==========');

        // 判断是否最后一回合（所有玩家手牌为空）
        const isLastTurn = Array.from(this.players.values()).every(p => p.handCards.length === 0);

        console.log('--是否是最后一轮', isLastTurn);

        // 保存回合得分到数据库
        await RoundScore.create({
            roundId: this.gameRound._id,
            turnIndex: this.turnIndex,
            winnerSeat: maxSeat,
            winnerTeam,
            baseScore: roundScore,
            teamAScore: this.teamAScore,
            teamBScore: this.teamBScore
        });

        // 广播回合结果给所有客户端
        this.io.to(this.roomCode).emit('game:turn_result', {
            turnIndex: this.turnIndex,
            winnerSeat: maxSeat,
            winnerTeam,
            score: roundScore,
            teamAScore: this.teamAScore,
            teamBScore: this.teamBScore,
            isLastTurn
        });

        if (isLastTurn) {
            await this.settleBottom(maxSeat, winnerTeam, maxCards);
            await this.settleRound();
        } else {
            // 进入下一回合
            this.turnIndex++;
            this.turnSeat = maxSeat;  // 获胜玩家获得下轮优先出牌权
            this.turnCards = new Map();  // 重置出牌记录
            this.leadPlayCardCount = 0;  // 重置首家出牌数量
            this.notifyPlay();
        }
    }

    /**
     * 抠底结算
     * @param {number} winnerSeat - 获胜玩家座位
     * @param {string} winnerTeam - 获胜队伍 (A/B)
     * @param {Array} winningCards - 获胜方最后一轮的牌
     */
    async settleBottom(winnerSeat, winnerTeam, winningCards) {
        const bankerTeam = this.gameRound.bankerTeam;
        const bottomCards = this.gameRound.bottomCards.map(c => stringToCard(c));

        let bottomScore = 0;
        for (const card of bottomCards) {
            bottomScore += getScoreValue(card);
        }

        let bottomResult = null;

        if (winnerTeam !== bankerTeam) {
            const multiplier = getBottomMultiplier(
                winningCards,
                this.gameRound.trumpSuit,
                this.gameRound.isNoTrump,
                this.currentLevel
            );

            const drawScore = bottomScore * multiplier;

            if (winnerTeam === 'A') {
                this.teamAScore += drawScore;
            } else {
                this.teamBScore += drawScore;
            }

            bottomResult = {
                success: true,
                multiplier,
                baseScore: bottomScore,
                drawScore,
                winnerTeam
            };

            console.log(`===== 抠底成功 =====`);
            console.log(`底牌分数: ${bottomScore}, 抠底倍数: ${multiplier}, 抠底得分: ${drawScore}`);
            console.log(`闲家(${winnerTeam}队)获得抠底得分`);
            console.log(`A队: ${this.teamAScore}, B队: ${this.teamBScore}`);
            console.log(`====================`);
        }

        this.io.to(this.roomCode).emit('game:bottom_reveal', {
            bottomCards: this.gameRound.bottomCards,
            winnerSeat,
            winnerTeam,
            bottomResult,
            teamAScore: this.teamAScore,
            teamBScore: this.teamBScore
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        return bottomResult;
    }

    /**
     * 计算升级后的等级（不能跳过2、J和A）
     */
    calculateNewLevel(currentLevel, levelChange) {
        const specialLevels = [2, 11, 14]; // 2、J和A
        let newLevel = Math.min(14, currentLevel + levelChange);

        // 检查是否跳过特殊等级
        for (let level = currentLevel; level <= newLevel; level++) {
            if (specialLevels.includes(level)) {
                return level;
            }
        }
        return newLevel;
    }

    /**
     * 单局结算
     */
    async settleRound() {
        const bankerTeam = this.gameRound.bankerTeam;
        const opponentTeam = bankerTeam === 'A' ? 'B' : 'A';
        const opponentScore = bankerTeam === 'A' ? this.teamBScore : this.teamAScore;

        // 计算等级变化
        let levelChange = 0;
        let winner = ''; // 'banker' | 'opponent'

        if (opponentScore >= 80) {
            // 闲家赢
            winner = opponentTeam;
            const diff = opponentScore - 80;
            levelChange = Math.floor(diff / 40) + 1;
        } else if (opponentScore === 0) {
            winner = bankerTeam;
            levelChange = 3;
        } else if (opponentScore <= 40) {
            winner = bankerTeam;
            levelChange = 2;
        } else {
            winner = bankerTeam;
            levelChange = 1;
        }

        // 更新队伍等级
        const room = await Room.findById(this.roomId);

        if (winner === opponentTeam) {
            // 闲家获胜：闲家队伍升级（不能跳过2和J）
            if (opponentTeam === 'A') {
                room.levelA = this.calculateNewLevel(room.levelA, levelChange);
            } else {
                room.levelB = this.calculateNewLevel(room.levelB, levelChange);
            }
            // 庄家队伍保持不变，等待下次成为庄家守庄成功后升级
        } else {
            // 庄家守庄成功：庄家队伍升级（不能跳过2和J）
            if (bankerTeam === 'A') {
                room.levelA = this.calculateNewLevel(room.levelA, levelChange);
            } else {
                room.levelB = this.calculateNewLevel(room.levelB, levelChange);
            }
        }

        // 检查是否有人达到A并获胜
        let gameWinner = null;
        if (room.levelA === 14 && bankerTeam === 'A' && winner === 'A') {
            gameWinner = 'A';
        } else if (room.levelB === 14 && bankerTeam === 'B' && winner === 'B') {
            gameWinner = 'B';
        }

        await room.save();

        // 计算下一局庄家座位：庄家赢→+2（庄家队友），闲家赢→+1（顺延给敌方）
        const isBankerWin = winner === bankerTeam;
        const nextBankerSeat = isBankerWin
            ? (this.gameRound.bankerSeatIndex + 2) % 4
            : (this.gameRound.bankerSeatIndex + 1) % 4;
        const nextBankerPlayer = Array.from(this.players.values()).find(p => p.seatIndex === nextBankerSeat);
        const nextBankerTeam = nextBankerPlayer?.team || 'A';
        const nextLevel = winner === bankerTeam
            ? (bankerTeam === 'A' ? room.levelA : room.levelB)
            : (opponentTeam === 'A' ? room.levelA : room.levelB);

        // 保存到 gameRound，供 startNextRound 使用
        this.gameRound.nextBankerSeat = nextBankerSeat;
        this.gameRound.nextBankerTeam = nextBankerTeam;
        await this.gameRound.save();

        // 广播单局结果
        this.io.to(this.roomCode).emit('game:round_result', {
            winner,
            bankerTeam,
            opponentScore,
            levelChange,
            newLevelA: room.levelA,
            newLevelB: room.levelB,
            teamAScore: this.teamAScore,
            teamBScore: this.teamBScore,
            gameWinner
        });

        if (gameWinner) {
            // 游戏结束
            this.io.to(this.roomCode).emit('game:game_over', {
                winner: gameWinner
            });
            this.phase = GAME_PHASES.FINISHED;
        } else {
            this.io.to(this.roomCode).emit('game:round_starting', {
                nextRoundIndex: this.gameRound.roundIndex + 1,
                bankerSeat: nextBankerSeat,
                bankerTeam: nextBankerTeam,
                bankerName: nextBankerPlayer?.username || '',
                level: nextLevel
            });

            // 3秒后开始下一局
            setTimeout(() => this.startNextRound(), 3000);
        }
    }

    /**
     * 开始下一局
     */
    async startNextRound() {
        this.isFirstRound = false;

        // 从 Room 读取庄家队伍的等级
        const room = await Room.findById(this.roomId);
        const newBankerSeat = this.gameRound.nextBankerSeat;
        const newBankerTeam = this.gameRound.nextBankerTeam;
        this.currentLevel = newBankerTeam === 'A' ? room.levelA : room.levelB;

        // 洗牌
        this.deck = shuffleDeck(generateDeck());
        const bottomCards = this.deck.slice(100);

        // 创建新游戏局
        const prevRound = this.gameRound;

        const round = new GameRound({
            roomId: this.roomId,
            roundIndex: prevRound.roundIndex + 1,
            level: this.currentLevel,
            bankerTeam: newBankerTeam,
            bankerSeatIndex: newBankerSeat,
            trumpSuit: null,
            isNoTrump: null,
            phase: GAME_PHASES.DEALING,
            status: 'active',
            bottomCards: bottomCards.map(c => cardToString(c))
        });

        await round.save();

        // 初始化玩家手牌（清空，用于发牌动画逐步增加）
        for (const player of this.players.values()) {
            player.handCards = [];
        }

        // 初始化发牌状态
        this.dealingState = {
            isDealing: true,
            cardIndex: 0,
            currentPlayer: 0,
            dealInterval: null,
            responded: {
                bankerCall: false,
                bankerLock: false,
                bankerReverse: false,
                trumpCall: false,
                trumpLock: false,
                trumpReverse: false
            },
            bidState: {
                hasBanker: false,
                bankerSeat: -1,
                bankerSuit: null,
                hasTrump: false,
                trumpSuit: null,
                trumpCallerSuit: null,
                isLocked: false
            }
        };

        this.gameRound = round;
        this.phase = GAME_PHASES.DEALING;
        this.turnIndex = 1;
        this.turnSeat = newBankerSeat;
        this.teamAScore = 0;
        this.teamBScore = 0;

        // 广播开始发牌
        this.io.to(this.roomCode).emit('game:deal_start', {
            totalCards: 100,
            isFirstRound: false,
            level: this.currentLevel,
            bankerSeat: newBankerSeat,
            bankerTeam: newBankerTeam,
            roundIndex: round.roundIndex
        });

        // 开始单张发牌动画，每125ms发一张
        this.dealingState.dealInterval = setInterval(() => {
            this.dealOneCard();
        }, 125);
    }

    /**
     * 检查玩家手牌总分
     */
    checkPlayerHandScores() {
        const lowScorePlayers = [];

        for (const player of this.players.values()) {
            const totalScore = this.calculateHandScore(player.handCards);
            console.log(`玩家 ${player.username} (座位 ${player.seatIndex}) 手牌总分: ${totalScore}`);

            if (totalScore < 20) {
                lowScorePlayers.push({
                    seatIndex: player.seatIndex,
                    username: player.username,
                    userId: player.userId,
                    score: totalScore
                });
            }
        }

        const needsRedeal = lowScorePlayers.length > 0;
        return {needsRedeal, lowScorePlayers};
    }

    /**
     * 计算手牌总分
     */
    calculateHandScore(handCards) {
        return handCards.reduce((total, card) => {
            return total + getScoreValue(card);
        }, 0);
    }

    /**
     * 处理重新发牌
     */
    async handleRedeal(lowScorePlayers) {
        // 广播重新发牌原因
        this.io.to(this.roomCode).emit('game:redeal_triggered', {
            reason: '玩家手牌总分不足',
            lowScorePlayers: lowScorePlayers.map(p => ({
                seatIndex: p.seatIndex,
                username: p.username,
                score: p.score
            }))
        });

        // 清除所有玩家的手牌
        for (const player of this.players.values()) {
            player.handCards = [];
        }

        // 重新生成并洗牌
        this.deck = shuffleDeck(generateDeck());

        // 重新发牌
        await this.redealCards();
    }

    /**
     * 重新发牌
     */
    async redealCards() {
        // 重置发牌状态
        this.dealingState = {
            isDealing: true,
            cardIndex: 0,
            currentPlayer: 0,
            dealInterval: null,
            responded: {
                bankerCall: false,
                bankerLock: false,
                bankerReverse: false,
                trumpCall: false,
                trumpLock: false,
                trumpReverse: false
            },
            bidState: {
                hasBanker: false,
                bankerSeat: -1,
                bankerSuit: null,
                hasTrump: false,
                trumpSuit: null,
                trumpCallerSuit: null,
                isLocked: false
            }
        };

        // 更新游戏局状态
        this.gameRound.phase = GAME_PHASES.DEALING;
        await this.gameRound.save();

        // 广播开始重新发牌
        this.io.to(this.roomCode).emit('game:redeal_start', {
            message: '重新发牌',
            totalCards: 100,
            level: this.currentLevel,
            bankerUserId: this.isFirstRound?null:this.gameRound.bankerUserId,
            bankerSeatIndex: this.isFirstRound?null:this.gameRound.bankerSeatIndex,
            bankerTeam: this.isFirstRound?null:this.gameRound.bankerTeam,
            trumpSuit: this.isFirstRound?null:this.gameRound.trumpSuit,
            isNoTrump: this.isFirstRound?null:this.gameRound.isNoTrump,
            phase: GAME_PHASES.DEALING,
            bidState: {
                hasBanker: false,
                bankerSeat: -1,
                bankerSuit: null,
                hasTrump: false,
                trumpSuit: null,
                isLocked: false
            }
        });

        // 开始重新发牌
        this.dealingState.dealInterval = setInterval(() => {
            this.redealOneCard();
        }, 125);
    }

    /**
     * 重新发单张牌
     */
    redealOneCard() {
        if (this.dealingState.cardIndex >= 100) {
            // 重新发牌完成
            clearInterval(this.dealingState.dealInterval);
            this.dealingState.isDealing = false;
            this.onRedealingComplete();
            return;
        }

        const card = this.deck[this.dealingState.cardIndex];
        const playerIndex = this.dealingState.currentPlayer;
        const player = Array.from(this.players.values()).find(p => p.seatIndex === playerIndex);

        if (player) {
            player.handCards.push(card);

            // 广播单张发牌
            this.io.to(this.roomCode).emit('game:card_dealt', {
                seatIndex: playerIndex,
                cardCount: player.handCards.length,
                cardIndex: this.dealingState.cardIndex + 1,
                totalCards: 100
            });

            // 给该玩家发送手牌更新
            if (player.socketId) {
                this.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => cardToString(c)),
                    seatIndex: playerIndex
                });
            }
        }

        // 移动到下一个玩家和下一张牌
        this.dealingState.cardIndex++;
        this.dealingState.currentPlayer = (this.dealingState.currentPlayer + 1) % 4;
    }

    /**
     * 重新发牌完成后的处理
     */
    async onRedealingComplete() {
        console.log('重新发牌完成');

        // 保存手牌到数据库
        for (let i = 0; i < 4; i++) {
            const player = Array.from(this.players.values()).find(p => p.seatIndex === i);
            if (player) {
                await PlayerCard.create({
                    roundId: this.gameRound._id,
                    userId: player.userId,
                    seatIndex: i,
                    cards: player.handCards.map(c => cardToString(c))
                });
            }
        }

        // 再次检查手牌总分（防止单次重新发牌仍然不满足条件）
        const {needsRedeal, lowScorePlayers} = this.checkPlayerHandScores();

        if (needsRedeal) {
            // 如果仍然不满足条件，再次重新发牌（最多3次）
            if (!this.redealCount) this.redealCount = 0;
            this.redealCount++;

            if (this.redealCount < 3) {
                console.log(`第${this.redealCount}次重新发牌`);
                this.handleRedeal(lowScorePlayers);
                return;
            } else {
                // 超过3次，强制开始游戏
                this.io.to(this.roomCode).emit('game:redeal_failed', {
                    message: '多次重新发牌后仍不满足条件，强制开始游戏',
                    lowScorePlayers: lowScorePlayers.map(p => ({
                        seatIndex: p.seatIndex,
                        username: p.username,
                        score: p.score
                    }))
                });
            }
        }

        // 重置重新发牌计数
        this.redealCount = 0;

        this.phase = GAME_PHASES.DEALING;

        // 广播重新发牌完成
        this.io.to(this.roomCode).emit('game:redeal_complete', {
            message: '重新发牌完成'
        });

        // 给每个玩家发送完整手牌
        for (const player of this.players.values()) {
            if (player.socketId) {
                this.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => cardToString(c)),
                    seatIndex: player.seatIndex
                });
            }
        }

        // 广播当前投标状态
        this.broadcastBidState();

        // 重新检测所有玩家的发牌事件（抢庄、抢主、锁庄、锁主）
        this.recheckDealingEvents();

        // 通知等待操作阶段并启动倒计时
        this.notifyWaitForOperation();
        this.startBidTimeout(10000);
    }

    /**
     * 重新检测发牌事件（用于重新发牌后）
     */
    recheckDealingEvents() {
        const {bidState, responded} = this.dealingState;
        // 注意：currentLevel 是数字 2-14，需要用 getLevelRank 转换
        const levelRank = getLevelRank(this.currentLevel);

        for (const player of this.players.values()) {
            if (this.isFirstRound) {
                if (!bidState.hasBanker) {
                    for (const card of player.handCards) {
                        if (card.rank === '2') {
                            const sameSuit2s = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                            if (sameSuit2s.length >= 2 && !responded.bankerLock) {
                                const availableCards = sameSuit2s.map(c => cardToString(c));
                                this.io.to(player.socketId).emit('game:can_lock_banker', {
                                    seatIndex: player.seatIndex,
                                    availableCards
                                });
                            } else if (!responded.bankerCall) {
                                const availableCards = player.handCards
                                    .filter(c => c.rank === '2')
                                    .map(c => cardToString(c));
                                this.io.to(player.socketId).emit('game:can_call_banker', {
                                    seatIndex: player.seatIndex,
                                    level: this.currentLevel,
                                    availableCards
                                });
                            }
                            break;
                        }
                    }
                } else if (!bidState.isLocked) {
                    const bankerSuit = bidState.bankerSuit;
                    const sameSuit2s = player.handCards.filter(c => c.suit === bankerSuit && c.rank === '2');
                    if (player.seatIndex === bidState.bankerSeat && sameSuit2s.length >= 2 && !responded.bankerLock) {
                        const availableCards = sameSuit2s.map(c => cardToString(c));
                        this.io.to(player.socketId).emit('game:can_lock_banker', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    } else if (player.seatIndex !== bidState.bankerSeat && !responded.bankerReverse) {
                        for (const card of player.handCards) {
                            if (card.rank === '2') {
                                const sameSuitCards = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                                if (sameSuitCards.length >= 2) {
                                    this.io.to(player.socketId).emit('game:can_reverse_banker', {
                                        seatIndex: player.seatIndex,
                                        suit: card.suit,
                                        card: cardToString(card)
                                    });
                                }
                                break;
                            }
                        }
                    }
                }
            } else {
                if (!bidState.hasTrump) {
                    for (const card of player.handCards) {
                        if (card.rank === levelRank) {
                            const sameSuitLevelCards = player.handCards.filter(c => c.suit === card.suit && c.rank === levelRank);
                            if (sameSuitLevelCards.length >= 2 && !responded.trumpLock) {
                                const availableCards = sameSuitLevelCards.map(c => cardToString(c));
                                this.io.to(player.socketId).emit('game:can_lock_trump', {
                                    seatIndex: player.seatIndex,
                                    availableCards
                                });
                            } else if (!responded.trumpCall) {
                                const availableCards = player.handCards
                                    .filter(c => c.rank === levelRank)
                                    .map(c => cardToString(c));
                                this.io.to(player.socketId).emit('game:can_call_trump', {
                                    seatIndex: player.seatIndex,
                                    level: this.currentLevel,
                                    availableCards
                                });
                            }
                            break;
                        }
                    }
                } else if (!bidState.isLocked) {
                    const trumpCallerSuit = bidState.trumpCallerSuit;
                    const sameSuitLevelCards = player.handCards.filter(c => c.suit === trumpCallerSuit && c.rank === levelRank);
                    if (player.seatIndex === bidState.bankerSeat && sameSuitLevelCards.length >= 2 && !responded.trumpLock) {
                        const availableCards = sameSuitLevelCards.map(c => cardToString(c));
                        this.io.to(player.socketId).emit('game:can_lock_trump', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    } else if (player.seatIndex === bidState.bankerSeat && !responded.trumpReverse) {
                        const pairs = this.findTrumpPairs(player.handCards);
                        if (pairs.length > 0) {
                            const highestPair = pairs[0];
                            if (this.isHigherTrump(highestPair.rank, bidState.trumpSuit)) {
                                this.io.to(player.socketId).emit('game:can_reverse_trump', {
                                    seatIndex: player.seatIndex,
                                    availablePairs: pairs.map(p => cardToString(p.cards[0]))
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 游戏房间管理器
 */
class GameRoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();  // roomCode -> GameRoom
    }

    /**
     * 创建游戏房间
     */
    async createRoom(roomId, roomCode) {
        const gameRoom = new GameRoom(roomId, roomCode, this.io);
        this.rooms.set(roomCode, gameRoom);
        return gameRoom;
    }

    /**
     * 获取游戏房间
     */
    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    /**
     * 删除游戏房间
     */
    removeRoom(roomCode) {
        this.rooms.delete(roomCode);
    }
}

module.exports = GameRoomManager;
