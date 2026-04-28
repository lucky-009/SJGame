/**
 * 底牌管理器 - 处理补底、抄底、埋底逻辑
 */

const { DRAW_PRIORITY, SUIT_LABELS } = require('./constants');
const { getLevelRank } = require('../../../common/CardUtils');

const DRAW_TYPE_LABELS = {
    'hearts5_pair': '红桃5对',
    'big_joker_pair': '大王对',
    'small_joker_pair': '小王对',
    'trump_pair': '主牌对'
};

const DrawBottomLog = {
    info: (msg, data) => {
        const parts = [msg];
        if (data) {
            if (data.roomCode) parts.push(`房间:${data.roomCode}`);
            if (data.seatIndex !== undefined) parts.push(`座位${data.seatIndex}`);
            if (data.bankerSeat !== undefined) parts.push(`庄家座位${data.bankerSeat}`);
            if (data.drawType) parts.push(`抄底类型:${DRAW_TYPE_LABELS[data.drawType] || data.drawType}`);
            if (data.newSuit) parts.push(`新主花色:${SUIT_LABELS[data.newSuit] || data.newSuit}`);
            if (data.isNoTrump !== undefined) parts.push(`无主:${data.isNoTrump ? '是' : '否'}`);
            if (data.buryCount !== undefined) parts.push(`埋牌数:${data.buryCount}`);
            if (data.remainingCards !== undefined) parts.push(`剩余${data.remainingCards}张`);
            if (data.hasDrawer !== undefined) parts.push(`有人抄底:${data.hasDrawer ? '是' : '否'}`);
            if (data.trumpSuit) parts.push(`最终花色:${SUIT_LABELS[data.trumpSuit] || data.trumpSuit}`);
            if (data.level !== undefined) parts.push(`等级:${data.level}`);
        }
        console.log('[抄底] ' + parts.join(', '));
    },
    warn: (msg, data) => {
        const parts = ['⚠ ' + msg];
        if (data) {
            if (data.roomCode) parts.push(`房间:${data.roomCode}`);
            if (data.seatIndex !== undefined) parts.push(`座位${data.seatIndex}`);
        }
        console.log('[抄底] ' + parts.join(', '));
    },
    error: (msg, data) => {
        const parts = ['✖ ' + msg];
        if (data) {
            if (data.roomCode) parts.push(`房间:${data.roomCode}`);
            if (data.seatIndex !== undefined) parts.push(`座位${data.seatIndex}`);
        }
        console.log('[抄底] ' + parts.join(', '));
    }
};

class BottomManager {
    constructor(room) {
        this.room = room;
        this.initDrawBottomState();
    }

    initDrawBottomState() {
        this.room.drawBottomState = {
            isActive: false,
            currentAskerSeat: -1,
            abandonedPlayers: [],
            hasDrawer: false,
            drawTimeout: null,
            isWaitingBury: false,
            pendingDrawer: null,
            lastDrawType: null
        };
    }



    notifyTakeBottom() {
        const banker = this.room.playerManager.getPlayerBySeat(this.room.dealingState.bidState.bankerSeat);
        console.log('当前庄家信息:', banker);
        if (!banker) return;

        const bottomCards = this.room.gameRound.bottomCards.map(c => this.room.stringToCard(c));
        banker.handCards.push(...bottomCards);

        this.room.turnSeat = banker.seatIndex;

        this.room.gameRound.bottomSupplemented = true;
        this.room.gameRound.bottomCards = [];
        this.room.gameRound.save();

        // 通知庄家埋底
        this.room.io.to(banker.socketId).emit('game:your_turn', {
            action: 'bury_bottom',
            seatIndex: this.room.turnSeat,
            handCards: banker.handCards.map(c => this.room.cardToString(c)),
            drawInfo: null
        });

        // 广播给房间内所有玩家，更新手牌数量
        const playerCardCounts = {};
        this.room.playerManager.getAllPlayers().forEach(p => {
            playerCardCounts[`seat${p.seatIndex}`] = p.handCards.length;
        });
        this.room.io.to(this.room.roomCode).emit('game:bottom_taken', {
            playerCardCounts
        });
    }

