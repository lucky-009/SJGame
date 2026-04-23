/**
 * 抠底揭示弹窗组件
 */

import React, { Component } from 'react';
import Card from '../Card';
import './BottomRevealModal.css';

class BottomRevealModal extends Component {
    constructor(props) {
        super(props);
        this.autoCloseTimer = null;
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible && !prevProps.visible) {
            if (this.autoCloseTimer) {
                clearTimeout(this.autoCloseTimer);
            }
            this.autoCloseTimer = setTimeout(() => {
                this.props.onClose?.();
            }, 5000);
        }
    }

    componentWillUnmount() {
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }
    }

    parseCardString = (cardStr) => {
        if (!cardStr) return null;
        const parts = cardStr.split('_');
        if (parts.length !== 2) return null;
        const [suit, rank] = parts;
        const displayNames = {
            'spade': '♠', 'heart': '♥', 'club': '♣', 'diamond': '♦', 'joker': '🃏'
        };
        return {
            suit,
            rank,
            displayName: suit === 'joker' ? '🃏' : `${displayNames[suit] || ''}${rank}`
        };
    };

    render() {
        const { visible, bottomCards, winnerTeam, bottomResult, teamAScore, teamBScore } = this.props;

        if (!visible) return null;

        return (
            <div className="bottom-reveal-overlay">
                <div className="bottom-reveal-content">
                    <h2>抠底揭示</h2>

                    <div className="bottom-cards-display">
                        {bottomCards?.map((cardStr, index) => {
                            const card = this.parseCardString(cardStr);
                            return (
                                <Card
                                    key={index}
                                    card={card}
                                    small={false}
                                />
                            );
                        })}
                    </div>

                    <div className="bottom-result">
                        {bottomResult ? (
                            <>
                                <div className="draw-success">
                                    <span className="team-badge">{winnerTeam}队</span>
                                    <span>抠底成功！</span>
                                </div>
                                <div className="draw-detail">
                                    <div>底牌分数: {bottomResult.baseScore}</div>
                                    <div>抠底倍数: ×{bottomResult.multiplier}</div>
                                    <div className="draw-score">+{bottomResult.drawScore}分</div>
                                </div>
                            </>
                        ) : (
                            <div className="no-draw">
                                <span className="team-badge">{winnerTeam}队</span>
                                <span>获胜（庄家获胜，无抠底）</span>
                            </div>
                        )}
                    </div>

                    <div className="score-display">
                        <div className="team-a-score">A队: {teamAScore}</div>
                        <div className="team-b-score">B队: {teamBScore}</div>
                    </div>

                    <div className="auto-continue">5秒后自动继续...</div>
                </div>
            </div>
        );
    }
}

export default BottomRevealModal;
