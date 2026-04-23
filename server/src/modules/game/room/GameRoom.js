/**
 * 游戏房间 - 整合各Manager模块
 */

const {
    generateDeck, shuffleDeck, cardToString, stringToCard,
    isTrump, isSameSuit, getTrumpWeight, getScoreValue, getLevelRank
} = require('../../../common/CardUtils');

const GameRound = require('../../../models/GameRound');
const { GAME_PHASES } = require('./constants');

const PlayerManager = require('./PlayerManager');
const DealingManager = require('./DealingManager');
const BidManager = require('./BidManager');
const BottomManager = require('./BottomManager');
const PlayManager = require('./PlayManager');
const SettleManager = require('./SettleManager');

class GameRoom {
    constructor(roomId, roomCode, io) {
        this.roomId = roomId;
        this.roomCode = roomCode;
        this.io = io;
        this.players = new Map();
        this.gameRound = null;
        this.deck = [];
        this.currentLevel = 2;
        this.phase = GAME_PHASES.DEALING;
        this.turnIndex = 0;
        this.turnSeat = 0;
        this.turnCards = new Map();
        this.teamAScore = 0;
        this.teamBScore = 0;
        this.isFirstRound = true;
        this.leadPlayCardCount = 0;
        this.dealingState = {};
        this.drawBottomState = {};
        this.bidTimeout = null;
        this.redealCount = 0;

        this.CardUtils = { generateDeck, shuffleDeck, cardToString, stringToCard, isTrump, isSameSuit, getTrumpWeight, getScoreValue, getLevelRank };
        this.stringToCard = stringToCard;
        this.cardToString = cardToString;
        this.GameRound = GameRound;

        this.playerManager = new PlayerManager(this);
        this.bidManager = new BidManager(this);
        this.bottomManager = new BottomManager(this);
        this.playManager = new PlayManager(this);
        this.dealingManager = new DealingManager(this);
        this.settleManager = new SettleManager(this);
    }

    addPlayer(userId, username, socketId, seatIndex, team, isOwner) {
        this.playerManager.addPlayer(userId, username, socketId, seatIndex, team, isOwner);
    }

    removePlayer(userId) {
        this.playerManager.removePlayer(userId);
    }

    setPlayerReady(userId, isReady) {
        this.playerManager.setPlayerReady(userId, isReady);
    }

    updateSocketId(userId, socketId) {
        this.playerManager.updateSocketId(userId, socketId);
    }

    areAllPlayersReady() {
        return this.playerManager.areAllPlayersReady();
    }

    async startGame(levelA = 2, levelB = 2) {
        await this.dealingManager.startGame(levelA, levelB);
    }

    dealOneCard() {
        this.dealingManager.dealOneCard();
    }

    async handleCallBanker(userId, cardStr) {
        return await this.bidManager.handleCallBanker(userId, cardStr);
    }

    async handleLockBanker(userId, cardStr) {
        return await this.bidManager.handleLockBanker(userId, cardStr);
    }

    async handleReverseBanker(userId, cardStr) {
        return await this.bidManager.handleReverseBanker(userId, cardStr);
    }

    async handleCallTrump(userId, cardStr) {
        return await this.bidManager.handleCallTrump(userId, cardStr);
    }

    async handleLockTrump(userId, cardStr) {
        return await this.bidManager.handleLockTrump(userId, cardStr);
    }

    async handleReverseTrump(userId, cardStr) {
        return await this.bidManager.handleReverseTrump(userId, cardStr);
    }

    async handleTakeBottom(userId, data) {
        return await this.bottomManager.handleTakeBottom(userId, data);
    }

    handleSkipDrawBottom(userId) {
        return this.bottomManager.handleSkipDrawBottom(userId);
    }

    async handleBuryBottom(userId, buryCards) {
        return await this.bottomManager.handleBuryBottom(userId, buryCards);
    }

    async handlePlayCards(userId, cardStrs) {
        return await this.playManager.handlePlayCards(userId, cardStrs);
    }

    async startNextRound() {
        await this.settleManager.startNextRound();
    }
}

module.exports = GameRoom;
