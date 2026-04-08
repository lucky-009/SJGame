/**
 * 大厅页
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createRoom, getRoomList, logout } from '../../services/api';
import { joinRoom as socketJoinRoom, disconnectSocket, emit, on, off } from '../../services/socket';
import { setRoom, setMySeatIndex } from '../../store/roomSlice';
import { clearUser } from '../../store/userSlice';
import Button from '../../components/Button';
import './Lobby.css';

/**
 * 大厅组件
 */
class Lobby extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rooms: [],
      loading: false,
      error: '',
      roomCode: '',
      joinError: ''
    };
  }

  componentDidMount() {

    this.loadRooms();

    on('room:list_updated', this.handleRoomListUpdated);
  }

  componentWillUnmount() {
    off('room:list_updated', this.handleRoomListUpdated);
  }

  handleRoomListUpdated = (data) => {
    console.log('-------',data)
    this.setState({
      rooms: data.rooms || []
    });
  };

/**
    * 加载房间列表
    * GET /api/room
    * 响应: { success, data: { rooms: [...] } }
    */
  loadRooms = async () => {
    try {
      const startTime = Date.now();
      const response = await getRoomList();

      console.log(`🔍 [Lobby loadRooms] API 响应时间: ${Date.now() - startTime}ms`);

      if (response.success) {
        this.setState({
          rooms: response.data.rooms || []
        });
      }
    } catch (error) {
      console.error('加载房间列表失败:', error);
    } finally {
      this.loadRooms.isRunning = false;
      console.log(`🔍 [Lobby loadRooms] 加载完成`);
    }
  };

  /**
   * 创建房间
   * POST /api/room/create
   * 响应: { success, message, data: { room, player } }
   */
  handleCreateRoom = async () => {
    this.setState({ loading: true, error: '' });

    try {
      const response = await createRoom();

      if (response.success) {
        const { room, player } = response.data;

        // 通过 Socket 加入房间（使用 roomCode）
        const roomData = await socketJoinRoom(room.roomCode);

        // 检查是否是房主（从后端响应中获取）
        const isHost = roomData.players.some(p => p.userId === this.props.user.id && p.isOwner);

        // 更新 Redux 状态
        this.props.setRoom({
          roomCode: roomData.roomCode,
          roomId: null,
          players: roomData.players || [],
          status: roomData.status,
          isHost: isHost,  // 从后端响应获取房主信息
          mySeatIndex: roomData.seatIndex
        });

        // 跳转到房间页
        this.props.navigate(`/room/${room.roomCode}`);
      } else {
        this.setState({ error: response.message || '创建房间失败' });
      }
    } catch (error) {
      this.setState({ error: error.message || '创建房间失败' });
    } finally {
      this.setState({ loading: false });
    }
  };

  /**
   * 加入房间
   * @param {string} roomCode - 6位房间号
   */
  handleJoinRoom = async (roomCode) => {
    try {
      // 通过 Socket 加入房间
      const roomData = await socketJoinRoom(roomCode);

      // 更新 Redux 状态
      console.log('roomData:', roomData);

      // 检查是否是房主（从后端响应中获取）
      const isHost = roomData.players.some(p => p.userId === this.props.user.id && p.isOwner);

      this.props.setRoom({
        roomCode: roomData.roomCode,
        roomId: null,
        players: roomData.players || [],
        status: roomData.status,
        isHost: isHost,  // 从后端响应获取房主信息
        mySeatIndex: roomData.seatIndex
      });

      // 跳转到房间页
      this.props.navigate(`/room/${roomCode}`);
    } catch (error) {
      this.setState({ joinError: error.message || '加入房间失败' });
    }
  };

  /**
   * 处理房间号输入
   */
  handleRoomCodeChange = (e) => {
    this.setState({
      roomCode: e.target.value.toUpperCase(),
      joinError: ''
    });
  };

  /**
   * 加入指定房间
   */
  handleJoinByCode = async () => {
    const { roomCode, rooms } = this.state;

    if (!roomCode.trim()) {
      this.setState({ joinError: '请输入房间号' });
      return;
    }

    // 查找房间
    const room = rooms.find(r => r.roomCode === roomCode);
    if (room) {
      this.handleJoinRoom(room.roomCode);
    } else {
      this.setState({ joinError: '房间不存在' });
    }
  };

  /**
   * 退出登录
   */
  handleLogout = async () => {
    try {
      emit('auth:logout', {}, (response) => {
        console.log('Socket logout response:', response);
      });
    } catch (error) {
      console.error('Socket logout error:', error);
    }

    try {
      await logout();
    } catch (error) {
      console.error('退出登录请求失败:', error);
    }

    disconnectSocket();
    this.props.clearUser();
    this.props.navigate('/login');
  };

  render() {
    const { rooms, loading, error, roomCode, joinError } = this.state;
    const { user } = this.props;

    return (
      <div className="lobby-page">
        <div className="lobby-header">
          <div className="user-info">
            <span className="username">{user.username}</span>
          </div>
          <Button
            variant="danger"
            size="small"
            onClick={this.handleLogout}
            className="logout-btn"
          >
            退出登录
          </Button>
        </div>

        <div className="lobby-content">
          <div className="lobby-actions">
            <Button
              variant="success"
              size="large"
              onClick={this.handleCreateRoom}
              disabled={loading}
              className="create-room-btn"
            >
              {loading ? '创建中...' : '创建房间'}
            </Button>

            <div className="join-room-section">
              <input
                type="text"
                value={roomCode}
                onChange={this.handleRoomCodeChange}
                placeholder="输入房间号"
                maxLength={6}
                className="room-code-input"
              />
              <Button
                variant="primary"
                onClick={this.handleJoinByCode}
                disabled={!roomCode.trim()}
              >
                加入
              </Button>
              {joinError && <span className="error-text">{joinError}</span>}
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="room-list-section">
            <h2>房间列表</h2>
            {rooms.length === 0 ? (
              <div className="empty-rooms">
                <p>暂无房间</p>
                <p>点击"创建房间"开始游戏</p>
              </div>
            ) : (
              <div className="room-list">
                {rooms.map(room => (
                  <div key={room.id} className="room-item">
                    <div className="room-info">
                      <span className="room-code">房间号: {room.roomCode}</span>
                      <span className="room-status">
                        {room.status === 'playing' ? '游戏中' : '等待中'}
                      </span>
                      <span className="room-levels">
                        A:{room.levelA} vs B:{room.levelB}
                      </span>
                    </div>
                    <div className="room-players">
                      {room.playerCount}/4 玩家
                    </div>
                    <Button
                      variant={room.status === 'waiting' ? 'primary' : 'default'}
                      size="small"
                      onClick={() => this.handleJoinRoom(room.roomCode)}
                      disabled={room.playerCount >= 4}
                    >
                      {room.status === 'playing' ? '观战' : '加入'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// 从 Redux 获取用户信息
const mapStateToProps = (state) => ({
  user: state.user
});

const mapDispatchToProps = {
  setRoom,
  setMySeatIndex,
  clearUser
};

// 使用 useNavigate Hook 的包装组件
const LobbyWithNavigate = (props) => {
  const navigate = useNavigate();
  return <Lobby {...props} navigate={navigate} />;
};

export default connect(mapStateToProps, mapDispatchToProps)(LobbyWithNavigate);
