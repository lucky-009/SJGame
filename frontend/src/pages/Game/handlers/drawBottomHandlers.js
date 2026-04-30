import { takeBottom, skipDrawBottom } from '../../../services/socket';
import { updatePlayersCardCount } from '../utils/playerCardUtils';

/**
 * 抄底阶段事件处理
 * 包含: handleAskDrawBottom, handleDrawBottomSuccess, handleDrawBottomFailed,
 *       handleDrawBottomTimeout, handleDrawBottomSkipped, handleDrawBottomComplete,
 *       handleDrawBottomFatal, handleBottomReveal, handleDrawBottomOptionClick,
 *       handleSkipDrawBottom
 */
export const createDrawBottomHandlers = (component) => ({
  handleAskDrawBottom: (data) => {
    console.log('🎯 询问抄底:', data);
    const { props } = component;
    const { seatIndex, timeout, drawableOptions, currentMainSuit, isNoTrump } = data;
    const mySeatIndex = props.seatIndex;

    props.setDrawBottomState({
      isActive: true,
      currentAsker: seatIndex,
      canDraw: seatIndex === mySeatIndex,
      timeout: timeout,
      drawableOptions: drawableOptions
    });

    component.startDrawBottomTimer(timeout);
  },

  handleDrawBottomSuccess: (data) => {
    console.log('✅ 抄底成功:', data);
    const { props } = component;
    const { seatIndex, drawType, drawCards, mainSuit, isNoTrump, trumpCallerSeat, addedCards, totalCards, remainingCards } = data;

    component.clearDrawBottomTimer();

    props.setMainSuit(mainSuit);
    props.setBidStateInfo({
      ...props.bidState,
      hasTrump: true,
      trumpSuit: mainSuit,
      trumpCallerSeat: trumpCallerSeat !== undefined ? trumpCallerSeat : seatIndex,
      isLocked: true
    });

    if (remainingCards !== undefined) {
      props.setRemainingCards(remainingCards);
    }

    if (seatIndex !== undefined && totalCards !== undefined) {
      const playerCardCounts = {};
      playerCardCounts[`seat${seatIndex}`] = totalCards;
      updatePlayersCardCount(props, playerCardCounts);
    }

    props.setDrawBottomState({
      drawInfo: {
        drawType,
        drawCards,
        mainSuit,
        isNoTrump
      }
    });
  },

  handleDrawBottomFailed: (data) => {
    console.log('❌ 抄底失败:', data);
    const { seatIndex, message } = data;
    component.setState({
      error: `抄底失败：${message}`
    });
  },

  handleDrawBottomTimeout: (data) => {
    console.log('⏰ 抄底超时:', data);
    const { props } = component;
    const { seatIndex } = data;

    component.clearDrawBottomTimer();

    props.setDrawBottomState({
      isActive: false,
      canDraw: false,
      isMyTurn: false
    });
  },

  handleDrawBottomSkipped: (data) => {
    console.log('⏭ 玩家放弃抄底:', data);
    const { props } = component;
    const { seatIndex } = data;

    component.clearDrawBottomTimer();

    props.setDrawBottomState({
      isActive: false,
      canDraw: false,
      isMyTurn: false
    });
  },

  handleDrawBottomComplete: (data) => {
    console.log('🏁 抄底阶段完成:', data);
    const { props } = component;
    const { finalMainSuit, isNoTrump, hasDrawer, remainingCards, trumpCallerSeat } = data;

    props.clearDrawBottomState();

    props.setMainSuit(finalMainSuit);
    props.setBidStateInfo({
      ...props.bidState,
      hasTrump: true,
      trumpSuit: finalMainSuit,
      trumpCallerSeat: trumpCallerSeat !== undefined ? trumpCallerSeat : props.bidState.trumpCallerSeat,
      isNoTrump: isNoTrump
    });

    if (remainingCards !== undefined) {
      props.setRemainingCards(remainingCards);
    }
  },

  handleDrawBottomFatal: (data) => {
    console.log('💀 抄底阶段致命错误:', data);
    const { message, winner } = data;
    component.setState({
      error: message
    });
  },

  handleBottomReveal: (data) => {
    console.log('🃏 抠底揭示:', data);
    const { props } = component;
    const { bottomCards, winnerSeat, winnerTeam, bottomResult, teamAScore, teamBScore } = data;

    if (teamAScore !== undefined) {
      props.addTeamScore({ team: 'A', score: teamAScore - props.teamAScore });
    }
    if (teamBScore !== undefined) {
      props.addTeamScore({ team: 'B', score: teamBScore - props.teamBScore });
    }

    component.setState({
      showBottomReveal: true,
      bottomRevealData: {
        bottomCards,
        winnerSeat,
        winnerTeam,
        bottomResult,
        teamAScore,
        teamBScore
      }
    });
  },

  handleBottomTaken: (data) => {
    console.log('🎴 拿底牌通知:', data);
    const { props } = component;
    const { playerCardCounts } = data;
    updatePlayersCardCount(props, playerCardCounts);
  },

});

export default { createDrawBottomHandlers };
