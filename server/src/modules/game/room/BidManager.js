/**
 * 投标管理器 - 处理抢庄/锁庄/反庄、抢主/锁主/反主
 */

const {getLevelRank} = require('../../../common/CardUtils');
const {TRUMP_PRIORITY_ORDER} = require('./constants');

class BidManager {
    constructor(room) {
        this.room = room;
    }

    checkDealingEvents(player, card) {
        const {bidState, responded} = this.room.dealingState;
        const levelRank = getLevelRank(this.room.currentLevel);
        const {cardToString} = this.room.CardUtils;

        if (this.room.isFirstRound && !bidState.hasBanker) {
            if (card.rank === '2') {
                const sameSuit2s = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                if (sameSuit2s.length >= 2) {
                    const availableCards = sameSuit2s.map(c => cardToString(c));
                    this.room.io.to(player.socketId).emit('game:can_lock_banker', {
                        seatIndex: player.seatIndex,
                        availableCards
                    });
                } else {
                    const availableCards = player.handCards
                        .filter(c => c.rank === '2')
                        .map(c => cardToString(c));
                    this.room.io.to(player.socketId).emit('game:can_call_banker', {
                        seatIndex: player.seatIndex,
                        level: this.room.currentLevel,
                        availableCards
                    });
                }
            }
        }

        if (this.room.isFirstRound && bidState.hasBanker && !bidState.isLocked) {
            const banker = this.room.playerManager.getPlayerBySeat(bidState.bankerSeat);
            if (card.rank === '2' && player.seatIndex === bidState.bankerSeat && !responded.bankerLock) {
                if (card.suit === bidState.bankerSuit) {
                    const sameSuit2s = player.handCards.filter(c => c.suit === bidState.bankerSuit && c.rank === '2');
                    if (sameSuit2s.length >= 2) {
                        const availableCards = sameSuit2s.map(c => cardToString(c));
                        this.room.io.to(player.socketId).emit('game:can_lock_banker', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    }
                }
            }
            if (card.rank === '2' && player.seatIndex !== bidState.bankerSeat && !responded.bankerReverse) {
                const sameSuitCards = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                if (sameSuitCards.length >= 2) {
                    this.room.io.to(player.socketId).emit('game:can_reverse_banker', {
                        seatIndex: player.seatIndex,
                        suit: card.suit,
                        card: cardToString(card)
                    });
                }
            }
        }

        if (!this.room.isFirstRound && !bidState.hasTrump) {
            if (card.rank === levelRank) {
                const sameSuitLevelCards = player.handCards.filter(c => c.suit === card.suit && c.rank === levelRank);
                if (sameSuitLevelCards.length >= 2) {
                    const availableCards = sameSuitLevelCards.map(c => cardToString(c));
                    this.room.io.to(player.socketId).emit('game:can_lock_trump', {
                        seatIndex: player.seatIndex,
                        availableCards
                    });
                } else {
                    const availableCards = player.handCards
                        .filter(c => c.rank === levelRank)
                        .map(c => cardToString(c));
                    this.room.io.to(player.socketId).emit('game:can_call_trump', {
                        seatIndex: player.seatIndex,
                        level: this.room.currentLevel,
                        availableCards
                    });
                }
            }
        }

        if (!this.room.isFirstRound && bidState.hasTrump && !bidState.isLocked) {
            if (card.rank === levelRank && player.seatIndex === bidState.bankerSeat && !responded.trumpLock) {
                if (card.suit === bidState.trumpCallerSuit) {
                    const sameSuitLevelCards = player.handCards.filter(c => c.suit === bidState.trumpCallerSuit && c.rank === levelRank);
                    if (sameSuitLevelCards.length >= 2) {
                        const availableCards = sameSuitLevelCards.map(c => cardToString(c));
                        this.room.io.to(player.socketId).emit('game:can_lock_trump', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    }
                }
            }
            if (player.seatIndex === bidState.bankerSeat && !responded.trumpReverse) {
                const pairs = this.findTrumpPairs(player.handCards);
                if (pairs.length > 0) {
                    const highestPair = pairs[0];
                    if (this.isHigherTrump(highestPair.rank, bidState.trumpSuit)) {
                        this.room.io.to(player.socketId).emit('game:can_reverse_trump', {
                            seatIndex: player.seatIndex,
                            availablePairs: pairs.map(p => cardToString(p.cards[0]))
                        });
                    }
                }
            }
        }
    }

    findTrumpPairs(handCards) {
        const pairs = [];

        const hearts5 = handCards.filter(c => c.suit === 'heart' && c.rank === '5');
        if (hearts5.length >= 2) {
            pairs.push({rank: '5', cards: hearts5.slice(0, 2), priority: 1});
        }

        const bigJokers = handCards.filter(c => c.rank === 'big');
        if (bigJokers.length >= 2) {
            pairs.push({rank: 'big', cards: bigJokers.slice(0, 2), priority: 2});
        }

        const smallJokers = handCards.filter(c => c.rank === 'small');
        if (smallJokers.length >= 2) {
            pairs.push({rank: 'small', cards: smallJokers.slice(0, 2), priority: 3});
        }

        return pairs.sort((a, b) => a.priority - b.priority);
    }

    isHigherTrump(rank, currentTrumpSuit) {
        const currentRank = currentTrumpSuit ? getLevelRank(this.room.currentLevel) : null;
        const currentIdx = currentRank ? TRUMP_PRIORITY_ORDER.indexOf(currentRank) : -1;
        const newIdx = TRUMP_PRIORITY_ORDER.indexOf(rank);
        return newIdx < currentIdx || currentIdx === -1;
    }

    broadcastBidState() {
        const {bidState} = this.room.dealingState;

        let trumpCallerSeat = -1;
        let mainSuit = bidState.trumpSuit;

        if (this.room.isFirstRound) {
            if (bidState.hasBanker) {
                trumpCallerSeat = bidState.bankerSeat;
            }
        } else {
            if (this.room.gameRound.trumpCall) {
                trumpCallerSeat = this.room.gameRound.trumpCall.seatIndex;
            }
        }

        if (this.room.gameRound.trumpCall && this.room.gameRound.trumpCall.isReversed) {
            mainSuit = this.room.gameRound.trumpCall.suit;
            if (this.room.gameRound.isNoTrump) {
                mainSuit = null;
            }
        }

        this.room.io.to(this.room.roomCode).emit('game:bid_state_changed', {
            hasBanker: bidState.hasBanker,
            bankerSeat: bidState.bankerSeat,
            hasTrump: bidState.hasTrump,
            trumpSuit: mainSuit,
            isLocked: bidState.isLocked,
            trumpCallerSeat
        });
    }

    canTakeBottom() {
        const {bidState} = this.room.dealingState;
        if (this.room.isFirstRound) {
            return bidState.hasBanker || bidState.isLocked;
        } else {
            return bidState.hasBanker && bidState.hasTrump;
        }
    }

    checkAndTriggerTakeBottom() {
        if (this.room.dealingState.isDealing) {
            return;
        }

        if (this.canTakeBottom()) {
            this.room.phase = 'bottoming';
            this.room.bottomManager.notifyTakeBottom();
        }
    }

    notifyWaitForOperation() {
        const {bidState} = this.room.dealingState;
        let waitType = [];

        if (this.room.isFirstRound) {
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

        this.room.io.to(this.room.roomCode).emit('game:wait_for_operation', {
            phase: this.room.phase,
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

    startBidTimeout(t = 10000) {
        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
        }
        this.room.bidTimeout = setTimeout(() => {
            this.checkBidTimeout();
        }, t);
    }

    checkBidTimeout() {
        if (this.room.phase !== 'dealEnd') {
            return;
        }
        const {bidState} = this.room.dealingState;

        this.room.io.to(this.room.roomCode).emit('game:bid_timeout', {
            bidState: {
                hasBanker: bidState.hasBanker,
                bankerSeat: bidState.bankerSeat,
                hasTrump: bidState.hasTrump,
                isLocked: bidState.isLocked
            }
        });

        if (bidState.hasBanker) {
            this.room.phase = 'bottoming';
            this.room.bottomManager.notifyTakeBottom();
        }
    }

    async handleCallBanker(userId, cardStr) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        if (this.room.dealingState.bidState.hasBanker) {
            return {success: false, message: '已有玩家抢庄', code: 'BID_REJECTED'};
        }

        const card = this.room.stringToCard(cardStr);
        if (card.rank !== '2') {
            return {success: false, message: '抢庄必须使用2'};
        }

        this.room.dealingState.responded.bankerCall = true;
        this.room.dealingState.bidState.hasBanker = true;
        this.room.dealingState.bidState.hasTrump = true;
        this.room.dealingState.bidState.bankerSeat = player.seatIndex;
        this.room.dealingState.bidState.trumpSuit = card.suit;
        this.room.dealingState.bidState.bankerSuit = card.suit;

        console.log('抢庄状态变更信息:', this.room.dealingState.bidState)

        this.room.gameRound.bankerCall = {
            caller: userId,
            card: cardStr,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };
        this.room.gameRound.bankerTeam = player.team;
        this.room.gameRound.bankerUserId = userId;
        this.room.gameRound.bankerSeatIndex = player.seatIndex;
        this.room.gameRound.trumpSuit = card.suit;
        this.room.gameRound.level = this.room.currentLevel;

        this.room.gameRound.trumpCall = {
            caller: userId,
            suit: card.suit,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };

        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:banker_called', {
            seatIndex: player.seatIndex,
            team: player.team,
            card: cardStr,
            suit: card.suit
        });

        this.broadcastBidState();
        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
            this.room.bidTimeout = null;
        }

        this.checkAndTriggerTakeBottom();
        return {success: true};
    }

    async handleLockBanker(userId, cardStr) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        if (this.room.dealingState.bidState.isLocked) {
            return {success: false, message: '庄/主已锁定', code: 'BID_REJECTED'};
        }

        if (this.room.dealingState.responded.bankerLock) {
            return {success: false, message: '已有玩家锁庄', code: 'BID_REJECTED'};
        }

        const card = this.room.stringToCard(cardStr);
        if (!card) {
            return {success: false, message: '无效的牌'};
        }

        this.room.dealingState.responded.bankerLock = true;
        this.room.dealingState.bidState.isLocked = true;

        if (!this.room.dealingState.bidState.hasBanker) {
            this.room.dealingState.bidState.hasBanker = true;
            this.room.dealingState.bidState.bankerSeat = player.seatIndex;
            this.room.dealingState.bidState.bankerSuit = card.suit;
            this.room.dealingState.bidState.trumpSuit = card.suit;

            this.room.gameRound.bankerCall = {
                caller: userId,
                card: cardStr,
                seatIndex: player.seatIndex,
                isLocked: true,
                isReversed: false
            };
            this.room.gameRound.bankerTeam = player.team;
            this.room.gameRound.bankerUserId = userId;
            this.room.gameRound.bankerSeatIndex = player.seatIndex;
            this.room.gameRound.trumpSuit = card.suit;
            this.room.gameRound.level = this.room.currentLevel;

            this.room.gameRound.trumpCall = {
                caller: userId,
                suit: card.suit,
                seatIndex: player.seatIndex,
                isLocked: true,
                isReversed: true
            };
        } else {
            this.room.gameRound.bankerCall.isLocked = true;
        }

        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:banker_locked', {
            seatIndex: player.seatIndex,
            card: cardStr
        });

        this.broadcastBidState();

        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
            this.room.bidTimeout = null;
        }

        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    async handleReverseBanker(userId, cardStr) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        if (this.room.dealingState.bidState.isLocked) {
            return {success: false, message: '庄/主已锁定', code: 'BID_REJECTED'};
        }

        if (this.room.dealingState.responded.bankerReverse) {
            return {success: false, message: '已有玩家反庄', code: 'BID_REJECTED'};
        }

        const card = this.room.stringToCard(cardStr);
        if (!card) {
            return {success: false, message: '无效的卡牌', code: 'INVALID_CARD'};
        }

        this.room.dealingState.responded.bankerReverse = true;
        this.room.dealingState.bidState.hasBanker = true;
        this.room.dealingState.bidState.bankerSeat = player.seatIndex;
        this.room.dealingState.bidState.bankerSuit = card.suit;
        this.room.dealingState.bidState.trumpSuit = card.suit;
        this.room.dealingState.bidState.isLocked = true;

        this.room.gameRound.bankerCall = {
            caller: userId,
            card: cardStr,
            seatIndex: player.seatIndex,
            isLocked: true,
            isReversed: true
        };
        this.room.gameRound.bankerTeam = player.team;
        this.room.gameRound.bankerUserId = userId;
        this.room.gameRound.bankerSeatIndex = player.seatIndex;
        this.room.gameRound.trumpSuit = card.suit;

        this.room.gameRound.trumpCall = {
            caller: userId,
            suit: card.suit,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };

        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:banker_reversed', {
            seatIndex: player.seatIndex,
            team: player.team,
            card: cardStr,
            suit: card.suit
        });

        this.broadcastBidState();

        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
            this.room.bidTimeout = null;
        }

        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    async handleCallTrump(userId, cardStr) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        if (this.room.dealingState.bidState.hasTrump) {
            return {success: false, message: '已有玩家抢主', code: 'BID_REJECTED'};
        }

        const card = this.room.stringToCard(cardStr);
        const levelRank = getLevelRank(this.room.currentLevel);

        if (card.rank !== levelRank) {
            return {success: false, message: `抢主必须使用${levelRank}`};
        }

        this.room.dealingState.responded.trumpCall = true;
        this.room.dealingState.bidState.hasTrump = true;
        this.room.dealingState.bidState.trumpSuit = card.suit;
        this.room.dealingState.bidState.trumpCallerSuit = card.suit;

        this.room.gameRound.trumpCall = {
            caller: userId,
            suit: card.suit,
            seatIndex: player.seatIndex,
            isLocked: false,
            isReversed: false
        };
        this.room.gameRound.trumpSuit = card.suit;
        this.room.gameRound.isNoTrump = false;
        this.room.gameRound.trumpCall.seatIndex = player.seatIndex;

        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:trump_called', {
            seatIndex: player.seatIndex,
            suit: card.suit
        });

        this.broadcastBidState();

        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
            this.room.bidTimeout = null;
        }

        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    async handleLockTrump(userId, cardStr) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        if (this.room.dealingState.bidState.isLocked) {
            return {success: false, message: '主已锁定', code: 'BID_REJECTED'};
        }

        if (this.room.dealingState.responded.trumpLock) {
            return {success: false, message: '已有玩家锁主', code: 'BID_REJECTED'};
        }

        const card = this.room.stringToCard(cardStr);

        this.room.dealingState.responded.trumpLock = true;
        this.room.dealingState.bidState.isLocked = true;

        if (!this.room.dealingState.bidState.hasTrump) {
            this.room.dealingState.bidState.hasTrump = true;
            this.room.dealingState.bidState.trumpSuit = card.suit;
            this.room.dealingState.bidState.trumpCallerSuit = card.suit;

            this.room.gameRound.trumpCall = {
                caller: userId,
                suit: card.suit,
                seatIndex: player.seatIndex,
                isLocked: true,
                isReversed: false
            };
            this.room.gameRound.trumpSuit = card.suit;
            this.room.gameRound.isNoTrump = false;
            this.room.gameRound.trumpCall.seatIndex = player.seatIndex;
        } else {
            this.room.gameRound.trumpCall.isLocked = true;
        }

        await this.room.gameRound.save();

        if (!this.room.dealingState.bidState.hasTrump) {
            this.room.io.to(this.room.roomCode).emit('game:trump_locked_direct', {
                seatIndex: player.seatIndex,
                card: cardStr
            });
        } else {
            this.room.io.to(this.room.roomCode).emit('game:trump_locked', {
                seatIndex: player.seatIndex,
                card: cardStr
            });
        }

        this.broadcastBidState();

        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
            this.room.bidTimeout = null;
        }

        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    async handleReverseTrump(userId, cardStr) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player) {
            return {success: false, message: '玩家不存在'};
        }

        if (this.room.dealingState.bidState.isLocked) {
            return {success: false, message: '主已锁定', code: 'BID_REJECTED'};
        }

        if (this.room.dealingState.responded.trumpReverse) {
            return {success: false, message: '已有玩家反主', code: 'BID_REJECTED'};
        }

        const card = this.room.stringToCard(cardStr);
        let newSuit = card.suit;
        let isNoTrump = false;

        if (card.rank === 'big') {
            isNoTrump = true;
        } else if (card.rank === 'small') {
            isNoTrump = true;
        } else if (card.rank === '5') {
            isNoTrump = true;
        }

        this.room.dealingState.responded.trumpReverse = true;
        this.room.dealingState.bidState.hasTrump = true;
        this.room.dealingState.bidState.trumpSuit = isNoTrump ? null : newSuit;
        this.room.dealingState.bidState.trumpCallerSuit = isNoTrump ? null : newSuit;
        this.room.dealingState.bidState.isLocked = true;

        this.room.gameRound.trumpCall = {
            caller: userId,
            suit: newSuit,
            seatIndex: player.seatIndex,
            isLocked: true,
            isReversed: true
        };
        this.room.gameRound.trumpSuit = newSuit;
        this.room.gameRound.isNoTrump = isNoTrump;

        this.room.gameRound.trumpCall.seatIndex = player.seatIndex;
        this.room.gameRound.trumpCall.suit = newSuit;
        this.room.gameRound.trumpCall.isReversed = true;

        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:trump_reversed', {
            seatIndex: player.seatIndex,
            suit: newSuit,
            isNoTrump
        });

        this.broadcastBidState();

        if (this.room.bidTimeout) {
            clearTimeout(this.room.bidTimeout);
            this.room.bidTimeout = null;
        }

        this.checkAndTriggerTakeBottom();

        return {success: true};
    }

    recheckDealingEvents() {
        const {bidState, responded} = this.room.dealingState;
        const levelRank = getLevelRank(this.room.currentLevel);

        for (const player of this.room.playerManager.getAllPlayers()) {
            if (this.room.isFirstRound) {
                if (!bidState.hasBanker) {
                    for (const card of player.handCards) {
                        if (card.rank === '2') {
                            const sameSuit2s = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                            if (sameSuit2s.length >= 2 && !responded.bankerLock) {
                                const availableCards = sameSuit2s.map(c => this.room.cardToString(c));
                                this.room.io.to(player.socketId).emit('game:can_lock_banker', {
                                    seatIndex: player.seatIndex,
                                    availableCards
                                });
                            } else if (!bidState.hasBanker) {
                                const availableCards = player.handCards
                                    .filter(c => c.rank === '2')
                                    .map(c => this.room.cardToString(c));
                                this.room.io.to(player.socketId).emit('game:can_call_banker', {
                                    seatIndex: player.seatIndex,
                                    level: this.room.currentLevel,
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
                        const availableCards = sameSuit2s.map(c => this.room.cardToString(c));
                        this.room.io.to(player.socketId).emit('game:can_lock_banker', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    } else if (player.seatIndex !== bidState.bankerSeat && !responded.bankerReverse) {
                        for (const card of player.handCards) {
                            if (card.rank === '2') {
                                const sameSuitCards = player.handCards.filter(c => c.suit === card.suit && c.rank === '2');
                                if (sameSuitCards.length >= 2) {
                                    this.room.io.to(player.socketId).emit('game:can_reverse_banker', {
                                        seatIndex: player.seatIndex,
                                        suit: card.suit,
                                        card: this.room.cardToString(card)
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
                                const availableCards = sameSuitLevelCards.map(c => this.room.cardToString(c));
                                this.room.io.to(player.socketId).emit('game:can_lock_trump', {
                                    seatIndex: player.seatIndex,
                                    availableCards
                                });
                            } else if (!bidState.hasTrump) {
                                const availableCards = player.handCards
                                    .filter(c => c.rank === levelRank)
                                    .map(c => this.room.cardToString(c));
                                this.room.io.to(player.socketId).emit('game:can_call_trump', {
                                    seatIndex: player.seatIndex,
                                    level: this.room.currentLevel,
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
                        const availableCards = sameSuitLevelCards.map(c => this.room.cardToString(c));
                        this.room.io.to(player.socketId).emit('game:can_lock_trump', {
                            seatIndex: player.seatIndex,
                            availableCards
                        });
                    } else if (player.seatIndex === bidState.bankerSeat && !responded.trumpReverse) {
                        const pairs = this.findTrumpPairs(player.handCards);
                        if (pairs.length > 0) {
                            const highestPair = pairs[0];
                            if (this.isHigherTrump(highestPair.rank, bidState.trumpSuit)) {
                                this.room.io.to(player.socketId).emit('game:can_reverse_trump', {
                                    seatIndex: player.seatIndex,
                                    availablePairs: pairs.map(p => this.room.cardToString(p.cards[0]))
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

module.exports = BidManager;
