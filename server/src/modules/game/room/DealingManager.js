/**
 * 发牌管理器 - 处理发牌动画、重新发牌逻辑
 */

const {getLevelRank} = require('../../../common/CardUtils');
const PlayerCard = require('../../../models/PlayerCard');
const {GAME_PHASES} = require('./constants');

class DealingManager {
    constructor(room) {
        this.room = room;
        this.redealCount = 0;
    }

    async startGame(levelA = 2, levelB = 2) {
        this.room.currentLevel = 2;
        this.room.teamAScore = 0;
        this.room.teamBScore = 0;
        this.room.isFirstRound = true;

        this.initDealingState();

        const {generateDeck, shuffleDeck, cardToString} = this.room.CardUtils;
        this.room.deck = shuffleDeck(generateDeck());

        const bottomCards = this.room.deck.slice(100);
        console.log('--初始底牌是：', bottomCards)

        const round = new this.room.GameRound({
            roomId: this.room.roomId,
            roundIndex: 1,
            level: 2,
            phase: GAME_PHASES.DEALING,
            status: 'active',
            bottomCards: bottomCards.map(c => cardToString(c))
        });

        await round.save();
        this.room.gameRound = round;

        this.room.playerManager.clearAllHands();
        this.room.phase = GAME_PHASES.DEALING;
        this.room.turnIndex = 1;

        this.room.io.to(this.room.roomCode).emit('game:deal_start', {
            totalCards: 100,
            isFirstRound: this.room.isFirstRound,
            level: this.room.currentLevel
        });

        this.startDealingInterval();
    }

