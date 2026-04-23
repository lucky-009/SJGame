/**
 * 玩家信息组件
 */

import React, { Component } from 'react';
import './PlayerInfo.css';

class PlayerInfo extends Component {
  /**
   * Props:
   * - name: 玩家名称
   * - seatPosition: 座位位置 (self/left/right/opponent)
   * - cardCount: 手牌数量
   * - isReady: 是否准备
   * - isHost: 是否房主
   * - isBanker: 是否庄家
   * - team: 队伍 (A/B)
   * - level: 当前等级
   * - isTurn: 是否轮到此玩家
   * - isMyTeam: 是否自己的队伍
   * - isDisconnected: 是否离线
   */

  render() {
    const {
      username,
      cardCount,
      isReady,
      isHost,
      isBanker,
      team,
      level,
      isTurn,
      isMyTeam,
      position,
      phase,
      isDisconnected
    } = this.props;

    const classes = [
      'player-info',
      `position-${position}`,
      isTurn ? 'turn' : '',
      isMyTeam ? 'my-team' : 'opponent-team',
      isReady ? 'ready' : '',
      isDisconnected ? 'disconnected' : ''
    ].filter(Boolean).join(' ');

    return (
      <div className={classes}>
        {/* 玩家头像/名称 */}
        <div className="player-avatar">
          <div className="avatar-circle">
            {username ? username.charAt(0).toUpperCase() : '?'}
          </div>
        </div>

        {/* 玩家信息 */}
        <div className="player-details">
          <div className="player-name">
            {username || '等待加入'}
          </div>

          {/* 状态标签 */}
          <div className="player-tags">
            {isHost && <span className="tag host">房主</span>}
            {isBanker && <span className="tag banker">庄</span>}
            {team && <span className={`tag team team-${team}`}>{team}队</span>}
            {isDisconnected && <span className="tag offline">离线</span>}
          </div>

          {/* 等级和手牌数 */}
          <div className="player-stats">
            {level && <span className="level">级:{level}</span>}
            {cardCount !== undefined && cardCount >= 0 && (
              <span className="card-count">{cardCount}张</span>
            )}
          </div>
        </div>

        {/* 准备状态 */}
        {isReady !== undefined && (
          <div className={`ready-status ${isReady ? 'ready' : 'not-ready'}`}>
            {isReady ? '已准备' : '未准备'}
          </div>
        )}

        {/* 轮到你出牌 */}
        {isTurn && phase === 'playing' && (
          <div className="turn-indicator">出牌中</div>
        )}
      </div>
    );
  }
}

export default PlayerInfo;
