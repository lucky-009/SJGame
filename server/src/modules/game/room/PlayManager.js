/**
 * 出牌管理器 - 处理出牌验证、回合流程
 */

const PlayRecord = require('../../../models/PlayRecord');
const { validatePlay, classifyPlayType, analyzePlayPattern } = require('../../../common/RuleEngine');

class PlayManager {
    constructor(room) {
        this.room = room;
    }

    notifyPlay() {
        const player = this.room.playerManager.getPlayerBySeat(this.room.turnSeat);
        if (!player) return;

        this.room.io.to(player.socketId).emit('game:your_turn', {
            action: 'play_cards',
            seatIndex: this.room.turnSeat,
            currentTurn: this.room.turnIndex,
            handCards: player.handCards.map(c => this.room.cardToString(c)),
            deskCards: Object.fromEntries(this.room.turnCards.entries()),
            trumpSuit: this.room.gameRound.trumpSuit,
            isNoTrump: this.room.gameRound.isNoTrump,
            level: this.room.currentLevel
        });
    }

    async handlePlayCards(userId, cardStrs) {
        const player = this.room.playerManager.getPlayer(userId);
        if (!player || player.seatIndex !== this.room.turnSeat) {
            return { success: false, message: '当前不是您的操作回合' };
        }

        const cards = cardStrs.map(c => this.room.stringToCard(c));
        const handStrs = player.handCards.map(c => this.room.cardToString(c));

        const handCountMap = {};
        for (const card of handStrs) {
            handCountMap[card] = (handCountMap[card] || 0) + 1;
        }

        for (const reqCard of cardStrs) {
            if (!handCountMap[reqCard] || handCountMap[reqCard] <= 0) {
                return {
                    success: false,
                    message: `手牌中 ${reqCard} 数量不足`
                };
            }
            handCountMap[reqCard] -= 1;
        }

        const isFirstPlay = this.room.turnCards.size === 0;

        if (!isFirstPlay && cardStrs.length !== this.room.leadPlayCardCount) {
            return {
                success: false,
                message: `出牌数量必须与首家相同（首家出了${this.room.leadPlayCardCount}张）`
            };
        }

        const validation = validatePlay(
            cards,
            player.handCards,
            isFirstPlay,
            this.room.gameRound.trumpSuit,
            this.room.gameRound.isNoTrump,
            this.room.currentLevel
        );

        if (!validation.isValid) {
            const { getScoreValue } = this.room.CardUtils;
            const pattern = analyzePlayPattern(cards, this.room.gameRound.trumpSuit, this.room.gameRound.isNoTrump, this.room.currentLevel);
            const maxSubCount = Math.max(...(pattern.leadPattern?.subPatterns?.map(sp => sp.weight) || [1]));
            const penalty = maxSubCount * 10;

            const penaltyTeam = player.team;
            if (penaltyTeam === 'A') {
                this.room.teamBScore += penalty;
            } else {
                this.room.teamAScore += penalty;
            }

            this.room.io.to(this.room.roomCode).emit('game:play_penalty', {
                seatIndex: this.room.turnSeat,
                penalty,
                reason: validation.reason
            });

            return { success: false, message: validation.reason, penalty };
        }

        if (isFirstPlay) {
            this.room.leadPlayCardCount = cardStrs.length;
        }

        const playCountMap = {};
        for (const card of cardStrs) {
            playCountMap[card] = (playCountMap[card] || 0) + 1;
        }
        player.handCards = player.handCards.filter(c => {
            const str = this.room.cardToString(c);
            if (playCountMap[str] > 0) {
                playCountMap[str]--;
                return false;
            }
            return true;
        });

        let playType = 'normal';
        if (!isFirstPlay) {
            const leadCards = this.room.turnCards.values().next().value.cards;

            const leadPattern = analyzePlayPattern(
                leadCards,
                this.room.gameRound.trumpSuit,
                this.room.gameRound.isNoTrump,
                this.room.currentLevel
            );
            playType = classifyPlayType(
                cards,
                leadPattern.leadSuit,
                leadPattern,
                this.room.gameRound.trumpSuit,
                this.room.gameRound.isNoTrump,
                this.room.currentLevel
            );
            console.log('--本轮玩家出牌类型', playType);
        }

        this.room.turnCards.set(this.room.turnSeat, { cards, playType });

        await PlayRecord.create({
            roundId: this.room.gameRound._id,
            turnIndex: this.room.turnIndex,
            seatIndex: this.room.turnSeat,
            userId: userId,
            cards: cardStrs,
            playType
        });

        this.room.io.to(this.room.roomCode).emit('game:card_played', {
            seatIndex: this.room.turnSeat,
            cards: cardStrs,
            playType,
            playerCardCounts: this.room.playerManager.getPlayerCardCounts(),
            leadPlayCardCount: this.room.leadPlayCardCount
        });

        this.room.io.to(player.socketId).emit('game:hand_updated', {
            handCards: player.handCards.map(c => this.room.cardToString(c)),
            seatIndex: player.seatIndex
        });

        if (this.room.turnCards.size === 4) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await this.room.settleManager.settleTurn();
        } else {
            this.room.turnSeat = (this.room.turnSeat + 1) % 4;
            this.notifyPlay();
        }

        return { success: true };
    }
}

module.exports = PlayManager;
