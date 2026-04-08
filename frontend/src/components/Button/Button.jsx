/**
 * 按钮组件
 */

import React, { Component } from 'react';
import './Button.css';

class Button extends Component {
  /**
   * Props:
   * - children: 按钮文字
   * - onClick: 点击回调
   * - disabled: 是否禁用
   * - variant: 按钮类型 (primary/default/danger/success)
   * - size: 按钮大小 (small/medium/large)
   * - className: 额外样式类
   */

  handleClick = (e) => {
    const { disabled, onClick } = this.props;
    
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  render() {
    const {
      children,
      disabled,
      variant = 'default',
      size = 'medium',
      className = '',
      ...restProps
    } = this.props;

    const classes = [
      'custom-button',
      `btn-${variant}`,
      `btn-${size}`,
      disabled ? 'disabled' : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        className={classes}
        disabled={disabled}
        onClick={this.handleClick}
        {...restProps}
      >
        {children}
      </button>
    );
  }
}

export default Button;
