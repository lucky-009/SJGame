/**
 * 登录页
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { setUser } from '../../store/userSlice';
import { initSocket } from '../../services/socket';
import { login as apiLogin } from '../../services/api';
import Button from '../../components/Button';
import './Login.css';

/**
 * 登录组件（Class Component 模式）
 */
class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      username: 'player',
      password: '123456',
      error: '',
      loading: false
    };
  }

  /**
   * 处理用户名输入
   */
  handleUsernameChange = (e) => {
    this.setState({ username: e.target.value, error: '' });
  };

  /**
   * 处理密码输入
   */
  handlePasswordChange = (e) => {
    this.setState({ password: e.target.value, error: '' });
  };

/**
    * 处理登录
    */
  handleLogin = async () => {
    const { username, password } = this.state;

    // 验证输入
    if (!username.trim()) {
      this.setState({ error: '请输入用户名' });
      return;
    }
    if (!password.trim()) {
      this.setState({ error: '请输入密码' });
      return;
    }

    this.setState({ loading: true, error: '' });

    try {
      // 调用登录 API
      const response = await apiLogin(username, password);

      if (response.success) {
        // API.md 响应格式: { success, data: { user, token } }
        const userData = response.data;

        // 保存用户信息到 Redux
        this.props.setUser({
          id: userData.user._id,
          name: userData.user.nickname || userData.user.username,
          token: userData.token
        });

        // 初始化 Socket 连接
        initSocket(userData.token);

        // 跳转到大厅
        this.props.navigate('/lobby');
        
      } else {
        this.setState({ error: response.message || '登录失败' });
      }
    } catch (error) {
      this.setState({ error: error.message || '登录失败，请重试' });
    } finally {
      this.setState({ loading: false });
    }
  };

  /**
   * 处理回车键
   */
  handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      this.handleLogin();
    }
  };

  render() {
    const { username, password, error, loading } = this.state;
    const isValid = username.trim().length > 0;

    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-logo">
            <h1>升级游戏</h1>
            <p>在线四人扑克对战</p>
          </div>

          <div className="login-form">
            <div className="form-group">
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={this.handleUsernameChange}
                onKeyPress={this.handleKeyPress}
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={this.handlePasswordChange}
                onKeyPress={this.handleKeyPress}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-message">{error}</div>
            )}

            <Button
              variant="primary"
              size="large"
              disabled={!isValid || loading}
              onClick={this.handleLogin}
              className="login-button"
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </div>

          <div className="login-footer">
            <p>版本 1.0.0</p>
          </div>
        </div>
      </div>
    );
  }
}

// 使用 useNavigate Hook 的包装组件
const LoginWithNavigate = (props) => {
  const navigate = useNavigate();
  return <Login {...props} navigate={navigate} />;
};

// 连接 Redux
const mapDispatchToProps = {
  setUser
};

export default connect(null, mapDispatchToProps)(LoginWithNavigate);
