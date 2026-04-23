/**
 * 玩家管理器 - 处理玩家进出、准备状态、Socket管理
 */

class PlayerManager {
    constructor(room) {
        this.room = room;
    }

    addPlayer(userId, username, socketId, seatIndex, team, isOwner) {
        this.room.players.set(userId, {
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

    removePlayer(userId) {
        this.room.players.delete(userId);
    }

    setPlayerReady(userId, isReady) {
        const player = this.room.players.get(userId);
        if (player) {
            player.isReady = isReady;
        }
    }

    updateSocketId(userId, socketId) {
        const player = this.room.players.get(userId);
        if (player) {
            player.socketId = socketId;
        }
    }

    setDisconnected(userId, isDisconnected) {
        const player = this.room.players.get(userId);
        if (player) {
            player.isDisconnected = isDisconnected;
            player.disconnectedAt = isDisconnected ? Date.now() : null;
        }
    }

    reconnect(userId, newSocketId) {
        const player = this.room.players.get(userId);
        if (player && player.isDisconnected) {
            player.socketId = newSocketId;
            player.isDisconnected = false;
            player.disconnectedAt = null;
            return true;
        }
        return false;
    }

    isPlayerDisconnected(userId) {
        const player = this.room.players.get(userId);
        return player ? player.isDisconnected : false;
    }

    areAllPlayersReady() {
        if (this.room.players.size < 4) return false;
        return Array.from(this.room.players.values()).every(p => p.isReady);
    }

    getPlayer(userId) {
        return this.room.players.get(userId);
    }

    getPlayerBySeat(seatIndex) {
        return Array.from(this.room.players.values()).find(p => p.seatIndex === seatIndex);
    }

    getAllPlayers() {
        return Array.from(this.room.players.values());
    }

    getPlayersSortedBySeat() {
        return Array.from(this.room.players.values()).sort((a, b) => a.seatIndex - b.seatIndex);
    }

    clearAllHands() {
        for (const player of this.room.players.values()) {
            player.handCards = [];
        }
    }

    getPlayerCardCounts() {
        const counts = {};
        for (const player of this.room.players.values()) {
            counts[`seat${player.seatIndex}`] = player.handCards.length;
        }
        return counts;
    }

    isAllHandsEmpty() {
        return Array.from(this.room.players.values()).every(p => p.handCards.length === 0);
    }

    removeCardsFromPlayer(userId, cards) {
        const player = this.room.players.get(userId);
        if (!player) return false;

        const cardCountMap = {};
        for (const card of cards) {
            cardCountMap[card] = (cardCountMap[card] || 0) + 1;
        }

        player.handCards = player.handCards.filter(c => {
            const str = this.room.cardToString(c);
            if (cardCountMap[str] > 0) {
                cardCountMap[str]--;
                return false;
            }
            return true;
        });

        return true;
    }
}

module.exports = PlayerManager;