    startDrawBottom() {
        this.room.drawBottomState.isActive = true;
        this.room.drawBottomState.currentAskerSeat = this.room.dealingState.bidState.bankerSeat;
        this.room.drawBottomState.abandonedPlayers = [];
        this.room.drawBottomState.hasDrawer = false;
        this.room.drawBottomState.isWaitingBury = false;
        this.room.drawBottomState.pendingDrawer = null;
        this.room.drawBottomState.lastDrawType = null;

        DrawBottomLog.info('开始抄底环节', {
            roomCode: this.room.roomCode,
            bankerSeat: this.room.dealingState.bidState.bankerSeat,
            bankerTeam: this.room.dealingState.bidState.bankerTeam,
            trumpSuit: this.room.gameRound.trumpSuit,
            isNoTrump: this.room.gameRound.isNoTrump,
            level: this.room.currentLevel
        });

        console.log('--埋底1', this.room.drawBottomState)
        console.log('--埋底2', this.room.dealingState)

        this.askNextPlayerDrawBottom();
    }

    getDrawableOptions(seatIndex) {
        const player = this.room.playerManager.getPlayerBySeat(seatIndex);
        if (!player) return [];

        const options = [];
        const handCards = player.handCards;

        const cardCount = {};
        for (const card of handCards) {
            const key = `${card.suit}_${card.rank}`;
            cardCount[key] = (cardCount[key] || 0) + 1;
        }

        const hearts5 = handCards.filter(c => c.suit === 'heart' && c.rank === '5');
        if (hearts5.length >= 2) {
            options.push({
                type: 'hearts5_pair',
                cards: hearts5.map(c => this.room.cardToString(c)),
                label: '红桃5对'
            });
        }

        const bigJokers = handCards.filter(c => c.rank === 'big');
        if (bigJokers.length >= 2) {
            options.push({
                type: 'big_joker_pair',
                cards: bigJokers.map(c => this.room.cardToString(c)),
                label: '大王×2'
            });
        }

        const smallJokers = handCards.filter(c => c.rank === 'small');
        if (smallJokers.length >= 2) {
            options.push({
                type: 'small_joker_pair',
                cards: smallJokers.map(c => this.room.cardToString(c)),
                label: '小王×2'
            });
        }

        const currentLevel = this.room.currentLevel;
        const currentLevelRank = getLevelRank(currentLevel);
        for (const card of handCards) {
            const key = `${card.suit}_${card.rank}`;
            if (cardCount[key] >= 2 && card.rank === currentLevelRank) {
                if (!(card.suit === 'heart' && card.rank === '5')) {
                    options.push({
                        type: 'trump_pair',
                        cards: [this.room.cardToString(card), this.room.cardToString(card)],
                        label: `${this.getSuitLabel(card.suit)}${currentLevel}对`
                    });
                }
            }
        }

        return this.filterOptionsByDrawPriority(options, this.room.drawBottomState.lastDrawType);
    }

    filterOptionsByDrawPriority(options, lastDrawType) {
        if (!lastDrawType) return options;

        const lastIdx = DRAW_PRIORITY.indexOf(lastDrawType);
        return options.filter(opt => DRAW_PRIORITY.indexOf(opt.type) < lastIdx);
    }

