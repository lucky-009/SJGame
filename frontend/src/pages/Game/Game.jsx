/**
 * 游戏页 - 核心对局
 * 对接 API.md Socket 事件
 */

import React, {Component} from 'react';
import {connect} from 'react-redux';
import {useNavigate, useParams} from 'react-router-dom';
import {
    // 服务端推送事件
    onDealComplete,
    onYourTurn,
    onCardPlayed,
    onTurnResult,
    onRoundResult,
    onGameOver,
    onPlayingStart,
    onBottomDrawn,
    onBottomBuried,
    onBankerCalled,
    onTrumpCalled,
    onTrumpReversed,
    onPlayPenalty,
    // 新增发牌过程事件
    onDealStart,
    onCardDealt,
    onHandUpdated,
    onCanCallBanker,
    onCanLockBanker,
    onCanReverseBanker,
    onCanCallTrump,
    onCanLockTrump,
    onCanReverseTrump,
    onBidStateChanged,
    onBidRejected,
    onBankerLocked,
    // 重新发牌事件
    onRedealTriggered,
    onRedealStart,
    onRedealComplete,
    onRedealFailed,
    onBidTimeout,
    // 抄底阶段事件
    onAskDrawBottom,
    onDrawBottomSuccess,
    onDrawBottomFailed,
    onDrawBottomTimeout,
    onDrawBottomSkipped,
    onDrawBottomComplete,
    onDrawBottomFatal,
    // 客户端发送事件
    playCards,
    callBanker,
    lockBanker,
    reverseBanker,
    callTrump,
    lockTrump,
    reverseTrump,
    buryBottom,
    takeBottom,
    skipDrawBottom,
    removeAllListeners
} from '../../services/socket';
import {
    setPhase,
    setMyHands,
    removeCards,
    toggleCardSelection,
    clearSelection,
    setTurnSeatIndex,
    addDeskCard,
    clearDeskCards,
    setLeadSeatIndex,
    setBanker,
    setMainSuit,
    setCurrentLevel,
    setTeamLevel,
    addTeamScore,
    resetRoundScore,
    setBottomCards,
    setBidState,
    setLeadSuit,
    setTimeLeft,
    decrementTime,
    setRoundResult,
    setGameResult,
    setCanCallBanker,
    setCanCallTrump,
    setCanLockBanker,
    setCanReverseBanker,
    setCanLockTrump,
    setCanReverseTrump,
    setAvailableBankerCards,
    setAvailableTrumpCards,
    setAvailableReverseCards,
    setIsMyTurn,
    setDeskCards,
    setHiddenBottom,
    initRound,
    setDealProgress,
    setBidStateInfo,
    clearDealingActions,
    setDrawBottomState,
    clearDrawBottomState,
    resetGame,
    setRemainingCards,
    setPlayerCardCounts
} from '../../store/gameSlice';
import {updatePlayers} from '../../store/roomSlice';
import {GAME_PHASES, SUITS, TEAMS, SUIT_NAMES, GAME_ACTIONS} from '../../utils/constants';
import ruleEngine from '../../ruleEngine';
import Card from '../../components/Card';
import PlayerInfo from '../../components/PlayerInfo';
import Timer from '../../components/Timer';
import Button from '../../components/Button';
import './Game.css';

/**
 * 游戏组件
 */
class Game extends Component {
    constructor(props) {
        super(props);
        this.timerInterval = null;
        this.state = {
            showBidModal: false,
            showBottomModal: false,
            showTakeBottomModal: false,
            bottomSelection: [], // 存储选中的牌的索引
            buryingSelectedCards: [], // 存储选中的牌本身
            currentAction: null, // 当前操作类型
            error: ''
        };
    }

    componentDidMount() {
        this.setupSocketListeners();
    }

    componentWillUnmount() {
        this.clearTimer();
        this.clearDrawBottomTimer();
        removeAllListeners();
    }

    /**
     * 设置 Socket 监听（对接 API.md）
     */
    setupSocketListeners = () => {
        // 发牌完成
        // 事件: game:deal_complete
        onDealComplete((data) => {
            this.handleDealComplete(data);
        });

        // 轮到你操作
        // 事件: game:your_turn
        onYourTurn((data) => {
            this.handleYourTurn(data);
        });

        // 出牌通知
        // 事件: game:card_played
        onCardPlayed((data) => {
            this.handleCardPlayed(data);
        });

        // 回合结果
        // 事件: game:turn_result
        onTurnResult((data) => {
            this.handleTurnResult(data);
        });

        // 单局结果
        // 事件: game:round_result
        onRoundResult((data) => {
            this.handleRoundResult(data);
        });

        // 游戏结束
        // 事件: game:game_over
        onGameOver((data) => {
            this.handleGameOver(data);
        });

        // 出牌阶段开始
        // 事件: game:playing_start
        onPlayingStart((data) => {
            this.handlePlayingStart(data);
        });

        // 补底通知
        // 事件: game:bottom_drawn
        onBottomDrawn((data) => {
            this.handleBottomDrawn(data);
        });

        // 埋底完成
        // 事件: game:bottom_buried
        onBottomBuried((data) => {
            this.handleBottomBuried(data);
        });

        // 抢庄通知
        // 事件: game:banker_called
        onBankerCalled((data) => {
            this.handleBankerCalled(data);
        });

        // 抢主通知
        // 事件: game:trump_called
        onTrumpCalled((data) => {
            this.handleTrumpCalled(data);
        });

        // 反主通知
        // 事件: game:trump_reversed
        onTrumpReversed((data) => {
            this.handleTrumpReversed(data);
        });

        // 罚分通知
        // 事件: game:play_penalty
        onPlayPenalty((data) => {
            this.handlePlayPenalty(data);
        });

        // ===== 新增发牌过程事件监听 =====

        // 开始发牌
        // 事件: game:deal_start
        onDealStart((data) => {
            this.handleDealStart(data);
        });

        // 单张发牌
        // 事件: game:card_dealt
        onCardDealt((data) => {
            this.handleCardDealt(data);
        });

        // 手牌更新
        // 事件: game:hand_updated
        onHandUpdated((data) => {
            this.handleHandUpdated(data);
        });

        // 可以抢庄
        // 事件: game:can_call_banker
        onCanCallBanker((data) => {
            this.handleCanCallBanker(data);
        });

        // 可以锁庄
        // 事件: game:can_lock_banker
        onCanLockBanker((data) => {
            this.handleCanLockBanker(data);
        });

        // 可以反庄
        // 事件: game:can_reverse_banker
        onCanReverseBanker((data) => {
            this.handleCanReverseBanker(data);
        });

        // 可以抢主色
        // 事件: game:can_call_trump
        onCanCallTrump((data) => {
            this.handleCanCallTrump(data);
        });

        // 可以锁主色
        // 事件: game:can_lock_trump
        onCanLockTrump((data) => {
            this.handleCanLockTrump(data);
        });

        // 可以反主色
        // 事件: game:can_reverse_trump
        onCanReverseTrump((data) => {
            this.handleCanReverseTrump(data);
        });

        // 投标状态变化
        // 事件: game:bid_state_changed
        onBidStateChanged((data) => {
            this.handleBidStateChanged(data);
        });

        // 操作被拒绝
        // 事件: game:bid_rejected
        onBidRejected((data) => {
            this.handleBidRejected(data);
        });

        // 投标超时（10秒倒计时结束）
        // 事件: game:bid_timeout
        onBidTimeout((data) => {
            this.handleBidTimeout(data);
        });

        onBankerLocked((data) => {
            this.handleBankerLocked()
        });

        // ===== 重新发牌事件监听 =====

        // 重新发牌触发
        // 事件: game:redeal_triggered
        onRedealTriggered((data) => {
            this.handleRedealTriggered(data);
        });

        // 重新发牌开始
        // 事件: game:redeal_start
        onRedealStart((data) => {
            this.handleRedealStart(data);
        });

        // 重新发牌完成
        // 事件: game:redeal_complete
        onRedealComplete((data) => {
            this.handleRedealComplete(data);
        });

        // 重新发牌失败
        // 事件: game:redeal_failed
        onRedealFailed((data) => {
            this.handleRedealFailed(data);
        });

        // ===== 抄底阶段事件监听 =====

        // 询问抄底
        // 事件: game:ask_draw_bottom
        onAskDrawBottom((data) => {
            this.handleAskDrawBottom(data);
        });

        // 抄底成功
        // 事件: game:draw_bottom_success
        onDrawBottomSuccess((data) => {
            this.handleDrawBottomSuccess(data);
        });

        // 抄底失败
        // 事件: game:draw_bottom_failed
        onDrawBottomFailed((data) => {
            this.handleDrawBottomFailed(data);
        });

        // 抄底超时放弃
        // 事件: game:draw_bottom_timeout
        onDrawBottomTimeout((data) => {
            this.handleDrawBottomTimeout(data);
        });

        // 玩家放弃抄底
        // 事件: game:draw_bottom_skipped
        onDrawBottomSkipped((data) => {
            this.handleDrawBottomSkipped(data);
        });

        // 抄底阶段完成
        // 事件: game:draw_bottom_complete
        onDrawBottomComplete((data) => {
            this.handleDrawBottomComplete(data);
        });

        // 抄底阶段致命错误（A级底牌有分）
        // 事件: game:draw_bottom_fatal
        onDrawBottomFatal((data) => {
            this.handleDrawBottomFatal(data);
        });
    };

