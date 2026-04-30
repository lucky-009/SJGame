/**
 * 抢庄/抢主阶段事件处理
 * 包含: handleCanCallBanker, handleCanLockBanker, handleCanReverseBanker,
 *       handleCanCallTrump, handleCanLockTrump, handleCanReverseTrump,
 *       handleBidStateChanged, handleBidRejected, handleBidTimeout,
 *       handleBankerCalled, handleBankerLocked, handleTrumpCalled, handleTrumpReversed
 */
export const createBiddingHandlers = (component) => ({
  handleCanCallBanker: (data) => {
    console.log('🎯 可以抢庄:', data, 'mySeatIndex:', component.props.mySeatIndex);
    const { props } = component;
    const { seatIndex, level, availableCards } = data;
    const { mySeatIndex } = props;
    props.setCanCallBanker(true);
    props.setAvailableBankerCards(availableCards || []);
    props.setIsMyTurn(true);
    props.setTurnSeatIndex(mySeatIndex);
  },

  handleCanLockBanker: (data) => {
    console.log('🎯 可以锁庄:', data, 'mySeatIndex:', component.props.mySeatIndex);
    const { props } = component;
    const { seatIndex, availableCards } = data;
    const { mySeatIndex } = props;
    props.setCanLockBanker(true);
    if (availableCards && availableCards.length > 0) {
      props.setAvailableLockBankerCards(availableCards);
    }
    props.setIsMyTurn(true);
    props.setTurnSeatIndex(mySeatIndex);
  },

  handleCanReverseBanker: (data) => {
    console.log('🎯 可以反庄:', data, 'mySeatIndex:', component.props.mySeatIndex);
    const { props } = component;
    const { seatIndex, suit, card } = data;
    const { mySeatIndex } = props;
    props.setCanReverseBanker(true);
    props.setAvailableReverseCards({ type: 'banker', suit: suit, card: card });
    props.setIsMyTurn(true);
    props.setTurnSeatIndex(mySeatIndex);
  },

  handleCanCallTrump: (data) => {
    console.log('🎯 可以抢主色:', data, 'mySeatIndex:', component.props.mySeatIndex);
    const { props } = component;
    const { seatIndex, level, availableCards } = data;
    const { mySeatIndex } = props;
    props.setCanCallTrump(true);
    props.setAvailableTrumpCards(availableCards || []);
    props.setIsMyTurn(true);
    props.setTurnSeatIndex(mySeatIndex);
  },

  handleCanLockTrump: (data) => {
    console.log('🎯 可以锁主色:', data, 'mySeatIndex:', component.props.mySeatIndex);
    const { props } = component;
    const { seatIndex, availableCards } = data;
    const { mySeatIndex } = props;
    props.setCanLockTrump(true);
    if (availableCards && availableCards.length > 0) {
      props.setAvailableTrumpCards(availableCards);
    }
    props.setIsMyTurn(true);
    props.setTurnSeatIndex(mySeatIndex);
  },

  handleCanReverseTrump: (data) => {
    console.log('🎯 可以反主色:', data, 'mySeatIndex:', component.props.mySeatIndex);
    const { props } = component;
    const { seatIndex, availablePairs } = data;
    const { mySeatIndex } = props;
    props.setCanReverseTrump(true);
    props.setAvailableReverseCards({ type: 'trump', cards: availablePairs });
    props.setIsMyTurn(true);
    props.setTurnSeatIndex(mySeatIndex);
  },

  handleBidStateChanged: (data) => {
    console.log('📊 投标状态变化:', data);
    const { props } = component;
    const { hasBanker, bankerSeat, hasTrump, trumpSuit, isLocked, trumpCallerSeat } = data;
    props.setBidStateInfo({
      hasBanker,
      bankerSeat,
      hasTrump,
      trumpSuit,
      isLocked,
      trumpCallerSeat
    });
    if (trumpSuit) {
      props.setMainSuit(trumpSuit);
    }
  },

  handleBidRejected: (data) => {
    console.log('❌ 操作被拒绝:', data);
    const { reason } = data;
    component.setState({ error: reason });
  },

  handleBidTimeout: (data) => {
    console.log('⏰ 投标超时:', data);
    const { props } = component;
    props.clearDealingActions();
  },

  handleBankerLocked: (data) => {
    console.log('⏰ 玩家锁庄:', data);
  },

  handleBankerCalled: (data) => {
    const { props } = component;
    const { seatIndex, team, card, suit } = data;
    props.setBidState({
      currentBidder: seatIndex,
      bidSuit: suit,
      isLocked: false
    });
  },

  handleTrumpCalled: (data) => {
    const { props } = component;
    const { seatIndex, suit } = data;
    props.setMainSuit(suit);
    props.setBidState({
      currentBidder: seatIndex,
      bidSuit: suit,
      isLocked: false
    });
  },

  handleTrumpReversed: (data) => {
    const { props } = component;
    const { seatIndex, suit, isNoTrump } = data;
    props.setMainSuit(isNoTrump ? 'none' : suit);
  },

  handleYourTurn: (data) => {
    const { props } = component;
    const { action, seatIndex, level, handCards, trumpSuit, drawInfo } = data;

    props.setTurnSeatIndex(seatIndex);
    props.setCurrentLevel(level);

    if (trumpSuit) {
      props.setMainSuit(trumpSuit);
    }

    const { mySeatIndex } = props;
    const isMyTurn = seatIndex === mySeatIndex;
    props.setIsMyTurn(isMyTurn);

    component.setState({ currentAction: action });

    switch (action) {
      case 'call_banker':
      case 'call_trump':
        props.setCanCallBanker(isMyTurn);
        break;
      case 'bury_bottom':
        props.setPhase('bottoming');
        props.clearDealingActions();
        if (handCards) {
          props.setMyHands(handCards);
        }
        component.setState({
          bottomCards: props.bottomCards,
          bottomSelection: [],
          drawInfo: drawInfo || null
        });
        break;
      case 'play_cards':
        props.setTimeLeft(30);
        props.setPhase('playing');
        if (handCards) {
          props.setMyHands(handCards);
        }
        break;
      default:
        break;
    }

    if (isMyTurn) {
      component.startTimer();
    } else {
      component.clearTimer();
    }
  }
});

export default { createBiddingHandlers };