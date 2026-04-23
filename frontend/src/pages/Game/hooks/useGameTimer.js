import { skipDrawBottom, removeAllListeners } from '../../../services/socket';

/**
 * 计时器 Hook
 * 封装游戏计时器逻辑
 */

export const useGameTimer = (component) => ({
  startTimer: () => {
    const { props } = component;
    component.clearTimer();
    component.timerInterval = setInterval(() => {
      props.decrementTime();
    }, 1000);
  },

  clearTimer: () => {
    if (component.timerInterval) {
      clearInterval(component.timerInterval);
      component.timerInterval = null;
    }
  },

  startDrawBottomTimer: (seconds) => {
    const { props } = component;
    component.clearDrawBottomTimer();
    component.drawBottomTimer = setInterval(() => {
      const current = props.drawBottom?.timeout;
      if (current <= 1) {
        component.clearDrawBottomTimer();
        skipDrawBottom();
      } else {
        props.setDrawBottomState({ timeout: current - 1 });
      }
    }, 1000);
  },

  clearDrawBottomTimer: () => {
    if (component.drawBottomTimer) {
      clearInterval(component.drawBottomTimer);
      component.drawBottomTimer = null;
    }
  }
});

export default { useGameTimer };