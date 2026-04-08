/**
 * 扑克牌组件
 */

import React, { Component } from 'react';
import './Card.css';

class Card extends Component {
  /**
   * Props:
   * - card: { suit, rank, displayName }
   * - selected: 是否被选中
   * - disabled: 是否禁用
   * - onClick: 点击回调
   * - small: 是否小牌（桌面展示）
   * - faceDown: 是否扣牌
   */

  constructor(props) {
    super(props);
    this.lastClickedIndex = null;
  }

  handleClick = (e) => {
    const { disabled, onClick, card, index } = this.props;
    if (!disabled && onClick) {
      // 支持Ctrl/Cmd键多选
      if (e.ctrlKey || e.metaKey) {
        // 多选模式
        this.handleMultiSelect(card, index);
      } else {
        // 单选模式
        onClick(card, index);
        this.lastClickedIndex = index;
      }
    }
  };

  handleMultiSelect = (card, index) => {
    const { onClick } = this.props;
    // 多选模式：调用onClick并传入多选标志
    onClick(card, index, true);
  };

  // 获取花色对应的 CSS 类
  getSuitClass = () => {
    const { card } = this.props;
    if (card.suit === 'joker') {
      return card.rank === 'big' ? 'joker-big' : 'joker-small';
    }
    return `suit-${card.suit}`;
  };

  // 获取牌的显示内容
  getCardContent = () => {
    const { card } = this.props;
    
    if (card.suit === 'joker') {
      return null; // 使用 CSS ::after 伪元素显示
    }
    
    const suitSymbol = {
      spade: '♠',
      heart: '♥',
      club: '♣',
      diamond: '♦'
    };
    
    return (
      <span className="card-content">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{suitSymbol[card.suit]}</span>
      </span>
    );
  };

  render() {
    const { selected, disabled, small, faceDown, card } = this.props;
    
    const classes = [
      'card',
      this.getSuitClass(),
      selected ? 'selected' : '',
      disabled ? 'disabled' : '',
      small ? 'small' : '',
      faceDown ? 'face-down' : ''
    ].filter(Boolean).join(' ');

    return (
      <div 
        className={classes} 
        onClick={this.handleClick}
      >
        {faceDown ? (
          <div className="card-back"></div>
        ) : (
          this.getCardContent()
        )}
      </div>
    );
  }
}

export default Card;