    getSuitLabel(suit) {
        return SUIT_LABELS[suit] || suit;
    }

askNextPlayerDrawBottom() {
        const { abandonedPlayers } = this.room.drawBottomState;

        let currentSeat = this.room.drawBottomState.currentAskerSeat;
        let iterations = 0;
        const maxIterations = 4;

        while (iterations < maxIterations) {
            iterations++;
            currentSeat = (currentSeat + 1) % 4;
            this.room.drawBottomState.currentAskerSeat = currentSeat;

            // 如果当前玩家已被放弃，继续询问下一个
            if (abandonedPlayers.includes(currentSeat)) {
                continue;
            }

            // 如果有待抄底玩家，跳过该玩家（不允许重复抄底）
            const pendingDrawerSeat = this.room.drawBottomState.pendingDrawer?.seatIndex;
            if (pendingDrawerSeat !== undefined && currentSeat === pendingDrawerSeat) {
                continue;
            }

            break;
        }

        if (iterations >= maxIterations) {
            this.finishDrawBottom();
            return;
        }

        const options = this.getDrawableOptions(currentSeat);

        if (options.length === 0) {
            DrawBottomLog.warn('该玩家无可选抄底选项，自动跳过', {
                roomCode: this.room.roomCode,
                seatIndex: currentSeat
            });
            this.room.drawBottomState.abandonedPlayers.push(currentSeat);
            this.askNextPlayerDrawBottom();
            return;
        }

        const player = this.room.playerManager.getPlayerBySeat(currentSeat);
        if (!player) {
            this.askNextPlayerDrawBottom();
            return;
        }

        const optionLabels = options.map(o => DRAW_TYPE_LABELS[o.type] || o.type).join(', ');
        DrawBottomLog.info('询问玩家抄底', {
            roomCode: this.room.roomCode,
            seatIndex: currentSeat,
            drawType: options[0].type,
            options: optionLabels
        });
        DrawBottomLog.info('设置抄底超时', {
            roomCode: this.room.roomCode,
            seatIndex: currentSeat,
            timeout: '10秒'
        });

        this.room.io.to(this.room.roomCode).emit('game:ask_draw_bottom', {
            seatIndex: currentSeat,
            timeout: 10,
            drawableOptions: options,
            currentMainSuit: this.room.gameRound.trumpSuit,
            isNoTrump: this.room.gameRound.isNoTrump,
            currentLevel: this.room.currentLevel
        });

        if (this.room.drawBottomState.drawTimeout) {
            clearTimeout(this.room.drawBottomState.drawTimeout);
        }
        this.room.drawBottomState.drawTimeout = setTimeout(() => {
            this.handleDrawBottomTimeout();
        }, 8000);
    }

    handleDrawBottomTimeout() {
        if (this.room.drawBottomState.hasDrawer === true && this.room.drawBottomState.isWaitingBury === true) {
            return
        }
        const currentSeat = this.room.drawBottomState.currentAskerSeat;

        DrawBottomLog.warn('玩家超时未操作，自动放弃', {
            roomCode: this.room.roomCode,
            seatIndex: currentSeat
        });

        this.room.io.to(this.room.roomCode).emit('game:draw_bottom_timeout', {
            seatIndex: currentSeat
        });

        this.room.drawBottomState.abandonedPlayers.push(currentSeat);
        this.room.drawBottomState.currentAskerSeat = (currentSeat + 1) % 4;
        this.askNextPlayerDrawBottom();
    }