    /**
     * 处理开始发牌
     * 事件: game:deal_start
     */
    handleDealStart = (data) => {
        console.log('🎴 开始发牌:', data);
        const {totalCards, isFirstRound, level} = data;
        this.props.setDealProgress({
            isDealing: true,
            current: 0,
            total: totalCards
        });
        this.props.setCurrentLevel(level);
        this.props.setPhase(GAME_PHASES.DEALING);
        this.props.setRemainingCards(totalCards);
        // 重置回合状态，发牌阶段不显示倒计时
        this.props.setTurnSeatIndex(-1);
        this.props.setIsMyTurn(false);
        // 清除上局的结果显示
        this.props.setRoundResult(null);
    };

    /**
     * 处理单张发牌
     * 事件: game:card_dealt
     */
    handleCardDealt = (data) => {
        const {cardIndex, totalCards} = data;
        this.props.setDealProgress({
            isDealing: true,
            current: cardIndex,
            total: totalCards
        });
        // 更新牌堆剩余张数
        this.props.setRemainingCards(totalCards - cardIndex - 1);
    };

    /**
     * 处理手牌更新
     * 事件: game:hand_updated
     */
    handleHandUpdated = (data) => {
        const {handCards, seatIndex} = data;
        const {mySeatIndex} = this.props;
        if (seatIndex === mySeatIndex) {
            this.props.setMyHands(handCards);
        }
    };

    /**
     * 处理可以抢庄
     * 事件: game:can_call_banker
     */
    handleCanCallBanker = (data) => {
        console.log('🎯 可以抢庄:', data, 'mySeatIndex:', this.props.mySeatIndex);
        const {seatIndex, level, availableCards} = data;
        const {mySeatIndex} = this.props;
        this.props.setCanCallBanker(true);
        this.props.setAvailableBankerCards(availableCards || []);
        this.props.setIsMyTurn(true);
        this.props.setTurnSeatIndex(mySeatIndex);
    };

    /**
     * 处理可以锁庄
     * 事件: game:can_lock_banker
     */
    handleCanLockBanker = (data) => {
        console.log('🎯 可以锁庄:', data, 'mySeatIndex:', this.props.mySeatIndex);
        const {seatIndex, availableCards} = data;
        const {mySeatIndex} = this.props;
        this.props.setCanLockBanker(true);
        if (availableCards && availableCards.length > 0) {
            this.props.setAvailableBankerCards(availableCards);
        }
        this.props.setIsMyTurn(true);
        this.props.setTurnSeatIndex(mySeatIndex);
    };

    /**
     * 处理可以反庄
     * 事件: game:can_reverse_banker
     */
    handleCanReverseBanker = (data) => {
        console.log('🎯 可以反庄:', data, 'mySeatIndex:', this.props.mySeatIndex);
        const {seatIndex, suit, card} = data;
        const {mySeatIndex} = this.props;
        this.props.setCanReverseBanker(true);
        this.props.setAvailableReverseCards({type: 'banker', suit: suit, card: card});
        this.props.setIsMyTurn(true);
        this.props.setTurnSeatIndex(mySeatIndex);
    };

    /**
     * 处理可以抢主色
     * 事件: game:can_call_trump
     */
    handleCanCallTrump = (data) => {
        console.log('🎯 可以抢主色:', data, 'mySeatIndex:', this.props.mySeatIndex);
        const {seatIndex, level, availableCards} = data;
        const {mySeatIndex} = this.props;
        this.props.setCanCallTrump(true);
        this.props.setAvailableTrumpCards(availableCards || []);
        this.props.setIsMyTurn(true);
        this.props.setTurnSeatIndex(mySeatIndex);
    };

    /**
     * 处理可以锁主色
     * 事件: game:can_lock_trump
     */
    handleCanLockTrump = (data) => {
        console.log('🎯 可以锁主色:', data, 'mySeatIndex:', this.props.mySeatIndex);
        const {seatIndex, availableCards} = data;
        const {mySeatIndex} = this.props;
        this.props.setCanLockTrump(true);
        if (availableCards && availableCards.length > 0) {
            this.props.setAvailableTrumpCards(availableCards);
        }
        this.props.setIsMyTurn(true);
        this.props.setTurnSeatIndex(mySeatIndex);
    };

    /**
     * 处理可以反主色
     * 事件: game:can_reverse_trump
     */
    handleCanReverseTrump = (data) => {
        console.log('🎯 可以反主色:', data, 'mySeatIndex:', this.props.mySeatIndex);
        const {seatIndex, availablePairs} = data;
        const {mySeatIndex} = this.props;
        this.props.setCanReverseTrump(true);
        this.props.setAvailableReverseCards({type: 'trump', cards: availablePairs});
        this.props.setIsMyTurn(true);
        this.props.setTurnSeatIndex(mySeatIndex);
    };

    /**
     * 处理投标状态变化
     * 事件: game:bid_state_changed
     */
    handleBidStateChanged = (data) => {
        console.log('📊 投标状态变化:', data);
        const {hasBanker, bankerSeat, hasTrump, trumpSuit, isLocked, trumpCallerSeat} = data;
        this.props.setBidStateInfo({
            hasBanker,
            bankerSeat,
            hasTrump,
            trumpSuit,
            isLocked,
            trumpCallerSeat
        });
        // 更新主花色
        if (trumpSuit) {
            this.props.setMainSuit(trumpSuit);
        }
    };

    /**
     * 处理操作被拒绝
     * 事件: game:bid_rejected
     */
    handleBidRejected = (data) => {
        console.log('❌ 操作被拒绝:', data);
        const {reason} = data;
        this.setState({error: reason});
    };

