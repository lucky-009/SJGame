import React, { useMemo } from 'react';
import Card from '../../../components/Card';
import { parseCardString, sortHandCards } from '../utils/gameUtils';
import { GAME_PHASES } from '../../../utils/constants';
import './HandCards.css';

const HandCards = ({
  myHands,
  selectedCards,
  isMyTurn,
  phase,
  buryingSelectedCards = [],
  onCardClick,
  onBuryCardClick
}) => {
  const isBuryingPhase = phase === GAME_PHASES.BOTTOMING;

  const sortedHands = useMemo(() => {
    if (!myHands || !Array.isArray(myHands) || myHands.length === 0) return [];
    return sortHandCards(myHands);
  }, [myHands]);

  const displayHands = useMemo(() => {
    return sortedHands.map((card, index) => {
      const cardStr = typeof card === 'string' ? card : (card?.cardStr || null);
      const parsed = cardStr ? parseCardString(cardStr) : card;
      return { ...parsed, cardStr, index };
    });
  }, [sortedHands]);

  const handleClick = (card, index, isBurying) => {
    if (isBurying) {
      onBuryCardClick?.(index, card.cardStr);
    } else {
      onCardClick?.(card, index);
    }
  };

  return (
    <div className="hand-cards">
      {displayHands.map((card, index) => {
        const isSelected = isBuryingPhase
          ? buryingSelectedCards.some(c => c.index === index)
          : selectedCards.includes(index);

        return (
          <div
            key={card.cardStr + index}
            className={`card-wrapper ${isSelected ? 'selected' : ''}`}
          >
            <Card
              card={card}
              index={index}
              selected={isSelected}
              disabled={!isMyTurn}
              onClick={() => handleClick(card, index, isBuryingPhase)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default HandCards;