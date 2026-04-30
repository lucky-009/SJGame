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
    onRoundStarting,
    onGameOver,
    onPlayingStart,
    onBottomDrawn,
    onBottomTaken,
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
    onBottomReveal,
    // 玩家离线/重连事件
    onPlayerDisconnected,
    onPlayerReconnected,
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
    setShowRoundStarting,
    setRoundStartingData,
    setCanCallBanker,
    setCanCallTrump,
    setCanLockBanker,
    setCanReverseBanker,
    setCanLockTrump,
    setCanReverseTrump,
    setAvailableBankerCards,
    setAvailableLockBankerCards,
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
    setLeadPlayCardCount
} from '../../store/gameSlice';
import {updatePlayers, updatePlayer, setPlayerDisconnected} from '../../store/roomSlice';
import {GAME_PHASES, SUITS, TEAMS, SUIT_NAMES, GAME_ACTIONS, RED_SUITS} from '../../utils/constants';
import ruleEngine from '../../ruleEngine';
import { parseCardString, sortHandCards, getSeatPosition } from './utils/gameUtils';
import { createDealingHandlers } from './handlers/dealingHandlers';
import { createBiddingHandlers } from './handlers/biddingHandlers';
import { createPlayingHandlers } from './handlers/playingHandlers';
import { createDrawBottomHandlers } from './handlers/drawBottomHandlers';
import { useGameTimer } from './hooks/useGameTimer';
import HandCards from './components/HandCards';
import DeskCards from './components/DeskCards';
import Players from './components/Players';
import GameInfo from './components/GameInfo';
import ActionPanel from './components/ActionPanel';
import Card from '../../components/Card';
import PlayerInfo from '../../components/PlayerInfo';
import Timer from '../../components/Timer';
import Button from '../../components/Button';
import BottomRevealModal from '../../components/BottomRevealModal';
import GameResultModal from '../../components/GameResultModal';
import './Game.css';

/**
 * 游戏组件
 */