    /**
     * 处理投标超时（10秒倒计时结束）
     * 事件: game:bid_timeout
     */
    handleBidTimeout = (data) => {
        console.log('⏰ 投标超时:', data);
        // 清除所有发牌过程中的操作按钮
        this.props.clearDealingActions();
    };

    /*
    * 有玩家锁庄
    * */
    handleBankerLocked = (data) => {
        console.log('⏰ 玩家锁庄:', data);
    }

    /**
     * 处理重新发牌触发
     * 事件: game:redeal_triggered
     */
    handleRedealTriggered = (data) => {
        console.log('🔄 重新发牌触发:', data);
        const {reason, lowScorePlayers} = data;

        // 显示提示信息
        this.setState({
            error: `重新发牌：${reason}，以下玩家手牌总分不足20分：${lowScorePlayers.map(p => `${p.username}(${p.score}分)`).join(', ')}`
        });

        // 清除所有玩家的手牌和选中状态
        this.props.setMyHands([]);
        this.props.clearSelection();
        this.props.setPhase(GAME_PHASES.DEALING);
    };

    /**
     * 处理重新发牌开始
     * 事件: game:redeal_start
     */
    handleRedealStart = (data) => {
        console.log('🔄 开始重新发牌:', data);
        const {message} = data;

        // 更新发牌进度
        this.props.setDealProgress({
            isDealing: true,
            current: 0,
            total: 100
        });

        // 清除所有玩家的手牌和选中状态
        this.props.setMyHands([]);
        this.props.clearSelection();
        this.props.setPhase(GAME_PHASES.DEALING);
        this.props.setMainSuit('');
        this.props.setBidState({
            currentBidder: -1,
            bidSuit: '',
            isLocked: false
        });

        // 显示重新发牌提示
        this.setState({error: message});
    };

    /**
     * 处理重新发牌完成
     * 事件: game:redeal_complete
     */
    handleRedealComplete = (data) => {
        console.log('🔄 重新发牌完成:', data);
        const {message} = data;

        // 更新发牌进度
        this.props.setDealProgress({
            isDealing: false,
            current: 100,
            total: 100
        });

        // 设置阶段为抢庄/抢主
        this.props.setPhase(GAME_PHASES.DEALEND);

        // 清除错误提示
        this.setState({error: ''});

        console.log('重新发牌流程完成');
    };

    /**
     * 处理重新发牌失败
     * 事件: game:redeal_failed
     */
    handleRedealFailed = (data) => {
        console.log('❌ 重新发牌失败:', data);
        const {message, lowScorePlayers} = data;

        // 强制开始游戏，清除手牌和操作按钮
        this.props.setMyHands([]);
        this.props.clearSelection();
        this.props.setPhase(GAME_PHASES.DEALING);

        // 显示失败信息
        this.setState({
            error: `重新发牌失败：${message}。玩家：${lowScorePlayers.map(p => `${p.username}(${p.score}分)`).join(', ')}`
        });
    };

    // ===== 抄底阶段事件处理 =====

    /**
     * 处理询问抄底
     * 事件: game:ask_draw_bottom
     */
    handleAskDrawBottom = (data) => {
        console.log('🎯 询问抄底:', data);
        const {seatIndex, timeout, drawableOptions, currentMainSuit, isNoTrump} = data;
        const mySeatIndex = this.props.seatIndex;

        this.props.setDrawBottomState({
            isActive: true,
            currentAsker: seatIndex,
            canDraw: seatIndex === mySeatIndex,
            timeout: timeout,
            drawableOptions: drawableOptions
        });

        // 启动倒计时
        this.startDrawBottomTimer(timeout);
    };

    /**
     * 启动抄底倒计时
     */
    startDrawBottomTimer = (seconds) => {
        this.clearDrawBottomTimer();
        this.drawBottomTimer = setInterval(() => {
            const current = this.props.drawBottom.timeout;
            if (current <= 1) {
                this.clearDrawBottomTimer();
                // 超时自动放弃
                skipDrawBottom();
            } else {
                this.props.setDrawBottomState({timeout: current - 1});
            }
        }, 1000);
    };

    /**
     * 清除抄底倒计时
     */
    clearDrawBottomTimer = () => {
        if (this.drawBottomTimer) {
            clearInterval(this.drawBottomTimer);
            this.drawBottomTimer = null;
        }
    };

    /**
     * 处理抄底成功
     * 事件: game:draw_bottom_success
     */
    handleDrawBottomSuccess = (data) => {
        console.log('✅ 抄底成功:', data);
        const {seatIndex, drawType, drawCards, mainSuit, isNoTrump, addedCards, totalCards, remainingCards} = data;

        // 清除倒计时
        this.clearDrawBottomTimer();

        // 更新主花色
        this.props.setMainSuit(mainSuit);
        this.props.setBidStateInfo({
            ...this.props.bidState,
            hasTrump: true,
            trumpSuit: mainSuit,
            isLocked: true
        });

        // 更新牌堆剩余张数
        if (remainingCards !== undefined) {
            this.props.setRemainingCards(remainingCards);
        }

        // 记录抄底成功信息（用于埋底时展示）
        this.props.setDrawBottomState({
            drawInfo: {
                drawType,
                drawCards,
                mainSuit,
                isNoTrump
            }
        });

        // 如果是自己抄底，更新手牌
        if (seatIndex === this.props.seatIndex) {
            // 从后端获取完整手牌
        }
    };

    /**
     * 处理抄底失败
     * 事件: game:draw_bottom_failed
     */
    handleDrawBottomFailed = (data) => {
        console.log('❌ 抄底失败:', data);
        const {seatIndex, message} = data;

        this.setState({
            error: `抄底失败：${message}`
        });
    };

    /**
     * 处理抄底超时
     * 事件: game:draw_bottom_timeout
     */
    handleDrawBottomTimeout = (data) => {
        console.log('⏰ 抄底超时:', data);
        const {seatIndex} = data;

        // 清除倒计时
        this.clearDrawBottomTimer();

        // 重置状态
        this.props.setDrawBottomState({
            isActive: false,
            canDraw: false,
            isMyTurn: false
        });
    };

    /**
     * 处理玩家放弃抄底
     * 事件: game:draw_bottom_skipped
     */
    handleDrawBottomSkipped = (data) => {
        console.log('⏭ 玩家放弃抄底:', data);
        const {seatIndex} = data;

        // 清除倒计时
        this.clearDrawBottomTimer();

        // 重置状态
        this.props.setDrawBottomState({
            isActive: false,
            canDraw: false,
            isMyTurn: false
        });
    };

    /**
     * 处理抄底阶段完成
     * 事件: game:draw_bottom_complete
     */
    handleDrawBottomComplete = (data) => {
        console.log('🏁 抄底阶段完成:', data);
        console.log('🔍 clearDrawBottomState available:', typeof this.props.clearDrawBottomState);
        console.log('🔍 props:', Object.keys(this.props));
        const {finalMainSuit, isNoTrump, hasDrawer, remainingCards} = data;

        // 清除抄底状态
        this.props.clearDrawBottomState();

        // 更新主花色（如果有变化）
        this.props.setMainSuit(finalMainSuit);
        this.props.setBidStateInfo({
            ...this.props.bidState,
            hasTrump: true,
            trumpSuit: finalMainSuit,
            isNoTrump: isNoTrump
        });

        // 更新牌堆剩余张数
        if (remainingCards !== undefined) {
            this.props.setRemainingCards(remainingCards);
        }
    };

    /**
     * 处理抄底阶段致命错误（A级底牌有分）
     * 事件: game:draw_bottom_fatal
     */
    handleDrawBottomFatal = (data) => {
        console.log('💀 抄底阶段致命错误:', data);
        const {message, winner} = data;

        this.setState({
            error: message
        });
    };