    async handleTakeBottom(userId, data) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player || player.seatIndex !== this.room.drawBottomState.currentAskerSeat) {
            DrawBottomLog.warn('非当前操作玩家', {
                roomCode: this.room.roomCode,
                seatIndex: player?.seatIndex
            });
            return { success: false, message: '当前不是您的操作回合' };
        }

        const { drawType, chosenSuit, cards } = data;

        const validation = this.validateDrawBottomCards(cards, drawType);
        if (!validation.valid) {
            DrawBottomLog.warn('抄底验证失败', {
                roomCode: this.room.roomCode,
                seatIndex: player.seatIndex,
                drawType: drawType,
                reason: validation.message
            });
            return { success: false, message: validation.message };
        }

        DrawBottomLog.info('玩家选择抄底', {
            roomCode: this.room.roomCode,
            seatIndex: player.seatIndex,
            drawType: drawType,
            cards: cards.join(', ')
        });

        const bottomCards = this.room.gameRound.bottomCards.map(c => this.room.stringToCard(c));
        player.handCards.push(...bottomCards);

        const { newSuit, isNoTrump } = this.calculateNewMainSuit(drawType, chosenSuit, cards);

        DrawBottomLog.info('抄底成功，更新主花色', {
            roomCode: this.room.roomCode,
            seatIndex: player.seatIndex,
            newSuit: newSuit,
            isNoTrump: isNoTrump,
            drawType: drawType
        });

        this.room.gameRound.trumpSuit = newSuit;
        this.room.gameRound.isNoTrump = isNoTrump;
        this.room.gameRound.bottomCards = cards;

        this.room.dealingState.bidState.trumpSuit = newSuit;
        this.room.dealingState.bidState.isNoTrump = isNoTrump;
        this.room.dealingState.bidState.trumpCallerSuit = newSuit;
        this.room.dealingState.bidState.trumpCallerSeat = player.seatIndex;

        this.room.drawBottomState.lastDrawType = drawType;
        this.room.drawBottomState.hasDrawer = true;
        this.room.drawBottomState.isWaitingBury = true;
        this.room.drawBottomState.pendingDrawer = {
            userId: userId,
            seatIndex: player.seatIndex,
            drawType: drawType,
            chosenSuit: chosenSuit,
            cards: cards
        };

        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:draw_bottom_success', {
            seatIndex: player.seatIndex,
            drawType: drawType,
            drawCards: cards,
            mainSuit: newSuit,
            isNoTrump: isNoTrump,
            addedCards: bottomCards.map(c => this.room.cardToString(c)),
            totalCards: player.handCards.length
        });

        // 广播给房间内所有玩家，更新手牌数量
        const playerCardCounts = {};
        this.room.playerManager.getAllPlayers().forEach(p => {
            playerCardCounts[`seat${p.seatIndex}`] = p.handCards.length;
        });
        this.room.io.to(this.room.roomCode).emit('game:bottom_taken', {
            playerCardCounts
        });

        this.room.bidManager.broadcastBidState();

        this.room.turnSeat = player.seatIndex;
        const drawInfo = {
            drawType: drawType,
            drawCards: cards,
            mainSuit: newSuit,
            isNoTrump: isNoTrump
        };

        this.room.io.to(player.socketId).emit('game:your_turn', {
            action: 'bury_bottom',
            seatIndex: player.seatIndex,
            handCards: player.handCards.map(c => this.room.cardToString(c)),
            drawInfo: drawInfo
        });

        return { success: true };
    }

    validateDrawBottomCards(cards, drawType) {
        if (!cards || cards.length !== 2) {
            return { valid: false, message: '需要2张牌' };
        }

        const c1 = this.room.stringToCard(cards[0]);
        const c2 = this.room.stringToCard(cards[1]);

        if (!c1 || !c2) {
            return { valid: false, message: '无效的牌' };
        }

        switch (drawType) {
            case 'big_joker_pair':
                if (c1.rank !== 'big' || c2.rank !== 'big') {
                    return { valid: false, message: '必须是两张大王' };
                }
                break;

            case 'small_joker_pair':
                if (c1.rank !== 'small' || c2.rank !== 'small') {
                    return { valid: false, message: '必须是两张小王' };
                }
                break;

            case 'hearts5_pair':
                if (c1.suit !== 'heart' || c2.suit !== 'heart' || c1.rank !== '5' || c2.rank !== '5') {
                    return { valid: false, message: '必须是红桃5对' };
                }
                break;

            case 'trump_pair':
                if (c1.suit !== c2.suit || c1.rank !== c2.rank) {
                    return { valid: false, message: '必须是同花色对子' };
                }

                const card = c1;
                const currentLevelRank = getLevelRank(this.room.currentLevel);
                if (card.rank === currentLevelRank) {
                } else {
                    return { valid: false, message: `必须是红桃5对、大王对、小王对或同花色对${this.room.currentLevel}` };
                }
                break;

            default:
                return { valid: false, message: '无效的抄底类型' };
        }

        const lastDrawType = this.room.drawBottomState.lastDrawType;
        if (lastDrawType) {
            const currentIdx = DRAW_PRIORITY.indexOf(drawType);
            const lastIdx = DRAW_PRIORITY.indexOf(lastDrawType);

            if (currentIdx >= lastIdx) {
                return { valid: false, message: '抄底的牌型必须大于上一次抄底的牌型' };
            }
        }

        return { valid: true };
    }

    calculateNewMainSuit(drawType, chosenSuit, cards) {
        switch (drawType) {
            case 'big_joker_pair':
                return { newSuit: null, isNoTrump: true };

            case 'small_joker_pair':
                return { newSuit: null, isNoTrump: true };

            case 'hearts5_pair':
                return { newSuit: chosenSuit, isNoTrump: false };

            case 'trump_pair':
                const card = this.room.stringToCard(cards[0]);
                return { newSuit: card.suit, isNoTrump: false };

            default:
                return { newSuit: this.room.gameRound.trumpSuit, isNoTrump: this.room.gameRound.isNoTrump };
        }
    }

    continueDrawBottom() {
        this.askNextPlayerDrawBottom();
    }

    finishDrawBottom() {
        this.room.drawBottomState.isActive = false;

        if (this.room.drawBottomState.drawTimeout) {
            clearTimeout(this.room.drawBottomState.drawTimeout);
            this.room.drawBottomState.drawTimeout = null;
        }

        DrawBottomLog.info('抄底环节结束', {
            roomCode: this.room.roomCode,
            hasDrawer: this.room.drawBottomState.hasDrawer,
            trumpSuit: this.room.gameRound.trumpSuit,
            isNoTrump: this.room.gameRound.isNoTrump,
            lastDrawType: this.room.drawBottomState.lastDrawType
        });

        this.room.io.to(this.room.roomCode).emit('game:draw_bottom_complete', {
            finalMainSuit: this.room.gameRound.trumpSuit,
            isNoTrump: this.room.gameRound.isNoTrump,
            hasDrawer: this.room.drawBottomState.hasDrawer
        });

        this.room.phase = 'playing';
        this.room.turnIndex = 1;
        this.room.turnSeat = this.room.gameRound.bankerSeatIndex;
        this.room.turnCards = new Map();
        this.room.leadPlayCardCount = 0;

        this.room.io.to(this.room.roomCode).emit('game:playing_start', {
            bankerSeat: this.room.gameRound.bankerSeatIndex,
            bankerTeam: this.room.gameRound.bankerTeam,
            trumpSuit: this.room.gameRound.trumpSuit,
            isNoTrump: this.room.gameRound.isNoTrump,
            level: this.room.currentLevel,
            currentTurn: this.room.turnIndex
        });

        this.room.playManager.notifyPlay();
    }

    handleSkipDrawBottom(userId) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player || player.seatIndex !== this.room.drawBottomState.currentAskerSeat) {
            DrawBottomLog.warn('非当前操作玩家', {
                roomCode: this.room.roomCode,
                seatIndex: player?.seatIndex
            });
            return { success: false, message: '当前不是您的操作回合' };
        }

        if (this.room.drawBottomState.drawTimeout) {
            clearTimeout(this.room.drawBottomState.drawTimeout);
            this.room.drawBottomState.drawTimeout = null;
        }

        DrawBottomLog.info('玩家放弃抄底', {
            roomCode: this.room.roomCode,
            seatIndex: player.seatIndex
        });

        this.room.io.to(this.room.roomCode).emit('game:draw_bottom_skipped', {
            seatIndex: player.seatIndex
        });

        this.room.drawBottomState.abandonedPlayers.push(this.room.drawBottomState.currentAskerSeat);
        this.askNextPlayerDrawBottom();

        return { success: true };
    }

    async handleBuryBottom(userId, buryCards) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player || player.seatIndex !== this.room.turnSeat) {
            DrawBottomLog.warn('非当前操作玩家', {
                roomCode: this.room.roomCode,
                seatIndex: player?.seatIndex
            });
            return { success: false, message: '当前不是您的操作回合' };
        }

        if (buryCards.length !== 8) {
            DrawBottomLog.warn('埋牌数量错误', {
                roomCode: this.room.roomCode,
                seatIndex: player.seatIndex,
                buryCount: buryCards.length
            });
            return { success: false, message: '必须埋8张底牌' };
        }

        DrawBottomLog.info('玩家埋底', {
            roomCode: this.room.roomCode,
            seatIndex: player.seatIndex,
            buryCount: buryCards.length,
            remainingCards: player.handCards.length
        });

        const buryCountMap = {};
        for (const card of buryCards) {
            buryCountMap[card] = (buryCountMap[card] || 0) + 1;
        }

        player.handCards = player.handCards.filter(c => {
            const str = this.room.cardToString(c);
            if (buryCountMap[str] > 0) {
                buryCountMap[str]--;
                return false;
            }
            return true;
        });

        this.room.gameRound.bottomCards = buryCards;
        this.room.gameRound.bankerBuriedBottom = true;
        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:bottom_buried', {
            seatIndex: this.room.turnSeat,
            buryCount: 8,
            remainingCards: this.room.gameRound.bottomCards.length
        });

        this.room.io.to(player.socketId).emit('game:hand_updated', {
            handCards: player.handCards.map(c => this.room.cardToString(c)),
            seatIndex: player.seatIndex
        });

        if (this.room.drawBottomState.isWaitingBury) {
            this.room.drawBottomState.isWaitingBury = false;
            this.continueDrawBottom();
        } else {
            this.startDrawBottom();
        }

        return { success: true };
    }
}

module.exports = BottomManager;
