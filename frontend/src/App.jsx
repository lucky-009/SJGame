/**
 * 应用入口组件
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store';
import './styles/index.css';

// 页面组件
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Result from './pages/Result';

/**
 * 路由守卫组件
 * 检查用户是否已登录
 */
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

/**
 * App 根组件
 */
const App = () => {
  return (
    <Provider store={store}>
      <Router>
        <div className="app">
          {/* 强制横屏遮罩 */}
          <div className="rotate-mask">
            <div className="rotate-icon">📱</div>
            <div className="rotate-text">请旋转手机以获得最佳体验</div>
          </div>
          
          {/* 路由配置 */}
          <Routes>
            {/* 登录页 */}
            <Route path="/" element={<Login />} />
            
            {/* 大厅页 - 需要登录 */}
            <Route 
              path="/lobby" 
              element={
                <ProtectedRoute>
                  <Lobby />
                </ProtectedRoute>
              } 
            />
            
            {/* 房间页 - 需要登录 */}
            <Route 
              path="/room/:roomId" 
              element={
                <ProtectedRoute>
                  <Room />
                </ProtectedRoute>
              } 
            />
            
            {/* 游戏页 - 需要登录 */}
            <Route 
              path="/game/:roomId" 
              element={
                <ProtectedRoute>
                  <Game />
                </ProtectedRoute>
              } 
            />
            
            {/* 结算页 - 需要登录 */}
            <Route 
              path="/result/:roomId" 
              element={
                <ProtectedRoute>
                  <Result />
                </ProtectedRoute>
              } 
            />
            
            {/* 默认重定向到登录页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </Provider>
  );
};

export default App;
