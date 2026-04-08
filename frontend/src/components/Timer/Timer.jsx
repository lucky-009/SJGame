/**
 * 倒计时组件
 */

import React, { Component } from 'react';
import './Timer.css';

class Timer extends Component {
  /**
   * Props:
   * - seconds: 剩余秒数
   * - totalSeconds: 总秒数（默认30秒）
   * - onTimeout: 超时回调
   * - isActive: 是否激活
   */

  constructor(props) {
    super(props);
    this.timer = null;
  }

  componentDidMount() {
    if (this.props.isActive) {
      this.startTimer();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.isActive && !prevProps.isActive) {
      this.startTimer();
    } else if (!this.props.isActive && prevProps.isActive) {
      this.stopTimer();
    }
  }

  componentWillUnmount() {
    this.stopTimer();
  }

  startTimer = () => {
    this.stopTimer();
    this.timer = setInterval(() => {
      const { seconds, onTimeout } = this.props;
      
      if (seconds <= 1) {
        this.stopTimer();
        if (onTimeout) {
          onTimeout();
        }
      }
    }, 1000);
  };

  stopTimer = () => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  render() {
    const { seconds, totalSeconds = 30, isActive } = this.props;
    
    if (!isActive) {
      return null;
    }

    const percentage = (seconds / totalSeconds) * 100;
    const isLow = seconds <= 5;

    return (
      <div className={`timer ${isLow ? 'low-time' : ''}`}>
        <div className="timer-bar">
          <div 
            className="timer-progress" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="timer-text">
          {seconds}s
        </div>
      </div>
    );
  }
}

export default Timer;