class Game extends Component {
    constructor(props) {
        super(props);
        this.timerInterval = null;
        this.drawBottomTimer = null;

        const dealingHandlers = createDealingHandlers(this);
        const biddingHandlers = createBiddingHandlers(this);
        const playingHandlers = createPlayingHandlers(this);
        const drawBottomHandlers = createDrawBottomHandlers(this);
        const timerHooks = useGameTimer(this);

        Object.assign(this, dealingHandlers, biddingHandlers, playingHandlers, drawBottomHandlers, timerHooks);

        this.state = {
            showBidModal: false,
            showBottomModal: false,
            showTakeBottomModal: false,
            bottomSelection: [], // 存储选中的牌的索引
            buryingSelectedCards: [], // 存储选中的牌本身
            currentAction: null, // 当前操作类型
            error: '',
            showBottomReveal: false,
            bottomRevealData: null,
            showGameResult: false,
            gameResultData: null
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

        // 即将开始下一局
        // 事件: game:round_starting
        onRoundStarting((data) => {
            this.handleRoundStarting(data);
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

        // 拿底牌通知
        // 事件: game:bottom_taken
        onBottomTaken((data) => {
            this.handleBottomTaken(data);
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

        // 抠底揭示
        // 事件: game:bottom_reveal
        onBottomReveal((data) => {
            this.handleBottomReveal(data);
        });

        // 玩家离线
        // 事件: room:player_disconnected
        onPlayerDisconnected((data) => {
            const { userId } = data;
            this.props.setPlayerDisconnected(userId, true);
        });

        // 玩家重连恢复
        // 事件: room:player_reconnected
        onPlayerReconnected((data) => {
            const { userId } = data;
            this.props.setPlayerDisconnected(userId, false);
        });
    };

    /**
     * 处理开始发牌
     * 事件: game:deal_start
     */
    handleDealStart = (data) => {
        console.log('🎴 开始发牌:', data);
        const {totalCards, isFirstRound, level, bankerSeat, bankerTeam} = data;

        // 隐藏"即将开始"提示
        this.props.setShowRoundStarting(false);
        this.props.setRoundStartingData(null);

        // 关闭单局结算弹窗
        this.setState({
            showGameResult: false,
            gameResultData: null
        });

        // 设置发牌进度
        this.props.setDealProgress({
            isDealing: true,
            current: 0,
            total: totalCards
        });
        this.props.setRemainingCards(totalCards);

        // 更新基本信息
        this.props.setCurrentLevel(level);
        this.props.setPhase(GAME_PHASES.DEALING);
        this.props.setTurnSeatIndex(-1);
        this.props.setIsMyTurn(false);

        // 非首局（下一局）需要额外重置状态
        if (!isFirstRound) {
            // 重置游戏状态
            this.props.clearDeskCards();
            this.props.resetRoundScore();
            this.props.setRoundResult(null);
            this.props.setMyHands([]);
            this.props.setBottomCards([]);
            this.props.setHiddenBottom([]);
            this.props.setDeskCards({seat0: [], seat1: [], seat2: [], seat3: []});

            // 更新庄家信息和局数
            if (bankerTeam) {
                this.props.setBanker({bankerId: '', bankerTeam});
            }

            // 重置操作状态
            this.setState({
                currentAction: null,
                buryingSelectedCards: []
            });
        }
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
        const {message, totalCards, isFirstRound} = data;

        // 清除原有手牌和选中状态
        this.props.setMyHands([]);
        this.props.clearSelection();

        this.props.setPhase(GAME_PHASES.DEALING);

        if (isFirstRound) {
            this.props.setMainSuit(SUITS.NONE);
            this.props.setBidStateInfo({
                hasBanker: false,
                bankerSeat: -1,
                hasTrump: false,
                trumpSuit: null,
                isLocked: false,
                trumpCallerSeat: -1
            });
        } else {
            this.props.setMainSuit(SUITS.NONE);
            this.props.setBidStateInfo({
                ...this.props.bidState,
                hasTrump: false,
                trumpSuit: null,
                trumpCallerSeat: -1
            });
        }

        // 清除操作按钮权限
        this.props.clearDealingActions();
        this.props.clearDrawBottomState();
        this.props.clearDeskCards();

        // 更新发牌进度
        this.props.setDealProgress({
            isDealing: true,
            current: 0,
            total: totalCards
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
        // this.startDrawBottomTimer(timeout);
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
     * 处理抠底揭示
     * 事件: game:bottom_reveal
     */
    handleBottomReveal = (data) => {
        console.log('🃏 抠底揭示:', data);

        const {bottomCards, winnerSeat, winnerTeam, bottomResult, teamAScore, teamBScore} = data;

        if (teamAScore !== undefined) {
            this.props.addTeamScore({team: TEAMS.A, score: teamAScore - this.props.teamAScore});
        }
        if (teamBScore !== undefined) {
            this.props.addTeamScore({team: TEAMS.B, score: teamBScore - this.props.teamBScore});
        }

        this.setState({
            showBottomReveal: true,
            bottomRevealData: {
                bottomCards,
                winnerSeat,
                winnerTeam,
                bottomResult,
                teamAScore,
                teamBScore
            }
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
        const {type, cards, chosenSuit} = option;

        // 红桃5对需要先选择花色（现在由 ActionPanel 处理）
        if (type === 'hearts5_pair') {
            if (chosenSuit) {
                this.submitDrawBottom(type, chosenSuit, cards);
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
                // if (handCards) {
                //     this.props.setMyHands(handCards);
                // }
                break;
            case GAME_ACTIONS.BURY_BOTTOM:
                this.props.setPhase(GAME_PHASES.BOTTOMING);
                this.props.clearDealingActions();
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
        const {seatIndex, cards, playerCardCounts, leadPlayCardCount} = data;

        // 存储首家出牌数量
        if (leadPlayCardCount !== undefined) {
            this.props.setLeadPlayCardCount(leadPlayCardCount);
        }

        // 将字符串牌转换为 Card 对象
        const parsedCards = cards.map(cardStr => {
            if (typeof cardStr === 'string') {
                return parseCardString(cardStr);
            }
            return cardStr;
        });

        // 添加到桌面
        this.props.addDeskCard({seatIndex, cards: parsedCards});

        // 更新所有玩家的剩余手牌数
        if (playerCardCounts) {
            for (const [key, count] of Object.entries(playerCardCounts)) {
                const s = parseInt(key.replace('seat', ''));
                this.props.updatePlayer({seatIndex: s, updates: {cardCount: count}});
            }
        }
    };

    /**
     * 处理回合结果
     * 事件: game:turn_result
     */
    handleTurnResult = (data) => {
        const {winnerSeat, winnerTeam, score, teamAScore, teamBScore} = data;

        // 更新得分
        if (teamAScore !== undefined) {
            this.props.addTeamScore({team: TEAMS.A, score: teamAScore - this.props.teamAScore});
        }
        if (teamBScore !== undefined) {
            this.props.addTeamScore({team: TEAMS.B, score: teamBScore - this.props.teamBScore});
        }

        // 立即更新当前出牌玩家为获胜者，移除"出牌中"提示
        this.props.setTurnSeatIndex(winnerSeat);

        // 设置回合结果，使用服务端返回的 winnerTeam 判断
        const mySeatIndex = this.props.mySeatIndex;
        const myTeam = mySeatIndex % 2 === 0 ? 'A' : 'B';
        this.props.setRoundResult({
            winnerSeat,
            score,
            isMyTeamWin: winnerTeam === myTeam
        });

// 延迟后清除桌面，准备下一轮
        setTimeout(() => {
            this.props.clearDeskCards();
            this.props.resetRoundScore();
            this.props.setRoundResult(null);
            this.props.setLeadSeatIndex(winnerSeat);
            this.props.setLeadPlayCardCount(0);
        }, 1200);
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

        // 设置游戏结果弹窗
        this.setState({
            showGameResult: true,
            gameResultData: {
                winnerTeam: winner,
                bankerTeam,
                opponentScore,
                levelChange,
                newLevelA,
                newLevelB,
                teamAScore,
                teamBScore,
                gameWinner
            }
        });
    };

    /**
     * 处理即将开始下一局
     * 事件: game:round_starting
     */
    handleRoundStarting = (data) => {
        const {nextRoundIndex, bankerSeat, bankerTeam, bankerName, level} = data;

        // 清空上一局的状态（保留队伍等级 levelA/levelB 和当前等级）
        this.props.setMainSuit(SUITS.NONE);
        this.props.setBidStateInfo({
            hasBanker: false,
            bankerSeat: -1,
            hasTrump: false,
            trumpSuit: null,
            isLocked: false,
            trumpCallerSeat: -1
        });

        // 更新对局基本信息
        this.props.setBanker({bankerId: '', bankerTeam});
        this.props.setCurrentLevel(level);

        // 显示"即将开始"提示
        this.props.setShowRoundStarting(true);
        this.props.setRoundStartingData({
            nextRoundIndex,
            bankerSeat,
            bankerTeam,
            bankerName,
            level
        });

        // 关闭单局结算弹窗
        this.setState({
            showGameResult: false,
            gameResultData: null
        });
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
        this.props.clearDealingActions();
        this.setState({buryingSelectedCards: []});
        this.props.setLeadPlayCardCount(0);
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
        const {selectedCards, myHands, leadSeatIndex} = this.props;

        if (selectedCards.length === 0) return;

        // 获取排序后的手牌
        const sortedHands = sortHandCards(myHands, currentLevel);

        // 获取选中的牌
        const selected = selectedCards.map(i => {
            const card = sortedHands[i];
            if (typeof card === 'string') {
                return parseCardString(card);
            }
            return card;
        });

        const cardStrs = selected.map(c => {
            if (typeof c === 'string') return c;
            return `${c.suit}_${c.rank}`;
        });
        playCards(cardStrs);

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
        console.log('🏴 Game.jsx handleBuryCardClick:', index, 'cardStr:', cardStr, 'type:', typeof cardStr);
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
     * 渲染发牌状态提示（屏幕正中间）
     */
    renderDealStatus = () => {
        const {dealProgress, bidState, phase} = this.props;
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
        const {phase, myHands, selectedCards, isMyTurn: isMyTurnProp, bankerId, turnSeatIndex, levelA, levelB, mainSuit, currentLevel, bankerTeam, players, deskCards, bidState, teamAScore, teamBScore, leadPlayCardCount, drawBottom} = this.props;
        const {error, currentAction, buryingSelectedCards, drawInfo} = this.state;

        return (
            <div className="game-page">
                <GameInfo
                    levelA={levelA}
                    levelB={levelB}
                    mainSuit={mainSuit}
                    currentLevel={currentLevel}
                    bankerTeam={bankerTeam}
                    players={players}
                    bidState={bidState}
                    mySeatIndex={this.props.mySeatIndex}
                    teamAScore={teamAScore}
                    teamBScore={teamBScore}
                />
                <Players
                    players={players}
                    mySeatIndex={this.props.mySeatIndex}
                    user={this.props.user}
                    bankerId={bankerId}
                    turnSeatIndex={turnSeatIndex}
                    levelA={levelA}
                    levelB={levelB}
                    phase={phase}
                    myHands={myHands}
                />
                <DeskCards
                    deskCards={deskCards}
                    mySeatIndex={this.props.mySeatIndex}
                />

                {this.renderCardDeck()}

                {this.renderDealStatus()}


                <div className="hand-area">
                    <HandCards
                        myHands={myHands}
                        selectedCards={selectedCards}
                        isMyTurn={isMyTurnProp}
                        phase={phase}
                        currentLevel={currentLevel}
                        buryingSelectedCards={buryingSelectedCards}
                        onCardClick={(card, index) => this.handleCardClick(card, index)}
                        onBuryCardClick={(index, cardStr) => this.handleBuryCardClick(index, cardStr)}
                    />
                </div>

                 <ActionPanel
                     phase={phase}
                     isMyTurn={isMyTurnProp}
                     canCallBanker={this.props.canCallBanker}
                     canCallTrump={this.props.canCallTrump}
                     canLockBanker={this.props.canLockBanker}
                     canReverseBanker={this.props.canReverseBanker}
                     canLockTrump={this.props.canLockTrump}
                     canReverseTrump={this.props.canReverseTrump}
                     selectedCards={selectedCards}
                     availableBankerCards={this.props.availableBankerCards}
                     availableLockBankerCards={this.props.availableLockBankerCards}
                     availableTrumpCards={this.props.availableTrumpCards}
                    availableReverseCards={this.props.availableReverseCards}
                    drawBottom={drawBottom}
                    leadPlayCardCount={leadPlayCardCount}
                    currentAction={currentAction}
                    error={error}
                    buryingSelectedCards={buryingSelectedCards}
                    drawInfo={drawInfo}
                    onPlayCards={() => this.handlePlayCards()}
                    onClearSelection={() => this.props.clearSelection()}
                    onCallBanker={(cardStr) => this.handleCallBanker(cardStr)}
                    onLockBanker={(cardStr) => this.handleLockBanker(cardStr)}
                    onReverseBanker={(card) => this.handleReverseBanker(card)}
                    onCallTrump={(cardStr) => this.handleCallTrump(cardStr)}
                    onLockTrump={(cardStr) => this.handleLockTrump(cardStr)}
                    onReverseTrump={(cardStr) => this.handleReverseTrump(cardStr)}
                    onBuryBottom={() => this.handleBuryBottom()}
                    onDrawBottomOptionClick={(option) => this.handleDrawBottomOptionClick(option)}
                    onSkipDrawBottom={() => this.handleSkipDrawBottom()}
                />
                {this.renderRoundResult()}
                <GameResultModal
                    visible={this.state.showGameResult}
                    winnerTeam={this.state.gameResultData?.winnerTeam}
                    bankerTeam={this.state.gameResultData?.bankerTeam}
                    teamAScore={this.state.gameResultData?.teamAScore}
                    teamBScore={this.state.gameResultData?.teamBScore}
                    levelChange={this.state.gameResultData?.levelChange}
                    newLevelA={this.state.gameResultData?.newLevelA}
                    newLevelB={this.state.gameResultData?.newLevelB}
                    gameWinner={this.state.gameResultData?.gameWinner}
                    mySeatIndex={this.props.mySeatIndex}
                    autoClose={3000}
                    onClose={() => this.setState({showGameResult: false, gameResultData: null})}
                />
                {this.props.showRoundStarting && this.props.roundStartingData && (
                    <div className="round-starting-tip">
                        <div className="round-starting-content">
                            <div className="round-starting-title">
                                第{this.props.roundStartingData.nextRoundIndex}局即将开始，请做好准备
                            </div>
                            <div className="round-starting-info">
                                <span>庄家: 座位{this.props.roundStartingData.bankerSeat}</span>
                                <span className="separator">|</span>
                                <span>当前等级: {this.props.roundStartingData.level}级</span>
                            </div>
                        </div>
                    </div>
                )}
                <BottomRevealModal
                    visible={this.state.showBottomReveal}
                    bottomCards={this.state.bottomRevealData?.bottomCards}
                    winnerSeat={this.state.bottomRevealData?.winnerSeat}
                    winnerTeam={this.state.bottomRevealData?.winnerTeam}
                    bottomResult={this.state.bottomRevealData?.bottomResult}
                    teamAScore={this.state.bottomRevealData?.teamAScore}
                    teamBScore={this.state.bottomRevealData?.teamBScore}
                    onClose={() => this.setState({showBottomReveal: false, bottomRevealData: null})}
                />
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
     availableLockBankerCards: state.game.availableLockBankerCards,
     availableTrumpCards: state.game.availableTrumpCards,
    availableReverseCards: state.game.availableReverseCards,
    reverseSuit: state.game.reverseSuit,
    // 抄底阶段
    drawBottom: state.game.drawBottom,
    // 牌堆剩余张数
    remainingCards: state.game.remainingCards,
    // 首家出牌数量
    leadPlayCardCount: state.game.leadPlayCardCount
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
    setShowRoundStarting,
    setRoundStartingData,
    setCanCallBanker,
    setCanCallTrump,
    setCanLockBanker,
    setCanReverseBanker,
    setCanLockTrump,
    setCanReverseTrump,
    setAvailableBankerCards,
    setAvailableLockBankerCards,
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
    updatePlayer,
    setPlayerDisconnected,
    resetGame,
    setRemainingCards,
    setLeadPlayCardCount
};

// 使用 useNavigate 和 useParams 的包装组件
const GameWithNavigate = (props) => {
    const navigate = useNavigate();
    const params = useParams();
    return <Game {...props} navigate={navigate} roomCode={params.roomId}/>;
};

export default connect(mapStateToProps, mapDispatchToProps)(GameWithNavigate);
