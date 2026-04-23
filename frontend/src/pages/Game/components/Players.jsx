import React from 'react';
import PlayerInfo from '../../../components/PlayerInfo';
import { getTeam } from '../utils/gameUtils';

/**
 * 玩家信息区域组件
 * 渲染4个玩家信息（上下左右）
 */
const Players = ({
  players,
  mySeatIndex,
  user,
  bankerId,
  turnSeatIndex,
  levelA,
  levelB,
  phase,
  myHands
}) => {
  const getPlayerByRelativePosition = (relativeIndex) => {
    const seatIndex = (mySeatIndex + relativeIndex) % 4;
    return players.find(p => p.seatIndex === seatIndex);
  };

  const playerRight = getPlayerByRelativePosition(1);
  const playerOpponent = getPlayerByRelativePosition(2);
  const playerLeft = getPlayerByRelativePosition(3);
  const playerSelf = getPlayerByRelativePosition(0);

  return (
    <div className="players-area">
      <div className="player-top">
        <PlayerInfo
          username={playerOpponent?.username || (mySeatIndex === 2 ? user.username : `玩家${getTeam(2)}队`)}
          cardCount={playerOpponent?.cardCount}
          isBanker={playerOpponent?.id === bankerId}
          team={playerOpponent?.team || getTeam(2)}
          level={levelB}
          position="opponent"
          isTurn={turnSeatIndex === playerOpponent?.seatIndex}
          isMyTeam={true}
          phase={phase}
        />
      </div>

      <div className="player-left">
        <PlayerInfo
          username={playerLeft?.username || (mySeatIndex === 3 ? user.username : `玩家${getTeam(3)}队`)}
          cardCount={playerLeft?.cardCount}
          isBanker={playerLeft?.id === bankerId}
          team={playerLeft?.team || getTeam(3)}
          level={levelB}
          position="left"
          isTurn={turnSeatIndex === playerLeft?.seatIndex}
          isMyTeam={false}
          phase={phase}
        />
      </div>

      <div className="player-right">
        <PlayerInfo
          username={playerRight?.username || (mySeatIndex === 1 ? user.username : `玩家${getTeam(1)}队`)}
          cardCount={playerRight?.cardCount}
          isBanker={playerRight?.id === bankerId}
          team={playerRight?.team || getTeam(1)}
          level={levelA}
          position="right"
          isTurn={turnSeatIndex === playerRight?.seatIndex}
          isMyTeam={false}
          phase={phase}
        />
      </div>

      <div className="player-bottom">
        <PlayerInfo
          username={playerSelf?.username || user.username}
          cardCount={myHands?.length}
          isBanker={playerSelf?.id === bankerId}
          team={playerSelf?.team || getTeam(mySeatIndex)}
          level={levelA}
          position="self"
          isTurn={turnSeatIndex === mySeatIndex}
          isMyTeam={true}
          phase={phase}
        />
      </div>
    </div>
  );
};

export default Players;