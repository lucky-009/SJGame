import React, { Component } from 'react';
import Button from '../../../components/Button';
import { GAME_PHASES, SUIT_NAMES, RED_SUITS } from '../../../utils/constants';
import { parseCardString } from '../utils/gameUtils';

const SUITS = ['spade', 'heart', 'club', 'diamond'];

class ActionPanel extends Component {
  state = {
    suitSelection: null
  };

  handleDrawOptionClick = (option) => {
    const { onDrawBottomOptionClick } = this.props;

    if (option.type === 'hearts5_pair') {
      this.setState({ suitSelection: option });
    } else {
      onDrawBottomOptionClick(option);
    }
  };

  handleSuitClick = (suit) => {
    const { suitSelection } = this.state;
    const { onDrawBottomOptionClick } = this.props;

    if (suitSelection) {
      onDrawBottomOptionClick({
        ...suitSelection,
        chosenSuit: suit
      });
      this.setState({ suitSelection: null });
    }
  };

  handleCancelSuit = () => {
    this.setState({ suitSelection: null });
  };

  renderCardButtons = (cards, onClick) => {
    if (!cards || cards.length === 0) return null;
    const uniqueCards = [...new Set(cards)];

    return (
      <div className="card-buttons">
        {uniqueCards.map((cardStr, index) => {
          const card = parseCardString(cardStr);
          const suitDisplay = card ? (
            <span className={RED_SUITS.includes(card.suit) ? 'red-suit' : ''}>
              {SUIT_NAMES[card.suit]}{card.rank}
            </span>
          ) : cardStr;
          return (
            <Button
              key={index}
              variant="warning"
              size="large"
              onClick={() => onClick(cardStr)}
            >
              {suitDisplay}
            </Button>
          );
        })}
      </div>
    );
  };

  renderLockBankerButtons = (cards, onClick) => {
    if (!cards || cards.length === 0) return null;
    const suitToCards = new Map();
    cards.forEach(cardStr => {
      const card = parseCardString(cardStr);
      if (card && !suitToCards.has(card.suit)) {
        suitToCards.set(card.suit, cardStr);
      }
    });

    return (
      <div className="card-buttons">
        {Array.from(suitToCards.entries()).map(([suit, cardStr], index) => (
          <Button
            key={index}
            variant="warning"
            size="large"
            onClick={() => onClick(cardStr)}
          >
            锁庄 <span className={RED_SUITS.includes(suit) ? 'red-suit' : ''}>{SUIT_NAMES[suit]}</span>
          </Button>
        ))}
      </div>
    );
  };

  renderLockTrumpButtons = (cards, onClick) => {
    if (!cards || cards.length === 0) return null;
    const suitToCards = new Map();
    cards.forEach(cardStr => {
      const card = parseCardString(cardStr);
      if (card && !suitToCards.has(card.suit)) {
        suitToCards.set(card.suit, cardStr);
      }
    });

    return (
      <div className="card-buttons">
        {Array.from(suitToCards.entries()).map(([suit, cardStr], index) => (
          <Button
            key={index}
            variant="warning"
            size="large"
            onClick={() => onClick(cardStr)}
          >
            锁主 <span className={RED_SUITS.includes(suit) ? 'red-suit' : ''}>{SUIT_NAMES[suit]}</span>
          </Button>
        ))}
      </div>
    );
  };

  renderSuitSelection = () => {
    const { suitSelection } = this.state;
    if (!suitSelection) return null;

    return (
      <div className="suit-selection">
        <div className="suit-selection-title">
          选择主花色: {suitSelection.label}
        </div>
        <div className="suit-buttons">
          {SUITS.map(suit => (
            <Button
              key={suit}
              variant="primary"
              size="large"
              onClick={() => this.handleSuitClick(suit)}
            >
              <span className={RED_SUITS.includes(suit) ? 'red-suit' : ''}>
                {SUIT_NAMES[suit]}
              </span>
            </Button>
          ))}
        </div>
        <Button
          variant="default"
          size="large"
          onClick={this.handleCancelSuit}
        >
          取消
        </Button>
      </div>
    );
  };