    /**
     * 提交抄底
     */
    handleSubmitDrawBottom = (drawType, chosenSuit, cards) => {
        takeBottom(drawType, chosenSuit, cards).then(() => {
            this.props.setDrawBottomState({
                canDraw: false,
                isMyTurn: false
            });
        }).catch(err => {
            this.setState({
                error: err.message
            });
        });
    };

    /**
     * 处理点击抄底选项（按钮）
     */
    handleDrawBottomOptionClick = (option) => {
        const {type, cards} = option;

        // 红桃5对需要先选择花色
        if (type === 'hearts5_pair') {
            const suit = window.prompt('选择主花色 (spade/heart/club/diamond):', 'spade');
            if (suit) {
                this.submitDrawBottom(type, suit, cards);
            }
        } else {
            this.submitDrawBottom(type, null, cards);
        }
    };

    /**
     * 提交抄底（内部方法）
     */
    submitDrawBottom = (drawType, chosenSuit, cards) => {
        takeBottom(drawType, chosenSuit, cards).then(() => {
            this.props.setDrawBottomState({
                canDraw: false,
                isMyTurn: false
            });
        }).catch(err => {
            this.setState({
                error: err.message
            });
        });
    };

    /**
     * 放弃抄底
     */
    handleSkipDrawBottom = () => {
        skipDrawBottom();
    };

    /**
     * 处理发牌完成
     * 事件: game:deal_complete
     */
    handleDealComplete = (data) => {
        console.log('🎴 收到 game:deal_complete 事件:', data);
        const {players, remainingCards} = data;

        // 更新发牌进度
        this.props.setDealProgress({
            isDealing: false,
            current: 100,
            total: 100
        });

        // 设置阶段为抢庄/抢主
        this.props.setPhase(GAME_PHASES.DEALEND);

        // 更新牌堆剩余张数（发牌完成后为0）
        if (remainingCards !== undefined) {
            this.props.setRemainingCards(remainingCards);
        } else {
            this.props.setRemainingCards(0);
        }

        // 更新玩家信息（包含 name）
        if (players && players.length > 0) {
            const currentPlayers = this.props.players;
            const updatedPlayers = players.map(p => {
                const existing = currentPlayers.find(cp => cp.seatIndex === p.seatIndex);
                return {
                    id: existing?.id || p.userId || p.id,
                    username: existing?.username || p.username || `玩家${p.seatIndex}`,
                    seatIndex: p.seatIndex,
                    cardCount: p.cardCount || 0,
                    isReady: existing?.isReady || false,
                    isOwner: existing?.isOwner || false,
                    team: existing?.team || (p.seatIndex % 2 === 0 ? 'A' : 'B')
                };
            });
            this.props.updatePlayers(updatedPlayers);
        }
    };

    /**
     * 处理轮到你操作
     * 事件: game:your_turn
     */
    handleYourTurn = (data) => {
        const {action, seatIndex, level, handCards, trumpSuit, drawInfo} = data;

        this.props.setTurnSeatIndex(seatIndex);

        this.props.setCurrentLevel(level);

        if (trumpSuit) {
            this.props.setMainSuit(trumpSuit);
        }

        const {mySeatIndex} = this.props;
        const isMyTurn = seatIndex === mySeatIndex;
        this.props.setIsMyTurn(isMyTurn);

        // 设置当前操作类型
        this.setState({currentAction: action});

        // 根据操作类型设置状态
        switch (action) {
            case GAME_ACTIONS.CALL_BANKER:
            case GAME_ACTIONS.CALL_TRUMP:
                this.props.setCanCallBanker(isMyTurn);
                if (handCards) {
                    this.props.setMyHands(handCards);
                }
                break;
            case GAME_ACTIONS.BURY_BOTTOM:
                this.props.setPhase(GAME_PHASES.BOTTOMING);
                if (handCards) {
                    this.props.setMyHands(handCards);
                }
                // 设置底牌状态
                this.setState({
                    bottomCards: this.props.bottomCards,
                    bottomSelection: [],
                    // 如果有抄底信息，保存到 state
                    drawInfo: drawInfo || null
                });
                break;
            case GAME_ACTIONS.PLAY_CARDS:
                this.props.setTimeLeft(30);
                this.props.setPhase(GAME_PHASES.PLAYING);
                if (handCards) {
                    this.props.setMyHands(handCards);
                }
                break;
            default:
                break;
        }

        // 启动倒计时
        if (isMyTurn) {
            this.startTimer();
        } else {
            this.clearTimer();
        }
    };

    /**
     * 处理出牌通知
     * 事件: game:card_played
     */
    handleCardPlayed = (data) => {
        const {seatIndex, cards} = data;

        // 将字符串牌转换为 Card 对象
        const parsedCards = cards.map(cardStr => {
            if (typeof cardStr === 'string') {
                return this.parseCardString(cardStr);
            }
            return cardStr;
        });

        // 添加到桌面
        this.props.addDeskCard({seatIndex, cards: parsedCards});
    };

    /**
     * 处理回合结果
     * 事件: game:turn_result
     */
    handleTurnResult = (data) => {
        const {winnerSeat, score, teamAScore, teamBScore} = data;

        // 更新得分
        if (teamAScore !== undefined) {
            this.props.addTeamScore({team: TEAMS.A, score: teamAScore - this.props.teamAScore});
        }
        if (teamBScore !== undefined) {
            this.props.addTeamScore({team: TEAMS.B, score: teamBScore - this.props.teamBScore});
        }

        // 立即更新当前出牌玩家为获胜者，移除"出牌中"提示
        this.props.setTurnSeatIndex(winnerSeat);

        // 设置回合结果
        const mySeatIndex = this.props.mySeatIndex;
        this.props.setRoundResult({
            winnerSeat,
            score,
            isMyTeamWin: winnerSeat % 2 === mySeatIndex % 2
        });

// 延迟后清除桌面，准备下一轮
        setTimeout(() => {
            this.props.clearDeskCards();
            this.props.resetRoundScore();
            this.props.setRoundResult(null);
            this.props.setLeadSeatIndex(winnerSeat);
        }, 1000);
    };

    /**
     * 处理单局结果
     * 事件: game:round_result
     */
    handleRoundResult = (data) => {
        const {
            winner,
            bankerTeam,
            opponentScore,
            levelChange,
            newLevelA,
            newLevelB,
            teamAScore,
            teamBScore,
            gameWinner
        } = data;

        // 更新队伍等级
        this.props.setTeamLevel({team: TEAMS.A, level: newLevelA});
        this.props.setTeamLevel({team: TEAMS.B, level: newLevelB});

        // 设置游戏结果
        this.props.setGameResult({
            winnerTeam: winner,
            bankerTeam,
            opponentScore,
            levelChange,
            newLevelA,
            newLevelB,
            teamAScore,
            teamBScore,
            gameWinner
        });

        // 2秒后清除结果显示
        setTimeout(() => {
            this.props.setGameResult(null);
        }, 2000);
    };

    /**
     * 处理游戏结束
     * 事件: game:game_over
     */
    handleGameOver = (data) => {
        const {winner} = data;

        this.props.setGameResult({winner});
        this.props.navigate(`/result/${this.props.roomCode}`, {
            state: {gameResult: data}
        });
    };

