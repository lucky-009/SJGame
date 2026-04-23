import { parseCardString } from '../utils/gameUtils';
import { updatePlayersCardCount } from '../utils/playerCardUtils';
import { TEAMS } from '../../../utils/constants';

/**
 * 出牌阶段事件处理
 * 包含: handleCardPlayed, handleTurnResult, handlePlayingStart
 */
export const createPlayingHandlers = (component) => ({
  handleCardPlayed: (data) => {
    const { props } = component;
    const { seatIndex, cards, playerCardCounts, leadPlayCardCount } = data;

    if (leadPlayCardCount !== undefined) {
      props.setLeadPlayCardCount(leadPlayCardCount);
    }

    const parsedCards = cards.map(cardStr => {
      if (typeof cardStr === 'string') {
        return parseCardString(cardStr);
      }
      return cardStr;
    });

    props.addDeskCard({ seatIndex, cards: parsedCards });

    updatePlayersCardCount(props, playerCardCounts);
  },

  handleTurnResult: (data) => {
    const { props } = component;
    const { winnerSeat, winnerTeam, score, teamAScore, teamBScore } = data;

    if (teamAScore !== undefined) {
      props.addTeamScore({ team: TEAMS.A, score: teamAScore - props.teamAScore });
    }
    if (teamBScore !== undefined) {
      props.addTeamScore({ team: TEAMS.B, score: teamBScore - props.teamBScore });
    }

    props.setTurnSeatIndex(winnerSeat);

    const mySeatIndex = props.mySeatIndex;
    const myTeam = mySeatIndex % 2 === 0 ? 'A' : 'B';
    props.setRoundResult({
      winnerSeat,
      score,
      isMyTeamWin: winnerTeam === myTeam
    });

    setTimeout(() => {
      props.clearDeskCards();
      props.resetRoundScore();
      props.setRoundResult(null);
      props.setLeadSeatIndex(winnerSeat);
      props.setLeadPlayCardCount(0);
    }, 1200);
  },

  handlePlayingStart: (data) => {
    const { props } = component;
    const { bankerSeat, bankerTeam, trumpSuit, isNoTrump, level, currentTurn, remainingCards } = data;

    props.setBanker({ bankerId: '', bankerTeam });
    props.setMainSuit(isNoTrump ? 'none' : trumpSuit);
    props.setCurrentLevel(level);
    props.setPhase('playing');
    props.setLeadSeatIndex(bankerSeat);
    props.setTurnSeatIndex(bankerSeat);
    props.clearDealingActions();
    component.setState({ buryingSelectedCards: [] });
    props.setLeadPlayCardCount(0);
  }
});

export default { createPlayingHandlers };