    initDealingState(preserveBankerInfo = false) {
        let savedBidState = null;

        if (preserveBankerInfo && this.room.dealingState?.bidState?.hasBanker) {
            savedBidState = {
                hasBanker: this.room.dealingState.bidState.hasBanker,
                bankerSeat: this.room.dealingState.bidState.bankerSeat,
            };
        }

        this.room.dealingState = {
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
                hasBanker: savedBidState?.hasBanker ?? false,
                bankerSeat: savedBidState?.bankerSeat ?? -1,
                bankerSuit: null,
                hasTrump: false,
                trumpSuit: null,
                trumpCallerSuit: null,
                isLocked: false
            }
        };
    }

    startDealingInterval() {
        this.room.dealingState.dealInterval = setInterval(() => {
            this.dealOneCard();
        }, 125);
    }

    dealOneCard() {
        if (this.room.dealingState.cardIndex >= 100) {
            clearInterval(this.room.dealingState.dealInterval);
            this.room.dealingState.isDealing = false;
            this.onDealingComplete();
            return;
        }

        const card = this.room.deck[this.room.dealingState.cardIndex];
        const playerIndex = this.room.dealingState.currentPlayer;
        const player = this.room.playerManager.getPlayerBySeat(playerIndex);

        if (player) {
            player.handCards.push(card);
            const {cardToString} = this.room.CardUtils;

            this.room.io.to(this.room.roomCode).emit('game:card_dealt', {
                seatIndex: playerIndex,
                cardCount: player.handCards.length,
                cardIndex: this.room.dealingState.cardIndex + 1,
                totalCards: 100
            });

            if (player.socketId) {
                this.room.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => cardToString(c)),
                    seatIndex: playerIndex
                });
            }

            this.room.bidManager.checkDealingEvents(player, card);
        }

        this.room.dealingState.cardIndex++;
        this.room.dealingState.currentPlayer = (this.room.dealingState.currentPlayer + 1) % 4;
    }

    async onDealingComplete() {
        const {needsRedeal, lowScorePlayers} = this.checkPlayerHandScores();

        if (needsRedeal) {
            console.log(`检测到玩家手牌总分不足，需要重新发牌:`, lowScorePlayers);
            await this.handleRedeal(lowScorePlayers);
            return;
        }

        await this.savePlayerCards();

        this.room.phase = GAME_PHASES.DEALEND;

        this.room.io.to(this.room.roomCode).emit('game:deal_complete', {
            players: this.room.playerManager.getAllPlayers().map(p => ({
                seatIndex: p.seatIndex,
                cardCount: p.handCards.length,
                name: p.username,
                userId: p.userId
            })),
            isFirstRound: this.room.isFirstRound
        });

        for (const player of this.room.playerManager.getAllPlayers()) {
            if (player.socketId) {
                this.room.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => this.room.cardToString(c)),
                    seatIndex: player.seatIndex
                });
            }
        }

        this.room.bidManager.broadcastBidState();
        const {bidState} = this.room.dealingState;
        if (bidState.isLocked) {
            this.room.bottomManager.notifyTakeBottom();
        } else if (bidState.hasBanker && bidState.hasTrump) {
            this.room.bidManager.notifyWaitForOperation();
            this.room.bidManager.startBidTimeout(10000);
        } else {
            console.log(`检测到，缺庄/缺主,有庄=${bidState.hasBanker},有主=${bidState.hasTrump}`)
        }
    }

    async savePlayerCards() {
        for (let i = 0; i < 4; i++) {
            const player = this.room.playerManager.getPlayerBySeat(i);
            if (player) {
                await PlayerCard.create({
                    roundId: this.room.gameRound._id,
                    userId: player.userId,
                    seatIndex: i,
                    cards: player.handCards.map(c => this.room.cardToString(c))
                });
            }
        }
    }

    checkPlayerHandScores() {
        const lowScorePlayers = [];
        const {getScoreValue} = this.room.CardUtils;

        for (const player of this.room.playerManager.getAllPlayers()) {
            const totalScore = this.calculateHandScore(player.handCards, getScoreValue);
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

        return {needsRedeal: lowScorePlayers.length > 0, lowScorePlayers};
    }

    calculateHandScore(handCards, getScoreValue) {
        return handCards.reduce((total, card) => total + getScoreValue(card), 0);
    }

    async handleRedeal(lowScorePlayers) {
        this.room.io.to(this.room.roomCode).emit('game:redeal_triggered', {
            reason: '玩家手牌总分不足',
            lowScorePlayers: lowScorePlayers.map(p => ({
                seatIndex: p.seatIndex,
                username: p.username,
                score: p.score
            }))
        });

        this.room.playerManager.clearAllHands();

        const {generateDeck, shuffleDeck} = this.room.CardUtils;
        this.room.deck = shuffleDeck(generateDeck());

        await this.redealCards();
    }

    async redealCards() {
        this.initDealingState(!this.room.isFirstRound);

        const bottomCards = this.room.deck.slice(100);
        this.room.gameRound.bottomCards = bottomCards.map(c => this.room.cardToString(c));

        this.room.gameRound.phase = GAME_PHASES.DEALING;
        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:redeal_start', {
            message: '重新发牌',
            totalCards: 100,
            isFirstRound: this.room.isFirstRound
        });

        this.startDealingInterval();
    }

    redealOneCard() {
        if (this.room.dealingState.cardIndex >= 100) {
            clearInterval(this.room.dealingState.dealInterval);
            this.room.dealingState.isDealing = false;
            this.onRedealingComplete();
            return;
        }

        const card = this.room.deck[this.room.dealingState.cardIndex];
        const playerIndex = this.room.dealingState.currentPlayer;
        const player = this.room.playerManager.getPlayerBySeat(playerIndex);

        if (player) {
            player.handCards.push(card);

            this.room.io.to(this.room.roomCode).emit('game:card_dealt', {
                seatIndex: playerIndex,
                cardCount: player.handCards.length,
                cardIndex: this.room.dealingState.cardIndex + 1,
                totalCards: 100
            });

            if (player.socketId) {
                this.room.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => this.room.cardToString(c)),
                    seatIndex: playerIndex
                });
            }
        }

        this.room.dealingState.cardIndex++;
        this.room.dealingState.currentPlayer = (this.room.dealingState.currentPlayer + 1) % 4;
    }

    async onRedealingComplete() {
        console.log('重新发牌完成');

        await this.savePlayerCards();

        const {needsRedeal, lowScorePlayers} = this.checkPlayerHandScores();

        if (needsRedeal) {
            this.redealCount = (this.redealCount || 0) + 1;

            if (this.redealCount < 3) {
                console.log(`第${this.redealCount}次重新发牌`);
                await this.handleRedeal(lowScorePlayers);
                return;
            } else {
                this.room.io.to(this.room.roomCode).emit('game:redeal_failed', {
                    message: '多次重新发牌后仍不满足条件，强制开始游戏',
                    lowScorePlayers: lowScorePlayers.map(p => ({
                        seatIndex: p.seatIndex,
                        username: p.username,
                        score: p.score
                    }))
                });
            }
        }

        this.redealCount = 0;
        this.room.phase = GAME_PHASES.DEALING;

        this.room.io.to(this.room.roomCode).emit('game:redeal_complete', {
            message: '重新发牌完成'
        });

        for (const player of this.room.playerManager.getAllPlayers()) {
            if (player.socketId) {
                this.room.io.to(player.socketId).emit('game:hand_updated', {
                    handCards: player.handCards.map(c => this.room.cardToString(c)),
                    seatIndex: player.seatIndex
                });
            }
        }

        this.room.bidManager.broadcastBidState();
        this.room.bidManager.recheckDealingEvents();
        const {bidState} = this.room.dealingState;
        if (bidState.isLocked) {
            this.room.bottomManager.notifyTakeBottom();
        } else if (bidState.hasBanker && bidState.hasTrump) {
            this.room.bidManager.notifyWaitForOperation();
            this.room.bidManager.startBidTimeout(10000);
        } else {
            console.log(`检测到，缺庄/缺主,有庄=${bidState.hasBanker},有主=${bidState.hasTrump}`)
        }
    }
}

module.exports = DealingManager;
