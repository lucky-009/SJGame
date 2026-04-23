import { GAME_PHASES } from '../../../utils/constants';

/**
 * 发牌阶段事件处理
 * 包含: handleDealStart, handleCardDealt, handleDealComplete, handleRedeal*
 */
export const createDealingHandlers = (component) => ({
  handleDealStart: (data) => {
    console.log('🎴 开始发牌:', data);
    const { props } = component;
    const { totalCards, isFirstRound, level, bankerSeat, bankerTeam } = data;

    props.setShowRoundStarting(false);
    props.setRoundStartingData(null);

    component.setState({
      showGameResult: false,
      gameResultData: null
    });

    props.setDealProgress({
      isDealing: true,
      current: 0,
      total: totalCards
    });
    props.setRemainingCards(totalCards);
    props.setCurrentLevel(level);
    props.setPhase(GAME_PHASES.DEALING);
    props.setTurnSeatIndex(-1);
    props.setIsMyTurn(false);

    if (!isFirstRound) {
      props.clearDeskCards();
      props.resetRoundScore();
      props.setRoundResult(null);
      props.setMyHands([]);
      props.setBottomCards([]);
      props.setHiddenBottom([]);
      props.setDeskCards({ seat0: [], seat1: [], seat2: [], seat3: [] });

      if (bankerTeam) {
        props.setBanker({ bankerId: '', bankerTeam });
      }

      component.setState({
        currentAction: null,
        buryingSelectedCards: []
      });
    }
  },

  handleCardDealt: (data) => {
    const { props } = component;
    const { cardIndex, totalCards } = data;
    props.setDealProgress({
      isDealing: true,
      current: cardIndex,
      total: totalCards
    });
    props.setRemainingCards(totalCards - cardIndex - 1);
  },

  handleHandUpdated: (data) => {
    const { props } = component;
    const { handCards, seatIndex } = data;
    const { mySeatIndex } = props;
    if (seatIndex === mySeatIndex) {
      props.setMyHands(handCards);
    }
  },

  handleDealComplete: (data) => {
    console.log('🎴 收到 game:deal_complete 事件:', data);
    const { props } = component;
    const { players, remainingCards } = data;

    props.setDealProgress({
      isDealing: false,
      current: 100,
      total: 100
    });

    props.setPhase(GAME_PHASES.DEALEND);

    if (remainingCards !== undefined) {
      props.setRemainingCards(remainingCards);
    } else {
      props.setRemainingCards(0);
    }

    if (players && players.length > 0) {
      const currentPlayers = props.players;
      const updatedPlayers = players.map(p => {
        const existing = currentPlayers.find(cp => cp.seatIndex === p.seatIndex);
        return {
          id: existing?.id || p.userId || p.id,
          username: existing?.username || p.username || `玩家${p.seatIndex}`,
          seatIndex: p.seatIndex,
          cardCount: p.cardCount || 0,
          isReady: existing?.isReady || false,
          isOwner: existing?.isOwner || false,
          team: existing?.team || (p.seatIndex % 2 === 0 ? 'A' : 'B')
        };
      });
      props.updatePlayers(updatedPlayers);
    }
  },

  handleRedealTriggered: (data) => {
    console.log('🔄 重新发牌触发:', data);
    const { props } = component;
    const { reason, lowScorePlayers } = data;

    component.setState({
      error: `重新发牌：${reason}，以下玩家手牌总分不足20分：${lowScorePlayers.map(p => `${p.username}(${p.score}分)`).join(', ')}`
    });

    props.setMyHands([]);
    props.clearSelection();
    props.setPhase(GAME_PHASES.DEALING);
  },

  handleRedealStart: (data) => {
    console.log('🔄 开始重新发牌:', data);
    const { props } = component;
    const { message, totalCards, isFirstRound } = data;

    props.setMyHands([]);
    props.clearSelection();
    props.setPhase(GAME_PHASES.DEALING);

    if (isFirstRound) {
      props.setMainSuit('none');
      props.setBidStateInfo({
        hasBanker: false,
        bankerSeat: -1,
        hasTrump: false,
        trumpSuit: null,
        isLocked: false,
        trumpCallerSeat: -1
      });
    } else {
      props.setMainSuit('none');
      props.setBidStateInfo({
        ...props.bidState,
        hasTrump: false,
        trumpSuit: null,
        trumpCallerSeat: -1
      });
    }

    props.clearDealingActions();
    props.clearDrawBottomState();
    props.clearDeskCards();

    props.setDealProgress({
      isDealing: true,
      current: 0,
      total: totalCards
    });

    component.setState({ error: message });
  },

  handleRedealComplete: (data) => {
    console.log('🔄 重新发牌完成:', data);
    const { props } = component;
    const { message } = data;

    props.setDealProgress({
      isDealing: false,
      current: 100,
      total: 100
    });

    props.setPhase(GAME_PHASES.DEALEND);
    component.setState({ error: '' });

    console.log('重新发牌流程完成');
  },

  handleRedealFailed: (data) => {
    console.log('❌ 重新发牌失败:', data);
    const { props } = component;
    const { message, lowScorePlayers } = data;

    props.setMyHands([]);
    props.clearSelection();
    props.setPhase(GAME_PHASES.DEALING);

    component.setState({
      error: `重新发牌失败：${message}。玩家：${lowScorePlayers.map(p => `${p.username}(${p.score}分)`).join(', ')}`
    });
  }
});

export default { createDealingHandlers };