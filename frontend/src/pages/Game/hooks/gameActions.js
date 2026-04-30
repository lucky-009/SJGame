import { parseCardString, sortHandCards, cardsToStrings } from '../utils/gameUtils';
import { playCards, callBanker, lockBanker, reverseBanker, callTrump, lockTrump, reverseTrump, buryBottom } from '../../../services/socket';

/**
 * 游戏操作函数模块
 * 封装游戏相关的操作方法（抢庄、出牌、埋底等）
 * 供 Class Component 调用
 */

export const createGameActions = (component) => ({
  handleCardClick: (card, index, isMultiSelect = false) => {
    const { props } = component;
    const { selectedCards, isMyTurn } = props;
    if (!isMyTurn) return;

    if (isMultiSelect) {
      const selectedIndex = selectedCards.indexOf(index);
      if (selectedIndex >= 0) {
        const newSelectedCards = [...selectedCards];
        newSelectedCards.splice(selectedIndex, 1);
        props.selectCards(newSelectedCards);
      } else {
        const newSelectedCards = [...selectedCards, index];
        newSelectedCards.sort((a, b) => a - b);
        props.selectCards(newSelectedCards);
      }
    } else {
      props.toggleCardSelection({index});
    }
  },

  handlePlayCardsAction: (ruleEngine) => {
    const { props } = component;
    const { selectedCards, myHands, leadSeatIndex, leadSuit, mainSuit, currentLevel, deskCards } = props;
    if (selectedCards.length === 0) return;

    const sortedHands = sortHandCards(myHands, currentLevel);
    const selected = selectedCards.map(i => {
      const card = sortedHands[i];
      if (typeof card === 'string') {
        return parseCardString(card);
      }
      return card;
    });

    // 校验出牌张数（规则校验移至后端）
    // const leadCards = deskCards[leadSeatIndex] || [];
    // if (leadCards.length > 0 && selected.length !== leadCards.length) {
    //     component.setState({ error: `出牌张数必须与首家相同（${leadCards.length}张）` });
    //     return;
    // }
    // TODO: 后端校验规则，前端只校验张数

    const cardStrs = cardsToStrings(selected);
    playCards(cardStrs);

    props.clearSelection();
    component.setState({ error: '' });
  },

  handleCallBankerAction: (cardStr) => {
    callBanker(cardStr).catch((err) => {
      component.setState({ error: err.message });
    });
  },

  handleLockBankerAction: (cardStr) => {
    lockBanker(cardStr).catch((err) => {
      component.setState({ error: err.message });
    });
  },

  handleReverseBankerAction: (card) => {
    reverseBanker(card).catch((err) => {
      component.setState({ error: err.message });
    });
  },

  handleCallTrumpAction: (cardStr) => {
    callTrump(cardStr).catch((err) => {
      component.setState({ error: err.message });
    });
  },

  handleLockTrumpAction: (cardStr) => {
    lockTrump(cardStr).catch((err) => {
      component.setState({ error: err.message });
    });
  },

  handleReverseTrumpAction: (cardStr) => {
    reverseTrump(cardStr).catch((err) => {
      component.setState({ error: err.message });
    });
  },

  handleBuryCardClick: (index, cardStr) => {
    console.log('🏴 handleBuryCardClick:', index, 'cardStr:', cardStr, 'type:', typeof cardStr);
    const { state, props } = component;
    const { buryingSelectedCards } = state;
    const selectedIndex = buryingSelectedCards.findIndex(c => c.index === index);
    if (selectedIndex >= 0) {
      component.setState(prevState => ({
        buryingSelectedCards: prevState.buryingSelectedCards.filter(c => c.index !== index)
      }));
    } else {
      if (buryingSelectedCards.length < 8) {
        component.setState(prevState => ({
          buryingSelectedCards: [...prevState.buryingSelectedCards, {index, cardStr}]
        }));
      }
    }
  },

  handleBuryBottomAction: () => {
    const { state, props } = component;
    const { buryingSelectedCards } = state;
    if (buryingSelectedCards.length !== 8) {
      component.setState({ error: `请选择8张牌，当前已选 ${buryingSelectedCards.length} 张` });
      return;
    }

    const selectedCards = buryingSelectedCards.map(c => c.cardStr);
    console.log('🏴 buryBottom send:', selectedCards, 'types:', selectedCards.map(c => typeof c));
    buryBottom(selectedCards).catch((err) => {
      component.setState({ error: err.message });
    });
    props.setHiddenBottom(selectedCards);
    component.setState({ buryingSelectedCards: [], error: '' });
  }
});

export default { createGameActions };