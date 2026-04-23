/**
 * 结算管理器 - 处理回合结算、抠底结算、单局结算
 */

const Room = require('../../../models/Room');
const RoundScore = require('../../../models/RoundScore');
const { getScoreValue } = require('../../../common/CardUtils');
const { comparePlays, getBottomMultiplier } = require('../../../common/RuleEngine');
const { PLAY_TYPE_ORDER, GAME_PHASES } = require('./constants');

class SettleManager {
    constructor(room) {
        this.room = room;
    }

    async settleTurn() {
        const entries = Array.from(this.room.turnCards.entries());

        console.log('========== 回合结算 ==========');
        console.log('出牌顺序:', entries.map(([seat, data]) => `${seat}号位(${data.playType}): ${data.cards.map(c => c.suit + c.rank).join(',')}`));

        const leadCards = entries[0][1].cards;
        const trumpSuit = this.room.gameRound.trumpSuit;
        const isNoTrump = this.room.gameRound.isNoTrump;
        const currentLevel = this.room.currentLevel;

        let maxSeat = -1;
        let maxCards = null;
        let maxPlayType = null;
        let winnerTeam = '';

        for (const [seat, data] of entries) {
            const turnCards = data.cards;
            const playType = data.playType;

            let isWin = false;

            if (maxCards === null) {
                isWin = true;
                console.log(`  座位${seat}: 首家，直接获胜`);
            } else {
                const currentTypeOrder = PLAY_TYPE_ORDER[playType] || 2;
                const maxTypeOrder = PLAY_TYPE_ORDER[maxPlayType] || 2;

                if (currentTypeOrder > maxTypeOrder) {
                    isWin = true;
                    console.log(`  座位${seat}: ${playType}(${currentTypeOrder}) > ${maxPlayType}(${maxTypeOrder})，获胜`);
                } else if (currentTypeOrder === maxTypeOrder) {
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
                        console.log(`  座位${seat}: 贴/毙/跟类型相同，牌型比座位${maxSeat}小，失败`);
                    } else if (result < 0) {
                        isWin = true;
                        console.log(`  座位${seat}: 贴/毙/跟类型相同，牌型比座位${maxSeat}大，获胜`);
                    } else {
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

            if (isWin) {
                maxSeat = seat;
                maxCards = turnCards;
                maxPlayType = playType;
                const winner = this.room.playerManager.getPlayerBySeat(seat);
                winnerTeam = winner.team;
            }
        }

        let roundScore = 0;
        for (const [, data] of entries) {
            for (const card of data.cards) {
                roundScore += getScoreValue(card);
            }
        }

        if (winnerTeam !== this.room.gameRound.bankerTeam) {
            if (winnerTeam === 'A') {
                this.room.teamAScore += roundScore;
            } else {
                this.room.teamBScore += roundScore;
            }
        }
        console.log(`最终获胜: 座位${maxSeat} (${maxPlayType}), 队伍: ${winnerTeam}, 分值: ${roundScore}`);
        console.log(`A队得分: ${this.room.teamAScore}, B队得分: ${this.room.teamBScore}`);
        console.log('========== 回合结算结束 ==========');

        const isLastTurn = this.room.playerManager.isAllHandsEmpty();
        console.log('--是否是最后一轮', isLastTurn);

        await RoundScore.create({
            roundId: this.room.gameRound._id,
            turnIndex: this.room.turnIndex,
            winnerSeat: maxSeat,
            winnerTeam,
            baseScore: roundScore,
            teamAScore: this.room.teamAScore,
            teamBScore: this.room.teamBScore
        });

        this.room.io.to(this.room.roomCode).emit('game:turn_result', {
            turnIndex: this.room.turnIndex,
            winnerSeat: maxSeat,
            winnerTeam,
            score: roundScore,
            teamAScore: this.room.teamAScore,
            teamBScore: this.room.teamBScore,
            isLastTurn
        });

        if (isLastTurn) {
            await this.settleBottom(maxSeat, winnerTeam, maxCards);
            await this.settleRound();
        } else {
            this.room.turnIndex++;
            this.room.turnSeat = maxSeat;
            this.room.turnCards = new Map();
            this.room.leadPlayCardCount = 0;
            this.room.playManager.notifyPlay();
        }
    }

    async settleBottom(winnerSeat, winnerTeam, winningCards) {
        const bankerTeam = this.room.gameRound.bankerTeam;
        const bottomCards = this.room.gameRound.bottomCards.map(c => this.room.stringToCard(c));

        let bottomScore = 0;
        for (const card of bottomCards) {
            bottomScore += getScoreValue(card);
        }

        let bottomResult = null;

        if (winnerTeam !== bankerTeam) {
            const multiplier = getBottomMultiplier(
                winningCards,
                this.room.gameRound.trumpSuit,
                this.room.gameRound.isNoTrump,
                this.room.currentLevel
            );

            const drawScore = bottomScore * multiplier;

            if (winnerTeam === 'A') {
                this.room.teamAScore += drawScore;
            } else {
                this.room.teamBScore += drawScore;
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
            console.log(`A队: ${this.room.teamAScore}, B队: ${this.room.teamBScore}`);
            console.log(`====================`);
        }

        this.room.io.to(this.room.roomCode).emit('game:bottom_reveal', {
            bottomCards: this.room.gameRound.bottomCards,
            winnerSeat,
            winnerTeam,
            bottomResult,
            teamAScore: this.room.teamAScore,
            teamBScore: this.room.teamBScore
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        return bottomResult;
    }

    calculateNewLevel(currentLevel, levelChange, canSkipSpecialLevel = false) {
        const specialLevels = [2, 11, 14];
        let newLevel = Math.min(14, currentLevel + levelChange);

        if (!canSkipSpecialLevel) {
            for (let level = currentLevel; level <= newLevel; level++) {
                if (specialLevels.includes(level)) {
                    return level;
                }
            }
        }
        return newLevel;
    }

    calculateNewLevelEx(currentLevel, levelChange, canSkip2 = false, canSkipJ = false) {
        let newLevel = Math.min(14, currentLevel + levelChange);

        for (let level = currentLevel; level <= newLevel; level++) {
            if (level === 2 && !canSkip2) {
                return 2;
            }
            if (level === 11 && !canSkipJ) {
                return 11;
            }
            if (level === 14) {
                return 14;
            }
        }
        return newLevel;
    }

    async settleRound() {
        const bankerTeam = this.room.gameRound.bankerTeam;
        const opponentTeam = bankerTeam === 'A' ? 'B' : 'A';
        const opponentScore = bankerTeam === 'A' ? this.room.teamBScore : this.room.teamAScore;

        let levelChange = 0;
        let winner = '';

        if (opponentScore >= 80) {
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

        const room = await Room.findById(this.room.roomId);

        if (winner === opponentTeam) {
            if (opponentTeam === 'A') {
                room.levelA = this.calculateNewLevel(room.levelA, levelChange, false);
            } else {
                room.levelB = this.calculateNewLevel(room.levelB, levelChange, false);
            }
        } else {
            const currentLevel = bankerTeam === 'A' ? room.levelA : room.levelB;
            let canSkip2 = false;
            let canSkipJ = false;

            if (bankerTeam === 'A') {
                if (currentLevel === 2) {
                    room.levelA_defended_2 = true;
                    canSkip2 = true;
                } else if (currentLevel === 11) {
                    room.levelA_defended_J = true;
                    canSkipJ = true;
                } else {
                    canSkip2 = room.levelA_defended_2;
                    canSkipJ = room.levelA_defended_J;
                }
                room.levelA = this.calculateNewLevelEx(room.levelA, levelChange, canSkip2, canSkipJ);
            } else {
                if (currentLevel === 2) {
                    room.levelB_defended_2 = true;
                    canSkip2 = true;
                } else if (currentLevel === 11) {
                    room.levelB_defended_J = true;
                    canSkipJ = true;
                } else {
                    canSkip2 = room.levelB_defended_2;
                    canSkipJ = room.levelB_defended_J;
                }
                room.levelB = this.calculateNewLevelEx(room.levelB, levelChange, canSkip2, canSkipJ);
            }
        }

        let gameWinner = null;
        if (room.levelA === 14 && bankerTeam === 'A' && winner === 'A') {
            gameWinner = 'A';
        } else if (room.levelB === 14 && bankerTeam === 'B' && winner === 'B') {
            gameWinner = 'B';
        }

        await room.save();

        const isBankerWin = winner === bankerTeam;
        const nextBankerSeat = isBankerWin
            ? (this.room.gameRound.bankerSeatIndex + 2) % 4
            : (this.room.gameRound.bankerSeatIndex + 1) % 4;
        const nextBankerPlayer = this.room.playerManager.getPlayerBySeat(nextBankerSeat);
        const nextBankerTeam = nextBankerPlayer?.team || 'A';
        const nextLevel = winner === bankerTeam
            ? (bankerTeam === 'A' ? room.levelA : room.levelB)
            : (opponentTeam === 'A' ? room.levelA : room.levelB);

        this.room.gameRound.nextBankerSeat = nextBankerSeat;
        this.room.gameRound.nextBankerTeam = nextBankerTeam;
        await this.room.gameRound.save();

        this.room.io.to(this.room.roomCode).emit('game:round_result', {
            winner,
            bankerTeam,
            opponentScore,
            levelChange,
            newLevelA: room.levelA,
            newLevelB: room.levelB,
            teamAScore: this.room.teamAScore,
            teamBScore: this.room.teamBScore,
            gameWinner
        });

        if (gameWinner) {
            this.room.io.to(this.room.roomCode).emit('game:game_over', {
                winner: gameWinner
            });
            this.room.phase = GAME_PHASES.FINISHED;
        } else {
            this.room.io.to(this.room.roomCode).emit('game:round_starting', {
                nextRoundIndex: this.room.gameRound.roundIndex + 1,
                bankerSeat: nextBankerSeat,
                bankerTeam: nextBankerTeam,
                bankerName: nextBankerPlayer?.username || '',
                level: nextLevel
            });

            setTimeout(() => this.startNextRound(), 3000);
        }
    }

    async startNextRound() {
        this.room.isFirstRound = false;

        const room = await Room.findById(this.room.roomId);
        const newBankerSeat = this.room.gameRound.nextBankerSeat;
        const newBankerTeam = this.room.gameRound.nextBankerTeam;
        this.room.currentLevel = newBankerTeam === 'A' ? room.levelA : room.levelB;

        const { generateDeck, shuffleDeck, cardToString } = this.room.CardUtils;
        this.room.deck = shuffleDeck(generateDeck());
        const bottomCards = this.room.deck.slice(100);

        const prevRound = this.room.gameRound;

        const round = new this.room.GameRound({
            roomId: this.room.roomId,
            roundIndex: prevRound.roundIndex + 1,
            level: this.room.currentLevel,
            bankerTeam: newBankerTeam,
            bankerSeatIndex: newBankerSeat,
            trumpSuit: null,
            isNoTrump: null,
            phase: GAME_PHASES.DEALING,
            status: 'active',
            bottomCards: bottomCards.map(c => cardToString(c))
        });

        await round.save();

        this.room.playerManager.clearAllHands();

        this.room.dealingManager.initDealingState(true);
        this.room.bottomManager.initDrawBottomState();

        this.room.dealingState.bidState.hasBanker = true;
        this.room.dealingState.bidState.bankerSeat = newBankerSeat;
        this.room.dealingState.responded.bankerCall = true;

        this.room.gameRound = round;
        this.room.phase = GAME_PHASES.DEALING;
        this.room.turnIndex = 1;
        this.room.turnSeat = newBankerSeat;
        this.room.teamAScore = 0;
        this.room.teamBScore = 0;

        this.room.io.to(this.room.roomCode).emit('game:deal_start', {
            totalCards: 100,
            isFirstRound: false,
            level: this.room.currentLevel,
            bankerSeat: newBankerSeat,
            bankerTeam: newBankerTeam,
            roundIndex: round.roundIndex
        });

        this.room.dealingManager.startDealingInterval();
    }
}

module.exports = SettleManager;
