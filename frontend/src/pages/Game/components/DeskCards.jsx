import React from 'react';
import Card from '../../../components/Card';
import { getSeatPosition } from '../utils/gameUtils';

/**
 * 桌面牌区域组件
 * 渲染所有玩家打出的牌
 */
const DeskCards = ({ deskCards, mySeatIndex }) => {
  return (
    <div className="desk-area">
      {Object.entries(deskCards).map(([seatIndex, cards]) => {
        if (!cards || cards.length === 0) return null;

        const position = getSeatPosition(parseInt(seatIndex), mySeatIndex);

        return (
          <div key={seatIndex} className={`desk-cards desk-${position}`}>
            {cards.map((card, i) => (
              <Card
                key={i}
                card={card}
                small
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default DeskCards;