/**
 * 房间页
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  onPlayerJoined,
  onPlayerReady,
  onGameStarting,
  onPlayerLeft,
  onRoomDismissed,
  onAllKicked,
  playerReady,
  leaveRoom as socketLeaveRoom,
  isConnected
} from '../../services/socket';
import { clearRoom, setRoom, setPlayerReady, setRoomStatus, setHost, setMySeatIndex, updatePlayers } from '../../store/roomSlice';
import { resetGame } from '../../store/gameSlice';
import Button from '../../components/Button';
import PlayerInfo from '../../components/PlayerInfo';
import './Room.css';

/**
 * 房间组件
 */
class Room extends Component {
    constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: '',
      socketConnected: true,
      isLeaving: false,      // 标记是否正在离开房间
      processingDismissal: false  // 标记是否正在处理解散事件
    };
    this.connectionCheckInterval = null;
  }

  componentDidMount() {
    this.setupSocketListeners();
    this.connectionCheckInterval = setInterval(() => {
      this.setState({ socketConnected: isConnected() });
    }, 1000);
  }

  componentWillUnmount() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
  }

  /**
   * 设置 Socket 监听
   */
  setupSocketListeners = () => {
    // 玩家加入房间
    // 事件: room:player_joined
    // 接收: { userId, username, seatIndex, team }
    onPlayerJoined((data) => {
      this.handlePlayerJoined(data);
    });

    // 玩家准备状态变化
    // 事件: room:player_ready
    // 接收: { userId, seatIndex, isReady }
    onPlayerReady((data) => {
      this.handlePlayerReady(data);
    });

    // 游戏即将开始
    // 事件: room:game_starting
    onGameStarting(() => {
      console.log('🚩 收到 room:game_starting，准备跳转游戏');
      this.props.setRoomStatus('playing');
      this.props.navigate(`/game/${this.props.roomCode}`);
    });

    // 玩家离开
    // 事件: room:player_left
    // 接收: { userId, seatIndex }
    onPlayerLeft((data) => {
      this.handlePlayerLeft(data);
    });

    // 房间被解散（房主操作）
    // 事件: room:room_dismissed
    onRoomDismissed((data) => {
      this.handleRoomDismissed(data);
    });

    // 被踢出房间（房间解散）- 兼容性事件
    onAllKicked((data) => {
      this.handleAllKicked(data);
    });
  };

  /**
    * 处理玩家加入
    */
  handlePlayerJoined = (data) => {
    console.log('handlePlayerJoined:', data);
    const { userId, username, seatIndex, team, isReady, isOwner } = data;

    // 更新 Redux 玩家列表
    const newPlayer = {
      userId,
      id: userId,
      username,
      seatIndex,
      team,
      isReady: isReady || false,
      isOwner: isOwner || false
    };

    // 添加到现有玩家列表
    const currentPlayers = [...this.props.players];
    console.log('currentPlayers before:', currentPlayers);
    const existingIndex = currentPlayers.findIndex(p => p.userId === userId || p.id === userId);

    if (existingIndex >= 0) {
      currentPlayers[existingIndex] = newPlayer;
    } else {
      currentPlayers.push(newPlayer);
    }

    this.props.updatePlayers(currentPlayers);

    // 如果是自己，更新座位索引和房主状态
    if (userId === this.props.user.id) {
      this.props.setMySeatIndex(seatIndex);
      // 更新房主状态
      if (isOwner !== undefined) {
        this.props.setHost(isOwner);
      }
    }
  };

  /**
   * 处理玩家准备状态变化
   */
  handlePlayerReady = (data) => {
    const { userId, seatIndex, isReady } = data;

    // 更新 Redux 中的准备状态
    this.props.setPlayerReady({ playerId: userId, isReady });
  };

  /**
    * 处理玩家离开
    */
  handlePlayerLeft = (data) => {
    const { userId } = data;
    console.log('handlePlayerLeft:', userId);

    // 从玩家列表中移除
    const currentPlayers = this.props.players.filter(p => p.userId !== userId && p.id !== userId);
    this.props.updatePlayers(currentPlayers);
  };

  /**
    * 处理房间被解散（房主操作）
    */
  handleRoomDismissed = (data) => {
    const { message, isOwner } = data;

    // 防止重复处理
    if (this.state.processingDismissal) {
      return;
    }

    this.setState({ processingDismissal: true });

    // 如果是房主自己操作的解散，且已经通过 handleLeaveRoom 处理过，就不重复提示
    if (isOwner && this.state.isLeaving) {
      // 房主已经处理过，直接跳转
      this.props.clearRoom();
      this.props.resetGame();
      this.props.navigate('/lobby');
      return;
    }

    // 普通玩家收到解散提示
    alert(message || '房间已被解散');

    // 清理状态并跳转到大厅
    this.props.clearRoom();
    this.props.resetGame();
    this.props.navigate('/lobby');
  };

  /**
    * 处理被踢出房间（房间解散）
    * 这个事件现在基本不会用到，因为已经统一使用 room_dismissed
    */
  handleAllKicked = (data) => {
    // 防止重复处理
    if (this.state.processingDismissal) {
      return;
    }

    this.setState({ processingDismissal: true });

    // 为了兼容性，保留这个事件处理，但不再显示提示
    // 因为房间解散后会有清理操作，这里直接跳转
    this.props.clearRoom();
    this.props.resetGame();
    this.props.navigate('/lobby');
  };

  /**
   * 准备/取消准备
   */
  handleReady = () => {
    console.log('handleReady called');
    const { roomCode, mySeatIndex, players } = this.props;
    console.log('roomCode:', roomCode, 'mySeatIndex:', mySeatIndex, 'players:', players);
    const myPlayer = players.find(p => p.seatIndex === mySeatIndex);
    const newReadyState = !myPlayer?.isReady;

    console.log('myPlayer:', myPlayer, 'newReadyState:', newReadyState);

    // 发送准备状态到服务端
    // 事件: game:ready
    // 发送: { roomCode, isReady }
    playerReady(roomCode, newReadyState).then(() => {
      console.log('playerReady success');
    }).catch(err => {
      console.error('playerReady error:', err);
    });

    // 本地更新状态
    this.props.setPlayerReady({
      playerId: this.props.user.id,
      isReady: newReadyState
    });
  };

  /**
    * 离开房间/解散房间
    */
  handleLeaveRoom = async () => {
    const { roomCode, players, mySeatIndex } = this.props;

    // 找到自己的玩家信息
    const myPlayer = players.find(p => p.seatIndex === mySeatIndex);
    const isHost = myPlayer?.isOwner || false;

    // 确认是否要解散房间（房主）或离开房间（普通玩家）
    const action = isHost ? '解散' : '退出';
    const confirmMessage = isHost
      ? '您确定要解散房间吗？所有玩家都会被踢出。'
      : '您确定要离开房间吗？';

    if (window.confirm(confirmMessage)) {
      try {
        // 标记正在离开，避免收到解散事件时重复处理
        this.setState({ isLeaving: true });

        // 发送离开房间事件，房主需要传递 isOwner 参数
        await socketLeaveRoom(roomCode, isHost);

        // 注意：房主解散房间后，会收到 room_dismissed 事件
        // 但为了避免重复处理，我们在这里直接跳转
        // 稍后收到事件时会检查 isLeaving 状态

        // 延迟跳转，等待可能的网络延迟
        setTimeout(() => {
          this.props.clearRoom();
          this.props.resetGame();
          this.props.navigate('/lobby');
        }, 100);

      } catch (error) {
        console.error('离开房间失败:', error);
        this.setState({ isLeaving: false }); // 重置状态
        alert('操作失败，请重试');
        return;
      }
    }
  };

  /**
   * 获取座位位置
   */
  getSeatPosition = (seatIndex, mySeatIndex) => {
    const positions = ['self', 'right', 'opponent', 'left'];
    const relativeIndex = (seatIndex - mySeatIndex + 4) % 4;
    return positions[relativeIndex];
  };

  render() {
    const { roomCode, players, status, mySeatIndex, user } = this.props;
    const { loading, error, socketConnected } = this.state;

    // 找到自己的玩家信息
    const myPlayer = players.find(p => p.seatIndex === mySeatIndex);
    const isReady = myPlayer?.isReady || false;
    const isHost = this.props.isHost || myPlayer?.isOwner || false;

    // 检查是否所有玩家都准备好了
    const allReady = players.length === 4 && players.every(p => p.isReady);

    // 按座位顺序排列玩家
    const sortedPlayers = Array(4).fill(null).map((_, i) => {
      return players.find(p => p.seatIndex === i) || null;
    });

    return (
      <div className="room-page">
        <div className="room-header">
          <div className="room-title">
            <h2>房间 {roomCode}</h2>
            <span className={`connection-status ${socketConnected ? 'connected' : 'disconnected'}`}>
              {socketConnected ? '● 已连接' : '● 已断开'}
            </span>
          </div>
          <Button
            variant="danger"
            size="small"
            onClick={this.handleLeaveRoom}
          >
            {isHost ? '解散房间' : '退出房间'}
          </Button>
        </div>

        <div className="room-content">
          <div className="seats-container">
            {sortedPlayers.map((player, index) => {
              const position = this.getSeatPosition(index, mySeatIndex);
              const isMySeat = index === mySeatIndex;

              return (
                <div key={index} className={`seat seat-${position}`}>
                  <PlayerInfo
                    name={player?.username || (isMySeat ? user.username : null)}
                    cardCount={player?.cardCount}
                    isReady={player?.isReady}
                    isHost={player?.isOwner}
                    isBanker={player?.isBanker}
                    team={getTeam(index)}
                    position={position}
                    isMyTeam={getTeam(index) === getTeam(mySeatIndex)}
                  />
                </div>
              );
            })}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="room-actions">
            {mySeatIndex !== undefined && (
              <Button
                variant={isReady ? 'default' : 'primary'}
                size="large"
                onClick={this.handleReady}
                disabled={status === 'playing'}
              >
                {isReady ? '取消准备' : '准备'}
              </Button>
            )}

            {isHost && (
              <Button
                variant="success"
                size="large"
                onClick={this.handleStartGame}
                disabled={!allReady || loading}
              >
                {loading ? '开始中...' : '开始游戏'}
              </Button>
            )}

            {!isHost && !allReady && players.length < 4 && (
              <div className="waiting-start">
                等待玩家加入... ({players.length}/4)
              </div>
            )}

            {!isHost && !allReady && players.length === 4 && (
              <div className="waiting-start">
                等待房主开始游戏...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /**
   * 开始游戏（房主点击）
   * 注意：游戏开始由服务端控制，当所有人准备后自动开始
   */
  handleStartGame = () => {
    // 房主点击开始后，服务端会自动开始游戏
    // 这里不需要调用 API，服务端会通过 room:game_starting 事件通知
    this.setState({ loading: true });
  };
}

// 辅助函数：获取队伍
const getTeam = (seatIndex) => {
  return seatIndex % 2 === 0 ? 'A' : 'B';
};

// 从 Redux 获取状态
const mapStateToProps = (state) => ({
  user: state.user,
  roomCode: state.room.roomCode,
  players: state.room.players,
  status: state.room.status,
  mySeatIndex: state.room.mySeatIndex,
  isHost: state.room.isHost
});

const mapDispatchToProps = {
  clearRoom,
  setRoom,
  setPlayerReady,
  setRoomStatus,
  setHost,
  setMySeatIndex,
  updatePlayers,
  resetGame
};

// 使用 useNavigate 和 useParams 的包装组件
const RoomWithNavigate = (props) => {
  const navigate = useNavigate();
  const params = useParams();
  return <Room {...props} navigate={navigate} roomCode={params.roomId} />;
};

export default connect(mapStateToProps, mapDispatchToProps)(RoomWithNavigate);
