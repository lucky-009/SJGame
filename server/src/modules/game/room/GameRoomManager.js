/**
 * 游戏房间管理器 - 对外导出
 */

const GameRoom = require('./GameRoom');

class GameRoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
    }

    async createRoom(roomId, roomCode) {
        const gameRoom = new GameRoom(roomId, roomCode, this.io);
        this.rooms.set(roomCode, gameRoom);
        return gameRoom;
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    removeRoom(roomCode) {
        this.rooms.delete(roomCode);
    }
}

module.exports = GameRoomManager;