    /**
     * 处理出牌阶段开始
     * 事件: game:playing_start
     */
    handlePlayingStart = (data) => {
        const {bankerSeat, bankerTeam, trumpSuit, isNoTrump, level, currentTurn, remainingCards} = data;

        this.props.setBanker({bankerId: '', bankerTeam});
        this.props.setMainSuit(isNoTrump ? SUITS.NONE : trumpSuit);
        this.props.setCurrentLevel(level);
        this.props.setPhase(GAME_PHASES.PLAYING);
        this.props.setLeadSeatIndex(bankerSeat);
        this.props.setTurnSeatIndex(bankerSeat);
        // 清除埋底选牌状态
        this.setState({buryingSelectedCards: []});
    };

    /**
     * 处理补底
     * 事件: game:bottom_drawn
     */
    handleBottomDrawn = (data) => {
        const {bottomCards, totalCards, remainingCards} = data;

        this.props.setBottomCards(bottomCards);
        this.props.setPhase(GAME_PHASES.BOTTOMING);
        this.setState({bottomCards, bottomSelection: []});
        // 更新牌堆剩余张数
        if (remainingCards !== undefined) {
            this.props.setRemainingCards(remainingCards);
        }
    };

    /**
     * 处理埋底完成
     * 事件: game:bottom_buried
     */
    handleBottomBuried = (data) => {
        const {seatIndex, buryCount, remainingCards} = data;

        this.props.setHiddenBottom([]);
        // 清除埋底选牌状态
        this.setState({buryingSelectedCards: []});

        // 更新牌堆剩余张数
        if (remainingCards !== undefined) {
            this.props.setRemainingCards(remainingCards);
        }

        // 注意：不要在这里直接进入出牌阶段
        // 后端会启动抄底流程，抄底完成后会发送 game:draw_bottom_complete 事件
        // 该事件中会设置游戏阶段为 PLAYING 并发送 game:playing_start
    };

    /**
     * 处理抢庄通知
     * 事件: game:banker_called
     */
    handleBankerCalled = (data) => {
        const {seatIndex, team, card, suit} = data;

        this.props.setBidState({
            currentBidder: seatIndex,
            bidSuit: suit,
            isLocked: false
        });
    };

    /**
     * 处理抢主通知
     * 事件: game:trump_called
     */
    handleTrumpCalled = (data) => {
        const {seatIndex, suit} = data;

        this.props.setMainSuit(suit);
        this.props.setBidState({
            currentBidder: seatIndex,
            bidSuit: suit,
            isLocked: false
        });
    };

    /**
     * 处理反主通知
     * 事件: game:trump_reversed
     */
    handleTrumpReversed = (data) => {
        const {seatIndex, suit, isNoTrump} = data;

        this.props.setMainSuit(isNoTrump ? SUITS.NONE : suit);
    };

    /**
     * 处理罚分通知
     * 事件: game:play_penalty
     */
    handlePlayPenalty = (data) => {
        const {seatIndex, penalty, reason} = data;

        this.setState({error: `罚分: ${penalty}分 - ${reason}`});
    };

    /**
     * 处理下一局
     /**
     * 开始倒计时
     */
    startTimer = () => {
        this.clearTimer();
        this.timerInterval = setInterval(() => {
            this.props.decrementTime();
        }, 1000);
    };

    /**
     * 清除倒计时
     */
    clearTimer = () => {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    };

    /**
     * 处理选牌
     */
    handleCardClick = (card, index, isMultiSelect = false) => {
        if (!this.props.isMyTurn) return;

        if (isMultiSelect) {
            // 多选模式：切换选中状态
            const selectedIndex = this.props.selectedCards.indexOf(index);
            if (selectedIndex >= 0) {
                // 取消选中
                const newSelectedCards = [...this.props.selectedCards];
                newSelectedCards.splice(selectedIndex, 1);
                this.props.selectCards(newSelectedCards);
            } else {
                // 添加选中
                const newSelectedCards = [...this.props.selectedCards, index];
                newSelectedCards.sort((a, b) => a - b);
                this.props.selectCards(newSelectedCards);
            }
        } else {
            // 单选模式：正常切换
            this.props.toggleCardSelection({index});
        }
    };

    /**
     * 处理出牌
     */
    handlePlayCards = () => {
        const {selectedCards, myHands, leadSeatIndex, leadSuit, mainSuit, currentLevel} = this.props;

        if (selectedCards.length === 0) return;

        // 获取排序后的手牌（与选择时的索引对应）
        const sortedHands = this.sortHandCards(myHands);

        // 获取选中的牌，使用排序后的索引
        const selected = selectedCards.map(i => {
            const card = sortedHands[i];
            // 如果是字符串，解析为对象
            if (typeof card === 'string') {
                return this.parseCardString(card);
            }
            return card;
        });

        // 校验出牌
        const leadCards = this.props.deskCards[leadSeatIndex] || [];
        const validation = ruleEngine.checkValid(
            selected,
            leadCards,
            myHands,
            leadSuit,
            mainSuit,
            currentLevel
        );

        if (!validation.valid) {
            this.setState({error: validation.error});
            return;
        }

        // 发送出牌，确保是字符串格式
        const cardStrs = selected.map(c => {
            if (typeof c === 'string') return c;
            return `${c.suit}_${c.rank}`;
        });
        playCards(cardStrs);

        // 清除选中
        this.props.clearSelection();
        this.setState({error: ''});
    };

    /**
     * 处理抢庄
     */
    handleCallBanker = (cardStr) => {
        callBanker(cardStr).catch((err) => {
            this.setState({error: err.message});
        });
    };

    /**
     * 处理锁庄
     */
    handleLockBanker = (cardStr) => {
        lockBanker(cardStr).catch((err) => {
            this.setState({error: err.message});
        });
    };

    /**
     * 处理反庄
     */
    handleReverseBanker = (card) => {
        reverseBanker(card).catch((err) => {
            this.setState({error: err.message});
        });
    };

    /**
     * 处理抢主
     */
    handleCallTrump = (cardStr) => {
        callTrump(cardStr).catch((err) => {
            this.setState({error: err.message});
        });
    };

    /**
     * 处理锁主
     */
    handleLockTrump = (cardStr) => {
        lockTrump(cardStr).catch((err) => {
            this.setState({error: err.message});
        });
    };

    /**
     * 处理反主
     */
    handleReverseTrump = (cardStr) => {
        reverseTrump(cardStr).catch((err) => {
            this.setState({error: err.message});
        });
    };

    /**
     * 处理埋底选牌
     * @param {number} index - 手牌索引
     * @param {string} cardStr - 牌的字符串表示
     */
    handleBuryCardClick = (index, cardStr) => {
        const {buryingSelectedCards} = this.state;

        // 使用 index 而不是 cardStr 来判断是否已选中（因为可能有两张相同的牌）
        const selectedIndex = buryingSelectedCards.findIndex(c => c.index === index);
        if (selectedIndex >= 0) {
            // 如果已经选中，则取消选中
            this.setState(prevState => ({
                buryingSelectedCards: prevState.buryingSelectedCards.filter(c => c.index !== index)
            }));
        } else {
            // 如果没有选中，则添加到选中列表
            if (buryingSelectedCards.length < 8) {
                this.setState(prevState => ({
                    buryingSelectedCards: [...prevState.buryingSelectedCards, {index, cardStr}]
                }));
            }
        }
    };

    /**
     * 处理埋底
     */
    handleBuryBottom = () => {
        const {buryingSelectedCards} = this.state;

        if (buryingSelectedCards.length !== 8) {
            this.setState({error: `请选择8张牌，当前已选 ${buryingSelectedCards.length} 张`});
            return;
        }

        const selectedCards = buryingSelectedCards.map(c => c.cardStr);
        buryBottom(selectedCards).catch((err) => {
            this.setState({error: err.message});
        });
        this.props.setHiddenBottom(selectedCards);
        this.setState({buryingSelectedCards: [], error: ''});
    };

