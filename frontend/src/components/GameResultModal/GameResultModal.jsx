/**
 * 单局结算弹窗组件
 */

import React, { Component } from 'react';
import './GameResultModal.css';

class GameResultModal extends Component {
    constructor(props) {
        super(props);
        this.autoCloseTimer = null;
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible && !prevProps.visible) {
            if (this.autoCloseTimer) {
                clearTimeout(this.autoCloseTimer);
            }
            const autoCloseTime = this.props.autoClose || 3000;
            this.autoCloseTimer = setTimeout(() => {
                this.props.onClose?.();
            }, autoCloseTime);
        }
    }

    componentWillUnmount() {
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }
    }

    getMyTeam = () => {
        return this.props.mySeatIndex % 2 === 0 ? 'A' : 'B';
    };

    render() {
        const {
            visible,
            winnerTeam,
            teamAScore,
            teamBScore,
            levelChange,
            newLevelA,
            newLevelB,
            gameWinner
        } = this.props;

        if (!visible) return null;

        const myTeam = this.getMyTeam();
        const isMyTeamWin = winnerTeam === myTeam;
        const isGameOver = gameWinner !== null && gameWinner !== undefined;

        return (
            <div className="game-result-overlay">
                <div className="game-result-content">
                    <h2>{isGameOver ? '游戏结束' : '单局结算'}</h2>

                    <div className={`winner-text ${isMyTeamWin ? 'win' : 'lose'}`}>
                        {winnerTeam}队获胜
                        <span className="team-tag">{isMyTeamWin ? '我方' : '对方'}</span>
                    </div>

                    <div className="score-detail">
                        <div className="score-row">
                            <span className="team-label">A队:</span>
                            <span className={`team-score ${winnerTeam === 'A' ? 'highlight' : ''}`}>
                                {teamAScore}
                            </span>
                        </div>
                        <div className="score-row">
                            <span className="team-label">B队:</span>
                            <span className={`team-score ${winnerTeam === 'B' ? 'highlight' : ''}`}>
                                {teamBScore}
                            </span>
                        </div>
                    </div>

                    <div className="level-change-section">
                        <div className="level-change-badge">
                            {levelChange > 0 ? `+${levelChange}` : levelChange} 级
                        </div>
                        <div className="level-detail">
                            <div className="level-row">
                                <span className="level-team">A队:</span>
                                <span className="level-value">{newLevelA}级</span>
                            </div>
                            <div className="level-row">
                                <span className="level-team">B队:</span>
                                <span className="level-value">{newLevelB}级</span>
                            </div>
                        </div>
                    </div>

                    <div className="auto-continue">
                        {isGameOver ? '查看结果...' : `${Math.ceil((this.props.autoClose || 3000) / 1000)}秒后自动继续...`}
                    </div>
                </div>
            </div>
        );
    }
}

export default GameResultModal;
