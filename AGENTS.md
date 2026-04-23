# Game.jsx 模块化拆分计划

## 目标
将 2376 行的 `Game.jsx` 拆分为多个可维护的模块。

## 当前进度
- 主文件: `frontend/src/pages/Game/Game.jsx` (1902行) - 已减少 **474行**
- 包含: Socket事件监听、事件处理、操作方法、渲染方法、工具函数、Redux连接

## 已完成模块 (Phase 1-5)
| 模块 | 状态 | 行数 |
|------|------|------|
| utils/gameUtils.js | ✅ 完成 | 121 |
| hooks/gameActions.js | ✅ | 137 |
| hooks/useGameTimer.js | ✅ | 45 |
| handlers/dealingHandlers.js | ✅ | 196 |
| handlers/biddingHandlers.js | ✅ | 190 |
| handlers/playingHandlers.js | ✅ | 79 |
| handlers/drawBottomHandlers.js | ✅ | 182 |
| components/HandCards.jsx | ✅ | 51 |
| components/DeskCards.jsx | ✅ | 32 |
| components/Players.jsx | ✅ | 90 |
| components/GameInfo.jsx | ✅ | 83 |
| components/ActionPanel.jsx | ✅ | 223 |

## 剩余工作
- Phase 6: 删除 Game.jsx 中重复的 handlers 方法定义 (~600行)
- Phase 7: 拆分操作方法 handleCardClick/handlePlayCards 等 (~200行)

## 拆分结构

```
frontend/src/pages/Game/
├── Game.jsx                    # 主页面 (~200行) - 仅保留 render 和 Redux 连接
├── hooks/
│   ├── useGameTimer.js         # 计时器逻辑 (~50行)
│   └── useGameActions.js      # 游戏操作方法 (~150行)
├── handlers/
│   ├── dealingHandlers.js      # 发牌阶段处理 (~200行)
│   ├── biddingHandlers.js     # 抢庄/抢主处理 (~200行)
│   ├── playingHandlers.js     # 出牌阶段处理 (~150行)
│   └── drawBottomHandlers.js   # 抄底阶段处理 (~200行)
├── components/
│   ├── HandCards.jsx           # 手牌区域 (~80行)
│   ├── DeskCards.jsx          # 桌面牌区域 (~30行)
│   ├── GameInfo.jsx           # 等级/主花色 (~80行)
│   ├── ActionPanel.jsx        # 操作面板 (~150行)
│   └── Players.jsx            # 玩家信息 (~80行)
└── utils/
    └── gameUtils.js            # 工具函数 (~150行)
```

## 执行顺序（低风险优先）

### Phase 1: 工具函数 (gameUtils.js)
**预计减少**: ~150行

需拆分方法:
- `parseCardString()` - 解析牌字符串
- `sortHandCards()` - 手牌排序
- `getSeatPosition()` - 座位位置计算
- `renderCardButtons()` - 卡片按钮渲染
- `renderLockBankerButtons()` - 锁庄按钮
- `renderLockTrumpButtons()` - 锁主按钮

### Phase 2: 游戏操作 (useGameActions.js)
**预计减少**: ~150行

需拆分方法:
- `handleCardClick()` - 选牌
- `handlePlayCards()` - 出牌
- `handleCallBanker()` - 抢庄
- `handleLockBanker()` - 锁庄
- `handleReverseBanker()` - 反庄
- `handleCallTrump()` - 抢��
- `handleLockTrump()` - 锁主
- `handleReverseTrump()` - 反主
- `handleBuryCardClick()` - 埋底选牌
- `handleBuryBottom()` - 埋底

### Phase 3: 事件处理 Handlers
**预计减少**: ~600行

1. **dealingHandlers.js** - 发牌阶段
   - handleDealStart
   - handleCardDealt
   - handleDealComplete
   - handleRedealTriggered
   - handleRedealStart
   - handleRedealComplete
   - handleRedealFailed

2. **biddingHandlers.js** - 抢庄/抢主阶段
   - handleCanCallBanker
   - handleCanLockBanker
   - handleCanReverseBanker
   - handleCanCallTrump
   - handleCanLockTrump
   - handleCanReverseTrump
   - handleBidStateChanged
   - handleBidRejected
   - handleBidTimeout
   - handleBankerCalled
   - handleBankerLocked
   - handleTrumpCalled
   - handleTrumpReversed
   - handleYourTurn (入口)

3. **playingHandlers.js** - 出牌阶段
   - handleCardPlayed
   - handleTurnResult
   - handlePlayingStart

4. **drawBottomHandlers.js** - 抄底阶段
   - handleAskDrawBottom
   - handleDrawBottomSuccess
   - handleDrawBottomFailed
   - handleDrawBottomTimeout
   - handleDrawBottomSkipped
   - handleDrawBottomComplete
   - handleDrawBottomFatal
   - handleBottomReveal
   - startDrawBottomTimer
   - clearDrawBottomTimer
   - handleSubmitDrawBottom
   - handleDrawBottomOptionClick
   - submitDrawBottom
   - handleSkipDrawBottom

### Phase 4: UI 组件拆分
**预计减少**: ~400行

1. **HandCards.jsx**
   - 渲染自己的手牌
   - 选牌/埋底选牌逻辑

2. **DeskCards.jsx**
   - 渲染桌面牌

3. **Players.jsx**
   - 渲染4个玩家信息

4. **GameInfo.jsx**
   - 等级显示、主花色

5. **ActionPanel.jsx**
   - 出牌按钮
   - 抢庄/抢主按钮
   - 埋底按钮
   - 抄底选项

### Phase 5: Hooks 拆分
**预计减少**: ~100行

1. **useGameTimer.js**
   - startTimer / clearTimer
   - startDrawBottomTimer / clearDrawBottomTimer

2. **Socket 事件** (可选，最后处理)
   - setupSocketListeners
   - 各事件的注册/注销

## 拆分原则

1. **向后兼容**: 先拆分，不改变现有行为
2. **小步快跑**: 每完成一个模块后测试
3. **保持引用不变**: 使用命名导出，方便后续重构
4. **Props 传递**: 新组件通过 props 接收数据

## 风险控制

- Phase 1-2 为纯函数，风险最低
- Phase 3 涉及事件处理，需要小心 this 绑定
- Phase 4 涉及 UI 渲染，需要同步 Redux 状态

## 完成标准

1. Game.jsx 减少到 300 行以内
2. 所有功能保持正常
3. 类型检查通过
