/**
 * 房间状态 Slice
 * 管理房间信息和玩家列表
 */

import { createSlice } from '@reduxjs/toolkit';
import { ROOM_STATUS } from '../utils/constants';

const initialState = {
  roomId: '',
  roomCode: '',
  players: [],        // { id, name, seatIndex, isReady, isOwner, team }
  isHost: false,      // 是否房主
  status: ROOM_STATUS.WAITING,
  mySeatIndex: 0      // 自己的座位索引
};

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    /**
     * 设置房间信息
     */
    setRoom: (state, action) => {
      const { roomId, roomCode, players, isHost, status, mySeatIndex } = action.payload;
      state.roomId = roomId;
      state.roomCode = roomCode;
      state.players = players;
      state.isHost = isHost;
      state.status = status;
      state.mySeatIndex = mySeatIndex;
    },
    
    /**
     * 更新房间玩家列表
     */
    updatePlayers: (state, action) => {
      state.players = action.payload;
    },
    
    /**
     * 更新单个玩家状态
     */
    updatePlayer: (state, action) => {
      const { playerId, seatIndex, updates } = action.payload;
      const player = state.players.find(p => 
        (playerId && p.id === playerId) || 
        (seatIndex !== undefined && p.seatIndex === seatIndex)
      );
      if (player) {
        Object.assign(player, updates);
      }
    },
    
    /**
     * 设置玩家准备状态
     */
    setPlayerReady: (state, action) => {
      const { playerId, isReady } = action.payload;
      console.log('setPlayerReady:', playerId, isReady, 'players:', state.players);
      const player = state.players.find(p => p.userId === playerId || p.id === playerId);
      if (player) {
        player.isReady = isReady;
      }
},

    /**
     * 标记玩家离线
     */
    setPlayerDisconnected: (state, action) => {
      const { playerId, isDisconnected } = action.payload;
      const player = state.players.find(p => p.userId === playerId || p.id === playerId);
      if (player) {
        player.isDisconnected = isDisconnected;
      }
    },
    
    /**
     * 设置房主身份
     */
    setHost: (state, action) => {
      state.isHost = action.payload;
    },

    /**
     * 设置房间状态
     */
    setRoomStatus: (state, action) => {
      state.status = action.payload;
    },

    /**
     * 清除房间信息
     */
    clearRoom: (state) => {
      state.roomId = '';
      state.roomCode = '';
      state.players = [];
      state.isHost = false;
      state.status = ROOM_STATUS.WAITING;
      state.mySeatIndex = 0;
    },
    
    /**
     * 添加玩家到房间
     */
    addPlayer: (state, action) => {
      const player = action.payload;
      if (!state.players.find(p => p.id === player.id)) {
        state.players.push(player);
      }
    },
    
    /**
     * 移除玩家
     */
    removePlayer: (state, action) => {
      state.players = state.players.filter(p => p.id !== action.payload);
    },
    
    /**
     * 更新自己的座位索引
     */
    setMySeatIndex: (state, action) => {
      state.mySeatIndex = action.payload;
    }
  }
});

export const {
  setRoom,
  updatePlayers,
  updatePlayer,
  setPlayerReady,
  setPlayerDisconnected,
  setRoomStatus,
  setHost,
  clearRoom,
  addPlayer,
  removePlayer,
  setMySeatIndex
} = roomSlice.actions;

export default roomSlice.reducer;