  render() {
    const {
      phase,
      isMyTurn,
      canCallBanker,
      canCallTrump,
      canLockBanker,
      canReverseBanker,
      canLockTrump,
      canReverseTrump,
      selectedCards,
      availableBankerCards,
      availableTrumpCards,
      availableReverseCards,
      drawBottom,
      leadPlayCardCount,
      currentAction,
      error,
      buryingSelectedCards,
      drawInfo,
      onPlayCards,
      onClearSelection,
      onCallBanker,
      onLockBanker,
      onReverseBanker,
      onCallTrump,
      onLockTrump,
      onReverseTrump,
      onBuryBottom,
      onSkipDrawBottom
    } = this.props;

    const { suitSelection } = this.state;
    const needLimitCount = leadPlayCardCount > 0;
    const canPlay = isMyTurn &&
      phase === GAME_PHASES.PLAYING &&
      selectedCards.length > 0 &&
      (!needLimitCount || selectedCards.length === leadPlayCardCount);

    return (
      <div className="action-panel">
        {error && <div className="error-message">{error}</div>}

        {phase === GAME_PHASES.PLAYING && isMyTurn && (
          <>
            <Button
              variant="primary"
              size="large"
              disabled={!canPlay}
              onClick={onPlayCards}
            >
              出牌 {needLimitCount ? `(${selectedCards.length}/${leadPlayCardCount})` : `(${selectedCards.length})`}
            </Button>
            <Button
              variant="default"
              size="large"
              onClick={onClearSelection}
              disabled={selectedCards.length === 0}
            >
              取消
            </Button>
          </>
        )}

        {(currentAction === 'call_banker' || canCallBanker) && this.renderCardButtons(availableBankerCards, onCallBanker)}

        {canLockBanker && this.renderLockBankerButtons(availableBankerCards, onLockBanker)}

        {canReverseBanker && availableReverseCards?.card && (
          <Button
            variant="warning"
            size="large"
            onClick={() => onReverseBanker(availableReverseCards.card)}
          >
            反庄 <span className={RED_SUITS.includes(availableReverseCards.card.suit) ? 'red-suit' : ''}>{SUIT_NAMES[availableReverseCards.card.suit]}</span>
          </Button>
        )}

        {(currentAction === 'call_trump' || canCallTrump) && this.renderCardButtons(availableTrumpCards, onCallTrump)}

        {canLockTrump && this.renderLockTrumpButtons(availableTrumpCards, onLockTrump)}

        {canReverseTrump && availableReverseCards?.cards && this.renderCardButtons(availableReverseCards.cards, onReverseTrump)}

        {phase === GAME_PHASES.BOTTOMING && isMyTurn && (
          <>
            {drawInfo && (
              <div className="draw-bottom-info">
                <span>刚才抄底: {drawInfo.drawCards?.join('')} → 主花色: {drawInfo.mainSuit || '无主'}</span>
              </div>
            )}
            <Button
              variant="success"
              size="large"
              disabled={buryingSelectedCards.length !== 8}
              onClick={onBuryBottom}
            >
              埋底 ({buryingSelectedCards.length}/8)
            </Button>
          </>
        )}

        {drawBottom.isActive && drawBottom.canDraw && drawBottom.drawableOptions && !suitSelection && (
          <div className="draw-bottom-actions">
            <div className="draw-bottom-title">
              是否抄底？ 剩余 {drawBottom.timeout} 秒
            </div>
            {drawBottom.drawableOptions.map((option, idx) => (
              <Button
                key={idx}
                variant="primary"
                size="large"
                onClick={() => this.handleDrawOptionClick(option)}
              >
                {option.label}
              </Button>
            ))}
            <Button
              variant="default"
              size="large"
              onClick={onSkipDrawBottom}
            >
              放弃
            </Button>
          </div>
        )}

        {suitSelection && this.renderSuitSelection()}

        {drawBottom.isActive && !drawBottom.canDraw && (
          <div className="draw-bottom-waiting">
            玩家 {drawBottom.currentAsker} 正在选择是否抄底...
          </div>
        )}
      </div>
    );
  }
}

export default ActionPanel;