/**
 * 结算页
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import './Result.css';

/**
 * 结算组件
 */
class Result extends Component {
  constructor(props) {
    super(props);
    this.state = {
      gameResult: null
    };
  }

  componentDidMount() {
    // 从 location state 获取结算数据
    const { state } = this.props.location;
    if (state?.gameResult) {
      this.setState({ gameResult: state.gameResult });
    }
  }

  /**
   * 继续游戏
   */
  handleContinue = () => {
    this.props.navigate(`/room/${this.props.roomId}`);
  };

  /**
   * 返回大厅
   */
  handleBackToLobby = () => {
    this.props.navigate('/lobby');
  };

  render() {
    const { gameResult } = this.state;
    
    if (!gameResult) {
      return (
        <div className="result-page">
          <div className="result-container">
            <h1>游戏结束</h1>
            <p>正在返回大厅...</p>
            <Button
              variant="primary"
              onClick={this.handleBackToLobby}
            >
              返回大厅
            </Button>
          </div>
        </div>
      );
    }

    const {
      winnerTeam,
      finalLevelA,
      finalLevelB,
      scores,
      bottomMultiplier,
      isGameEnd,
      reason
    } = gameResult;

    return (
      <div className="result-page">
        <div className="result-container">
          <div className="result-header">
            <h1 className={winnerTeam === 'A' ? 'team-a-wins' : 'team-b-wins'}>
              {isGameEnd ? '游戏结束!' : '本局结束'}
            </h1>
            {isGameEnd && (
              <div className="winner-announce">
                {winnerTeam === 'A' ? 'A队' : 'B队'} 获得最终胜利!
              </div>
            )}
          </div>

          <div className="result-content">
            {/* 等级变化 */}
            <div className="level-changes">
              <div className="team-result team-a">
                <h3>A队</h3>
                <div className="level-change">
                  {finalLevelA}
                </div>
                {reason && <p className="reason">{reason}</p>}
              </div>
              
              <div className="vs">VS</div>
              
              <div className="team-result team-b">
                <h3>B队</h3>
                <div className="level-change">
                  {finalLevelB}
                </div>
              </div>
            </div>

            {/* 得分详情 */}
            {scores && (
              <div className="score-details">
                <h3>得分详情</h3>
                <div className="scores">
                  <div className="score-item">
                    <span>A队得分:</span>
                    <span className="score-value">{scores.teamA || 0}</span>
                  </div>
                  <div className="score-item">
                    <span>B队得分:</span>
                    <span className="score-value">{scores.teamB || 0}</span>
                  </div>
                </div>
                
                {bottomMultiplier > 1 && (
                  <div className="bottom-bonus">
                    抠底倍数: ×{bottomMultiplier}
                  </div>
                )}
              </div>
            )}

            {/* 游戏结束原因 */}
            {reason && !isGameEnd && (
              <div className="game-reason">
                {reason}
              </div>
            )}
          </div>

          <div className="result-actions">
            {!isGameEnd ? (
              <Button
                variant="primary"
                size="large"
                onClick={this.handleContinue}
              >
                继续游戏
              </Button>
            ) : (
              <Button
                variant="primary"
                size="large"
                onClick={this.handleBackToLobby}
              >
                返回大厅
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// 从 Redux 获取状态
const mapStateToProps = (state) => ({
  roomId: state.room.roomId
});

// 使用 useNavigate, useParams, useLocation 的包装组件
const ResultWithNavigate = (props) => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  return <Result {...props} navigate={navigate} roomId={params.roomId} location={location} />;
};

export default connect(mapStateToProps)(ResultWithNavigate);
