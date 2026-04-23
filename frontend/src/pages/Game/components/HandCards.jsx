import React from 'react';
import Card from '../../../components/Card';
import { parseCardString, sortHandCards } from '../utils/gameUtils';
import { GAME_PHASES } from '../../../utils/constants';

/**
 * 手牌区域组件
 * 渲染玩家的手牌，包含选牌和埋底选牌逻辑
 */
const HandCards = ({
  myHands,
  selectedCards,
  isMyTurn,
  phase,
  buryingSelectedCards = [],
  onCardClick,
  onBuryCardClick
}) => {
  const sortedHands = sortHandCards(myHands);

  const parsedHands = sortedHands.map((card, index) => {
    const cardStr = typeof card === 'string' ? card : (card?.cardStr || null);
    const parsed = cardStr ? parseCardString(cardStr) : card;
    return {...parsed, id: index, cardStr};
  });

  const isBuryingPhase = phase === GAME_PHASES.BOTTOMING;

  return (
    <div className="hand-cards">
      {parsedHands.map((card, index) => {
        const isSelected = isBuryingPhase
          ? buryingSelectedCards.some(c => c.index === index)
          : selectedCards.includes(index);

        const handleClick = isBuryingPhase
          ? () => onBuryCardClick(index, card.cardStr)
          : (card, idx) => onCardClick(card, idx);

        return (
          <Card
            key={card.id || index}
            card={card}
            index={index}
            selected={isSelected}
            disabled={!isMyTurn}
            onClick={handleClick}
          />
        );
      })}
    </div>
  );
};

export default HandCards;