    /**
     * 获取座位位置
     */
    getSeatPosition = (seatIndex) => {
        const positions = ['self', 'right', 'opponent', 'left'];
        const {mySeatIndex} = this.props;
        const relativeIndex = (seatIndex - mySeatIndex + 4) % 4;
        return positions[relativeIndex];
    };

    /**
     * 将字符串牌转换为 Card 组件需要的对象格式
     * 例如: "diamond_9" -> { suit: 'diamond', rank: '9', displayName: '♦9' }
     */
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

    /**
     * 渲染卡片选择按钮
     */
    renderCardButtons = (cards, onClick) => {
        if (!cards || cards.length === 0) return null;

        // 对于抢庄，去重时只保留每个花色的2，因为可能有多个2但不同花色
        const uniqueCards = [...new Set(cards)];

        return (
            <div className="card-buttons">
                {uniqueCards.map((cardStr, index) => {
                    const card = this.parseCardString(cardStr);
                    return (
                        <Button
                            key={index}
                            variant="warning"
                            size="large"
                            onClick={() => onClick(cardStr)}
                        >
                            {card ? `${SUIT_NAMES[card.suit]}${card.rank}` : cardStr}
                        </Button>
                    );
                })}
            </div>
        );
    };

    /**
     * 渲染锁庄按钮 - 显示"锁庄+花色"
     */
    renderLockBankerButtons = (cards, onClick) => {
        if (!cards || cards.length === 0) return null;

        const suitToCards = new Map();
        cards.forEach(cardStr => {
            const card = this.parseCardString(cardStr);
            if (card) {
                if (!suitToCards.has(card.suit)) {
                    suitToCards.set(card.suit, cardStr);
                }
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
                        锁庄 {SUIT_NAMES[suit]}
                    </Button>
                ))}
            </div>
        );
    };

    /**
     * 渲染锁主按钮 - 显示"锁主+花色"
     */
    renderLockTrumpButtons = (cards, onClick) => {
        if (!cards || cards.length === 0) return null;

        const suitToCards = new Map();
        cards.forEach(cardStr => {
            const card = this.parseCardString(cardStr);
            if (card) {
                if (!suitToCards.has(card.suit)) {
                    suitToCards.set(card.suit, cardStr);
                }
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
                        锁主 {SUIT_NAMES[suit]}
                    </Button>
                ))}
            </div>
        );
    };

    /**
     * 按花色排序手牌
     * 排序顺序: 方片(♦) -> 梅花(♣) -> 红桃(♥) -> 黑桃(♠) -> 大王 -> 小王
     * 每种花色内按点数: 2-10,J,Q,K,A
     */
    sortHandCards = (hands) => {
        const suitOrder = {'diamond': 0, 'club': 1, 'heart': 2, 'spade': 3, 'joker': 4};
        const rankOrder = {
            '2': 2,
            '3': 3,
            '4': 4,
            '5': 5,
            '6': 6,
            '7': 7,
            '8': 8,
            '9': 9,
            '10': 10,
            'J': 11,
            'Q': 12,
            'K': 13,
            'A': 14,
            'small': 15,
            'big': 16
        };

        return [...hands].sort((a, b) => {
            const cardA = typeof a === 'string' ? this.parseCardString(a) : a;
            const cardB = typeof b === 'string' ? this.parseCardString(b) : b;

            const suitA = suitOrder[cardA?.suit] ?? 5;
            const suitB = suitOrder[cardB?.suit] ?? 5;

            if (suitA !== suitB) {
                return suitA - suitB;
            }

            const rankA = rankOrder[cardA?.rank] ?? 0;
            const rankB = rankOrder[cardB?.rank] ?? 0;

            return rankA - rankB;
        });
    };

    /**
     * 渲染手牌区
     */
    renderHandCards = () => {
        const {myHands, selectedCards, isMyTurn, phase} = this.props;

        // 按花色排序手牌
        const sortedHands = this.sortHandCards(myHands);

        // 将字符串转换为 Card 对象
        const parsedHands = sortedHands.map((card, index) => {
            if (typeof card === 'string') {
                return {...this.parseCardString(card), id: index};
            }
            return {...card, id: index};
        });

        // 检查是否在埋底阶段
        const isBuryingPhase = phase === GAME_PHASES.BOTTOMING;
        const {buryingSelectedCards} = this.state;

        return (
            <div className="hand-cards">
                {parsedHands.map((card, index) => {
                    // 检查是否被选中
                    const isSelected = isBuryingPhase
                        ? buryingSelectedCards.some(c => c.index === index)
                        : selectedCards.includes(index);

                    return (
                        <Card
                            key={card.id || index}
                            card={card}
                            index={index}
                            selected={isSelected}
                            disabled={!isMyTurn}
                            onClick={isBuryingPhase ? () => this.handleBuryCardClick(index, `${card.suit}_${card.rank}`) : this.handleCardClick}
                        />
                    );
                })}
            </div>
        );
    };

    /**
     * 渲染桌面牌
     */
    renderDeskCards = () => {
        const {deskCards} = this.props;

        return (
            <div className="desk-area">
                {Object.entries(deskCards).map(([seatIndex, cards]) => {
                    if (!cards || cards.length === 0) return null;

                    const position = this.getSeatPosition(parseInt(seatIndex));

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

    /**
     * 渲染玩家信息
     */
    renderPlayers = () => {
        const {players, mySeatIndex, bankerId, turnSeatIndex, levelA, levelB, phase} = this.props;

        // 根据 mySeatIndex 重新排列玩家位置
        // players 数组按座位号 0,1,2,3 存储，需要把当前玩家(mySeatIndex)固定在底部
        const getPlayerByRelativePosition = (relativeIndex) => {
            const seatIndex = (mySeatIndex + relativeIndex) % 4;
            return players.find(p => p.seatIndex === seatIndex);
        };

        const playerRight = getPlayerByRelativePosition(1);
        const playerOpponent = getPlayerByRelativePosition(2);
        const playerLeft = getPlayerByRelativePosition(3);
        const playerSelf = getPlayerByRelativePosition(0);

        const getTeam = (seatIndex) => seatIndex % 2 === 0 ? 'A' : 'B';

        return (
            <div className="players-area">
                <div className="player-top">
                    <PlayerInfo
                        username={playerOpponent?.username || (mySeatIndex === 2 ? this.props.user.username : `玩家${getTeam(2)}队`)}
                        cardCount={playerOpponent?.cardCount}
                        isBanker={playerOpponent?.id === bankerId}
                        team={playerOpponent?.team || getTeam(2)}
                        level={levelB}
                        position="opponent"
                        isTurn={turnSeatIndex === playerOpponent?.seatIndex}
                        isMyTeam={true}
                        phase={phase}
                    />
                </div>

                <div className="player-left">
                    <PlayerInfo
                        username={playerLeft?.username || (mySeatIndex === 3 ? this.props.user.username : `玩家${getTeam(3)}队`)}
                        cardCount={playerLeft?.cardCount}
                        isBanker={playerLeft?.id === bankerId}
                        team={playerLeft?.team || getTeam(3)}
                        level={levelB}
                        position="left"
                        isTurn={turnSeatIndex === playerLeft?.seatIndex}
                        isMyTeam={false}
                        phase={phase}
                    />
                </div>

                <div className="player-right">
                    <PlayerInfo
                        username={playerRight?.username || (mySeatIndex === 1 ? this.props.user.username : `玩家${getTeam(1)}队`)}
                        cardCount={playerRight?.cardCount}
                        isBanker={playerRight?.id === bankerId}
                        team={playerRight?.team || getTeam(1)}
                        level={levelA}
                        position="right"
                        isTurn={turnSeatIndex === playerRight?.seatIndex}
                        isMyTeam={false}
                        phase={phase}
                    />
                </div>

                <div className="player-bottom">
                    <PlayerInfo
                        username={playerSelf?.username || this.props.user.username}
                        cardCount={this.props.myHands?.length}
                        isBanker={playerSelf?.id === bankerId}
                        team={playerSelf?.team || getTeam(mySeatIndex)}
                        level={levelA}
                        position="self"
                        isTurn={turnSeatIndex === mySeatIndex}
                        isMyTeam={true}
                        phase={phase}
                    />
                </div>
            </div>
        );
    };

    /**
     * 渲染等级和主花色
     */
    renderGameInfo = () => {
        const {
            levelA,
            levelB,
            mainSuit,
            currentLevel,
            bankerTeam,
            players,
            bidState,
            mySeatIndex,
            teamAScore,
            teamBScore
        } = this.props;

        // 根据 seatIndex 查找玩家
        const getPlayerBySeat = (seatIndex) => {
            if (seatIndex === undefined || seatIndex < 0) return null;
            return players.find(p => p.seatIndex === seatIndex);
        };

        const trumpCaller = getPlayerBySeat(bidState.trumpCallerSeat);
        const trumpCallerName = bidState.hasTrump && trumpCaller ? trumpCaller.username : null;

        const mainBanker = getPlayerBySeat(bidState.bankerSeat);
        const mainBankerName = bidState.hasBanker && mainBanker ? mainBanker.username : null;

        // 计算闲家得分（非庄家队伍的得分）
        const bankerTeamName = bankerTeam || 'A';
        const idleTeamScore = bankerTeamName === 'A' ? teamBScore : teamAScore;

        return (
            <div className="game-info">
                <div className={`team-level team-A`}>
                    <span className="team-name">红队(A):</span>
                    <span className="level">{levelA}</span>
                </div>

                <div className="game-center-info">
                    <div className="info-row">
                        <div className="info-item">
                            <span className="label">等级:</span>
                            <span className="value">{currentLevel}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">主:</span>
                            <span className={`suit-icon ${mainSuit}`}>
                                {mainSuit === SUITS.NONE ? '无主' : SUIT_NAMES[mainSuit]}
                            </span>
                        </div>
                        {trumpCallerName && (
                            <div className="info-item">
                                <span className="label">来源:</span>
                                <span className="value">{trumpCallerName}</span>
                            </div>
                        )}
                    </div>
                    <div className="info-row">
                        <div className="info-item">
                            <span className="label">台上:</span>
                            <span className="value">{bankerTeamName}队</span>
                        </div>
                        <div className="info-item">
                            <span className="label">打底:</span>
                            <span
                                className="value">{bidState.bankerSeat >= 0 ? mainBankerName : '-'}</span>
                        </div>
                        <div className="info-item score">
                            <span className="label">闲家得分:</span>
                            <span className="value">{idleTeamScore}</span>
                        </div>
                    </div>
                </div>

                <div className={`team-level team-B`}>
                    <span className="team-name">蓝队(B):</span>
                    <span className="level">{levelB}</span>
                </div>
            </div>
        );
    };

    /**
     * 渲染操作面板
     */
    renderActionPanel = () => {
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
            dealProgress,
            availableBankerCards,
            availableTrumpCards,
            availableReverseCards,
            drawBottom
        } = this.props;
        const {error, warnning, currentAction, drawInfo} = this.state;

        const canPlay = isMyTurn &&
            phase === GAME_PHASES.PLAYING &&
            selectedCards.length > 0;

        const isDealing = dealProgress.isDealing;

        return (
            <div className="action-panel">
                {error && <div className="error-message">{error}</div>}
                {warnning && <div className="error-message">{warnning}</div>}
                {/* 发牌进度显示 */}
                {isDealing && (
                    <div className="deal-progress">
                        发牌中... {dealProgress.current}/{dealProgress.total}
                    </div>
                )}

                {phase === GAME_PHASES.PLAYING && isMyTurn && (
                    <>
                        <Button
                            variant="primary"
                            size="large"
                            disabled={!canPlay}
                            onClick={this.handlePlayCards}
                        >
                            出牌 ({selectedCards.length})
                        </Button>

                        <Button
                            variant="default"
                            size="large"
                            onClick={() => this.props.clearSelection()}
                            disabled={selectedCards.length === 0}
                        >
                            取消
                        </Button>
                    </>
                )}

                {/* 抢庄按钮 - 显示可用卡片选择 */}
                {(currentAction === GAME_ACTIONS.CALL_BANKER || canCallBanker) && (
                    this.renderCardButtons(availableBankerCards, (cardStr) => this.handleCallBanker(cardStr))
                )}

                {/* 锁庄按钮 - 显示"锁庄+花色" */}
                {canLockBanker && (
                    this.renderLockBankerButtons(availableBankerCards, (cardStr) => this.handleLockBanker(cardStr))
                )}

                {/* 反庄按钮 - 显示花色选择 */}
                {canReverseBanker && availableReverseCards?.card && (
                    <Button
                        variant="warning"
                        size="large"
                        onClick={() => this.handleReverseBanker(availableReverseCards.card)}
                    >
                        反庄 {SUIT_NAMES[availableReverseCards.card.suit]}
                    </Button>
                )}

                {/* 抢主按钮 - 显示可用卡片选择 */}
                {(currentAction === GAME_ACTIONS.CALL_TRUMP || canCallTrump) && (
                    this.renderCardButtons(availableTrumpCards, (cardStr) => this.handleCallTrump(cardStr))
                )}

                {/* 锁主按钮 - 显示"锁主+花色" */}
                {canLockTrump && (
                    this.renderLockTrumpButtons(availableTrumpCards, (cardStr) => this.handleLockTrump(cardStr))
                )}

                {/* 反主按钮 - 显示可用卡片选择 */}
                {canReverseTrump && availableReverseCards?.cards && (
                    this.renderCardButtons(availableReverseCards.cards, (cardStr) => this.handleReverseTrump(cardStr))
                )}

                {/* 埋底按钮 - 包括普通埋底和抄底后的埋底 */}
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
                            disabled={this.state.buryingSelectedCards.length !== 8}
                            onClick={this.handleBuryBottom}
                        >
                            埋底 ({this.state.buryingSelectedCards.length}/8)
                        </Button>
                    </>
                )}

                {/* 抄底阶段 - 显示可抄底的牌型按钮 */}
                {drawBottom.isActive && drawBottom.canDraw && drawBottom.drawableOptions && (
                    <div className="draw-bottom-actions">
                        <div className="draw-bottom-title">
                            是否抄底？ 剩余 {drawBottom.timeout} 秒
                        </div>
                        {drawBottom.drawableOptions.map((option, idx) => (
                            <Button
                                key={idx}
                                variant="primary"
                                size="large"
                                onClick={() => this.handleDrawBottomOptionClick(option)}
                            >
                                {option.label}
                            </Button>
                        ))}
                        <Button
                            variant="default"
                            size="large"
                            onClick={this.handleSkipDrawBottom}
                        >
                            放弃
                        </Button>
                    </div>
                )}

                {/* 抄底阶段 - 显示其他玩家正在选择 */}
                {drawBottom.isActive && !drawBottom.canDraw && (
                    <div className="draw-bottom-waiting">
                        玩家 {drawBottom.currentAsker} 正在选择是否抄底...
                    </div>
                )}
            </div>
        );
    };

    /**
     * 渲染牌堆（显示剩余张数）
     */
    renderCardDeck = () => {
        const {remainingCards, phase} = this.props;

        if (phase === GAME_PHASES.NONE || phase === GAME_PHASES.DEALING) {
            return null;
        }

        return (
            <div className="card-deck">
                <div className="deck-card-back"></div>
                <div className="deck-count">{remainingCards}</div>
            </div>
        );
    };

    /**
     * 渲染回合结果
     */
    renderRoundResult = () => {
        const {roundResult} = this.props;

        if (!roundResult) return null;

        const {score, isMyTeamWin} = roundResult;

        return (
            <div className="round-result-simple">
                <div className={`result-text ${isMyTeamWin ? 'win' : 'lose'}`}>
                    {isMyTeamWin ? '我方获胜' : '对方获胜'}
                </div>
                <div className="score-info">
                    +{score} 分
                </div>
            </div>
        );
    };

    /**
     * 渲染单局结果
     */
    renderGameResult = () => {
        const {gameResult, mySeatIndex} = this.props;

        if (!gameResult) return null;

        const {winnerTeam, opponentScore, levelChange, newLevelA, newLevelB, teamAScore, teamBScore} = gameResult;
        const myTeam = getTeam(mySeatIndex);
        const isMyTeamWin = winnerTeam === myTeam;

        return (
            <div className="game-result-overlay">
                <div className="game-result-content">
                    <div className={`winner-text ${isMyTeamWin ? 'win' : 'lose'}`}>
                        {isMyTeamWin ? '我方获胜' : '对方获胜'}
                    </div>
                    <div className="score-detail">
                        <div className="score-row">
                            <span className="team-label">A队:</span>
                            <span className="team-score">{teamAScore}分</span>
                        </div>
                        <div className="score-row">
                            <span className="team-label">B队:</span>
                            <span className="team-score">{teamBScore}分</span>
                        </div>
                    </div>
                    <div className="level-change">
                        {levelChange > 0 ? `+${levelChange}` : levelChange} 级
                    </div>
                </div>
            </div>
        );
    };

    /**
     * 渲染发牌状态提示（屏幕正中间）
     */
    renderDealStatus = () => {
        const {dealProgress, bidState, phase, roundIndex} = this.props;
        const {isDealing, current, total} = dealProgress;

        let statusText = '';
        if (isDealing) {
            statusText = `发牌中... ${current}/${total}`;
        } else if (phase === GAME_PHASES.DEALEND) {

            if (!bidState.hasBanker) {
                statusText = '等待抢庄...';
            } else if (!bidState.hasTrump) {
                statusText = '等待抢主...';
            } else {
                statusText = '补底前确认...';
            }
        } else if (phase === GAME_PHASES.BOTTOMING) {
            statusText = '抄底确认环节...'
        } else {
            return null;
        }

        return (
            <div className="deal-status-overlay">
                <div className="deal-status-text">{statusText}</div>
            </div>
        );
    };

    render() {
        const {turnTimeLeft, isMyTurn, remainingCards, phase} = this.props;

        return (
            <div className="game-page">
                {this.renderGameInfo()}
                {this.renderPlayers()}
                {this.renderDeskCards()}

                {this.renderCardDeck()}

                {this.renderDealStatus()}

                {/*{isMyTurn && (*/}
                {/*    <div className="timer-container">*/}
                {/*        <Timer*/}
                {/*            seconds={turnTimeLeft}*/}
                {/*            isActive={isMyTurn}*/}
                {/*        />*/}
                {/*    </div>*/}
                {/*)}*/}

                <div className="hand-area">
                    {this.renderHandCards()}
                </div>

                {this.renderActionPanel()}
                {this.renderRoundResult()}
                {this.renderGameResult()}
            </div>
        );
    }
}

// 辅助函数
const getTeam = (seatIndex) => {
    return seatIndex % 2 === 0 ? 'A' : 'B';
};

// 从 Redux 获取状态
const mapStateToProps = (state) => ({
    user: state.user,
    roomCode: state.room.roomCode,
    players: state.room.players,
    mySeatIndex: state.room.mySeatIndex,
    seatIndex: state.room.mySeatIndex,

    phase: state.game.phase,
    bankerId: state.game.bankerId,
    bankerTeam: state.game.bankerTeam,
    mainSuit: state.game.mainSuit,
    currentLevel: state.game.currentLevel,
    levelA: state.game.levelA,
    levelB: state.game.levelB,
    teamAScore: state.game.teamAScore,
    teamBScore: state.game.teamBScore,
    myHands: state.game.myHands,
    selectedCards: state.game.selectedCards,
    turnSeatIndex: state.game.turnSeatIndex,
    deskCards: state.game.deskCards,
    leadSeatIndex: state.game.leadSeatIndex,
    leadSuit: state.game.leadSuit,
    turnTimeLeft: state.game.turnTimeLeft,
    roundResult: state.game.roundResult,
    gameResult: state.game.gameResult,
    roundIndex: state.game.roundIndex,
    canCallBanker: state.game.canCallBanker,
    canCallTrump: state.game.canCallTrump,
    canTakeBottom: state.game.canTakeBottom,
    isMyTurn: state.game.isMyTurn,
    bottomCards: state.game.bottomCards,
    // 新增
    dealProgress: state.game.dealProgress,
    bidState: state.game.bidState,
    canLockBanker: state.game.canLockBanker,
    canReverseBanker: state.game.canReverseBanker,
    canLockTrump: state.game.canLockTrump,
    canReverseTrump: state.game.canReverseTrump,
    availableBankerCards: state.game.availableBankerCards,
    availableTrumpCards: state.game.availableTrumpCards,
    availableReverseCards: state.game.availableReverseCards,
    reverseSuit: state.game.reverseSuit,
    // 抄底阶段
    drawBottom: state.game.drawBottom,
    // 牌堆剩余张数
    remainingCards: state.game.remainingCards,
    // 各玩家手牌数量
    playerCardCounts: state.game.playerCardCounts
});

const mapDispatchToProps = {
    setPhase,
    setMyHands,
    removeCards,
    toggleCardSelection,
    clearSelection,
    setTurnSeatIndex,
    addDeskCard,
    clearDeskCards,
    setLeadSeatIndex,
    setBanker,
    setMainSuit,
    setCurrentLevel,
    setTeamLevel,
    addTeamScore,
    resetRoundScore,
    setBottomCards,
    setBidState,
    setLeadSuit,
    setTimeLeft,
    decrementTime,
    setRoundResult,
    setGameResult,
    setCanCallBanker,
    setCanCallTrump,
    setCanLockBanker,
    setCanReverseBanker,
    setCanLockTrump,
    setCanReverseTrump,
    setAvailableBankerCards,
    setAvailableTrumpCards,
    setAvailableReverseCards,
    setIsMyTurn,
    setDeskCards,
    setHiddenBottom,
    initRound,
    setDealProgress,
    setBidStateInfo,
    clearDealingActions,
    setDrawBottomState,
    clearDrawBottomState,
    updatePlayers,
    resetGame,
    setRemainingCards,
    setPlayerCardCounts
};

// 使用 useNavigate 和 useParams 的包装组件
const GameWithNavigate = (props) => {
    const navigate = useNavigate();
    const params = useParams();
    return <Game {...props} navigate={navigate} roomCode={params.roomId}/>;
};

export default connect(mapStateToProps, mapDispatchToProps)(GameWithNavigate);
