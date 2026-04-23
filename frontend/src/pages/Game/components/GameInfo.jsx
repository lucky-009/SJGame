import React from 'react';
import { SUITS, SUIT_NAMES } from '../../../utils/constants';

/**
 * 游戏信息组件
 * 显示等级、主花色、庄家信息、得分等
 */
const GameInfo = ({
  levelA,
  levelB,
  mainSuit,
  currentLevel,
  bankerTeam,
  players,
  bidState,
  mySeatIndex,
  teamAScore,
  teamBScore
}) => {
  const getPlayerBySeat = (seatIndex) => {
    if (seatIndex === undefined || seatIndex < 0) return null;
    return players.find(p => p.seatIndex === seatIndex);
  };

  const trumpCaller = getPlayerBySeat(bidState.trumpCallerSeat);
  const trumpCallerName = bidState.hasTrump && trumpCaller ? trumpCaller.username : null;

  const mainBanker = getPlayerBySeat(bidState.bankerSeat);
  const mainBankerName = bidState.hasBanker && mainBanker ? mainBanker.username : null;

  const bankerTeamName = bankerTeam || 'A';
  const idleTeamScore = bankerTeamName === 'A' ? teamBScore : teamAScore;

  return (
    <div className="game-info">
      <div className={`team-level team-A`}>
        <span className="team-name">红队(A):</span>
        <span className="level">{levelA}</span>
      </div>

      <div className="game-center-info">
        <div className="info-row">
          <div className="info-item">
            <span className="label">等级:</span>
            <span className="value">{currentLevel}</span>
          </div>
          <div className="info-item">
            <span className="label">主:</span>
            <span className={`suit-icon ${mainSuit}`}>
              {mainSuit === SUITS.NONE ? '无主' : SUIT_NAMES[mainSuit]}
            </span>
          </div>
          {trumpCallerName && (
            <div className="info-item">
              <span className="label">来源:</span>
              <span className="value">{trumpCallerName}</span>
            </div>
          )}
        </div>
        <div className="info-row">
          <div className="info-item">
            <span className="label">台上:</span>
            <span className="value">{bankerTeamName}队</span>
          </div>
          <div className="info-item">
            <span className="label">打底:</span>
            <span className="value">{bidState.bankerSeat >= 0 ? mainBankerName : '-'}</span>
          </div>
          <div className="info-item score">
            <span className="label">闲家得分:</span>
            <span className="value">{idleTeamScore}</span>
          </div>
        </div>
      </div>

      <div className={`team-level team-B`}>
        <span className="team-name">蓝队(B):</span>
        <span className="level">{levelB}</span>
      </div>
    </div>
  );
};

export default GameInfo;