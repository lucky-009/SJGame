/**
 * 用户状态 Slice
 * 管理用户登录信息
 */

import { createSlice } from '@reduxjs/toolkit';

// 从 sessionStorage 获取初始状态
const loadUserFromStorage = () => {
  try {
    const token = sessionStorage.getItem('token');
    const userId = sessionStorage.getItem('userId');
    const username = sessionStorage.getItem('username');
    
    if (token && userId) {
      return { id: userId, name: username, token };
    }
  } catch (e) {
    console.error('Failed to load user from storage:', e);
  }
  
  return { id: '', name: '', token: '' };
};

const initialState = {
  ...loadUserFromStorage(),
  isAuthenticated: !!sessionStorage.getItem('token')
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
/**
      * 设置用户登录信息
      */
    setUser: (state, action) => {
      const { id, name, token } = action.payload;
      state.id = id;
      state.name = name;
      state.token = token;
      state.isAuthenticated = true;
      
      // 存储到 sessionStorage
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('userId', id);
      sessionStorage.setItem('username', name);
    },
    
    /**
     * 清除用户信息（登出）
     */
    clearUser: (state) => {
      state.id = '';
      state.name = '';
      state.token = '';
      state.isAuthenticated = false;
      
      // 清除 sessionStorage
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('username');
    },
    
    /**
     * 更新用户名
     */
    updateUsername: (state, action) => {
      state.name = action.payload;
      sessionStorage.setItem('username', action.payload);
    }
  }
});

export const { setUser, clearUser, updateUsername } = userSlice.actions;
export default userSlice.reducer;
