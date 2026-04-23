import { updatePlayer } from '../../../store/roomSlice';

/**
 * 统一更新所有玩家的手牌数量
 * @param {Object} props - Redux props (包含 updatePlayer)
 * @param {Object} playerCardCounts - { seat0: 17, seat1: 25, ... }
 */
export const updatePlayersCardCount = (props, playerCardCounts) => {
  if (!playerCardCounts) return;
  
  for (const [key, count] of Object.entries(playerCardCounts)) {
    const seatIndex = parseInt(key.replace('seat', ''));
    if (!isNaN(seatIndex)) {
      props.updatePlayer({ seatIndex, updates: { cardCount: count } });
    }
  }
};