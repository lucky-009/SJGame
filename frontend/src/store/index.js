/**
 * Redux Store 配置
 */

import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import roomReducer from './roomSlice';
import gameReducer from './gameSlice';

const store = configureStore({
  reducer: {
    user: userReducer,
    room: roomReducer,
    game: gameReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略这些 action 中的非序列化数据
        ignoredActions: ['game/setMyHands', 'game/addCard', 'game/addDeskCard']
      }
    })
});

export default store;
