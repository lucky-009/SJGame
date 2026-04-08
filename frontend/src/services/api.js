/**
 * API 服务
 * 处理 HTTP 请求
 * 对接后端 API (http://localhost:3000)
 */

import { API_BASE_URL } from '../utils/constants';

/**
 * 获取 token
 */
const getToken = () => sessionStorage.getItem('token');

/**
 * 通用请求方法
 */
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  
  const requestId = Date.now() + Math.random();
  const requestStartTime = Date.now();
  
  console.log(`🔍 [api request] 开始请求，请求ID: ${requestId}`);
  console.log(`🔍 [api request] URL: ${url}`);
  console.log(`🔍 [api request] 方法: ${options.method || 'GET'}`);
  console.log(`🔍 [api request] Token:`, token ? '已设置' : '未设置');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };
  
  try {
    console.log(`🔍 [api request] 发起 fetch 请求，请求ID: ${requestId}`);
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    console.log(`🔍 [api request] fetch 响应，请求ID: ${requestId}，状态: ${response.status}`);
    
    // 处理非 JSON 响应
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const textResponse = await response.text();
      console.log(`🔍 [api request] 非JSON响应，请求ID: ${requestId}，耗时: ${Date.now() - requestStartTime}ms`);
      return textResponse;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`🔍 [api request] 请求失败，请求ID: ${requestId}，状态: ${response.status}，数据:`, data);
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    
    console.log(`🔍 [api request] 请求成功，请求ID: ${requestId}，耗时: ${Date.now() - requestStartTime}ms`);
    console.log(`🔍 [api request] 响应数据:`, data);
    
    return data;
  } catch (error) {
    console.error(`🔍 [api request] 请求异常，请求ID: ${requestId}，耗时: ${Date.now() - requestStartTime}ms`, error);
    throw error;
  }
};

/**
 * 用户认证 API
 */

// 用户注册
// POST /api/auth/register
// 请求: { username, password, nickname? }
// 响应: { success, message, data: { user, token } }
export const register = (username, password, nickname) => {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, nickname })
  });
};

// 用户登录
// POST /api/auth/login
// 请求: { username, password }
// 响应: { success, message, data: { user, token } }
export const login = (username, password) => {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
};

// 获取用户信息
// GET /api/auth/info
// 响应: { success, data: { user } }
export const getUserInfo = () => {
  return request('/auth/info', {
    method: 'GET'
  });
};

// 用户退出登录
// POST /api/auth/logout
// 响应: { success, message }
export const logout = () => {
  return request('/auth/logout', {
    method: 'POST'
  });
};

/**
 * 房间 API
 */

// 获取房间列表
// GET /api/room
// 响应: { success, data: { rooms: [...] } }
export const getRoomList = () => {
  return request('/room', {
    method: 'GET'
  });
};

// 创建房间
// POST /api/room/create
// 响应: { success, message, data: { room, player } }
export const createRoom = () => {
  return request('/room/create', {
    method: 'POST'
  });
};

// 加入房间
// POST /api/room/join
// 请求: { roomCode }
// 响应: { success, message, data: { room, player } }
export const joinRoom = (roomCode) => {
  return request('/room/join', {
    method: 'POST',
    body: JSON.stringify({ roomCode })
  });
};

// 获取房间信息
// GET /api/room/:roomCode
// 响应: { success, data: { room, players, playerCount } }
export const getRoomInfo = (roomCode) => {
  return request(`/room/${roomCode}`, {
    method: 'GET'
  });
};

export default {
  register,
  login,
  getUserInfo,
  logout,
  getRoomList,
  createRoom,
  joinRoom,
  getRoomInfo
};
