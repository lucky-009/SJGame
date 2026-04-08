# 在线升级游戏前端设计文档 (完整技术方案)

---

## 一、 整体架构设计

### 1.1 技术选型
* **前端框架**：React (Class Component 模式，利用生命周期管理复杂的 Socket 监听)
* **状态管理**：Redux (作为单一事实来源，确保四人对局状态同步)
* **实时通信**：Socket.IO (处理毫秒级物理连接与事件推送)
* **UI 方案**：原生 CSS + Flexbox/Absolute 布局 (针对移动端横屏进行像素级适配)
* **路由管理**：React Router (定义登录、大厅、房间、对局、结算五大场景)

### 1.2 核心设计原则
* **数据驱动视图**：禁止直接操作 DOM，所有牌面升起、按钮隐藏必须由 Redux State 驱动。
* **逻辑与表现分离**：将复杂的“升级”牌型校验算法抽离至 `ruleEngine.js`。
* **移动端优先**：强制横屏适配，针对触屏优化“滑动选牌”体验。

---

## 二、 路由设计 (Navigation)

| 路径 | 页面名称 | 关键功能 |
| :--- | :--- | :--- |
| `/` | 登录页 | 用户鉴权、建立 Socket 连接、存入 Token |
| `/lobby` | 游戏大厅 | 实时房间列表推送、创建房间、在线人数统计 |
| `/room/:id` | 房间页 | 座位排序、准备/取消准备、房主权限控制 |
| `/game/:id` | 核心对局 | 核心对局逻辑、手牌管理、动画表现 |
| `/result/:id` | 结算页 | 抓分统计、抠底判定、等级升降动画 |

---

## 三、 页面结构与交互逻辑

### 3.1 游戏页布局 (Landscape Layout)


### 3.1 登录页 (`/`)
* **展示信息**：用户名输入框、登录按钮。
* **交互逻辑**：
    * **按钮启用条件**：用户名不为空。
    * **点击行为**：请求 API $\rightarrow$ 获取 Token $\rightarrow$ 存入 Redux & `localStorage` $\rightarrow$ 建立 Socket 连接 $\rightarrow$ 跳转大厅。

### 3.2 大厅页 (`/lobby`)
* **展示信息**：实时房间列表、在线玩家数、创建房间按钮。
* **交互逻辑**：
    * **加入房间**：房间未满员时可见。
    * **观战模式**：游戏已开始时可见。
    * **刷新机制**：通过 Socket 广播自动被动更新，无需手动刷新。

### 3.3 房间页 (`/room/:roomId`)
* **展示信息**：房间 ID、玩家列表（4个座位）、各玩家准备状态、房主标识。
* **交互元素与条件控制**：
    * `准备`：自身处于未准备状态时。
    * `取消准备`：自身处于已准备状态时。
    * `开始游戏`：仅房主可见，且所有人已准备。
    * `退出房间`：始终可见。

### 3.4 游戏页 (`/game/:roomId`) 【核心】

#### 📊 页面 UI 布局（强制横屏视觉）
由于是四人对局，采用环形布局：
* **顶部 (Opponent)**：展示对家信息、级牌等级、当前主花色。
* **两侧 (Left/Right)**：展示上下家头像、剩余手牌张数、出牌状态提示。
* **中央 (Table)**：展示本轮四方已打出的牌，以及倒计时进度条。
* **底部 (Self)**：玩家手牌区，支持点击、滑动多选。

```text
               [ 玩家 2 (对家) ]
                     |
[ 玩家 1 (上家) ] --- [ 中央牌桌 ] --- [ 玩家 3 (下家) ]
                     |
               [ 玩家 4 (自己) ]
               
```



### 3.5 游戏流程阶段 (Game Phases)
1.  **发牌阶段 (Dealing)**：动画逐张下发，同步 Redux 中的 `myHands`。
2.  **抢庄/抢主 (Bidding)**：用户点击“亮牌”，触发 `game:bid`，服务端确定主花色。
3.  **底牌处理 (Bottoming)**：庄家拿底牌（8张），选出 8 张废牌埋底。
4.  **出牌循环 (Playing)**：首家领出，其余三家跟牌。
5.  **单局结算 (Settling)**：统计抓分方分数，判定下局庄家。
---

## 四、 Redux 状态树设计 (State Tree)

```javascript
{
  // 基础信息
  user: { id: '', name: '', token: '' },
  
  // 房间状态
  room: {
    roomId: '',
    players: [], // { id, name, seatIndex, isReady }
    isHost: false,
    roomStatus: 'waiting' // waiting | playing | finished
  },

  // 核心对局状态
  game: {
    phase: 'none',      // dealing | bidding | bottoming | playing
    bankerId: '',       // 庄家ID
    mainSuit: '',       // Spade/Heart/Club/Diamond/None
    currentLevel: '2',  // 级牌等级
    
    myHands: [],        // 实时手牌数据 [{suit, rank, isMain}]
    selectedCards: [],  // 当前选中的手牌索引
    
    turnSeatIndex: 0,   // 当前该谁操作
    deskCards: {},      // 牌桌展示 { seat0: [], seat1: [] ... }
    
    roundScores: 0      // 抓分方已抓到的分数值 (5, 10, K)
  }
}
```
---

## 五、 Socket 事件通讯协议

### 5.1 客户端上报 (Emit)
* `game:ready`：玩家在房间内点击准备/取消准备。
* `game:bid`：玩家在发牌阶段进行抢庄、抢主或反主动作。
* `game:setBottom`：庄家选定 8 张牌作为底牌提交服务端。
* `game:play`：玩家确认出牌组合并提交校验。


### 5.2 服务端推送 (On)
* `sync:room_update`：人员进出、座位变动、准备状态同步广播。
* `sync:deal_cards`：下发初始手牌，前端据此触发发牌动画。
* `sync:update_turn`：广播当前操作权所属座位，启动前端倒计时。
* `sync:round_finish`：当前回合（四人各出一手）结束，广播谁大及抓分情况。
* `sync:game_over`：整局结束，下发等级变动、庄闲转换数据。
* `room_list_update`: 订阅房间列表变化

---

## 六、 核心 UI 逻辑控制

### 6.1 出牌按钮启用逻辑（计算属性）
```javascript
// 判定“出牌”按钮是否高亮可点击
const canPlay = (
  game.phase === 'playing' && 
  game.turnSeatIndex === mySeatIndex && 
  game.selectedCards.length > 0 &&
  RuleEngine.checkValid(game.selectedCards, game.deskCards.first)
);
```
## 六、 核心 UI 逻辑控制

### 6.1 出牌按钮启用逻辑（计算属性）
判定“出牌”按钮是否高亮可点击的逻辑如下：
- 游戏阶段 (game.phase) 必须等于 'playing'
- 当前操作人索引 (game.turnSeatIndex) 必须等于 玩家本人索引 (mySeatIndex)
- 已选牌数组 (game.selectedCards) 长度必须大于 0
- 选中的牌必须通过 RuleEngine.checkValid() 规则校验

### 6.2 选牌交互逻辑
- 点击选中：改变 Redux 中的 selected 属性，触发 CSS transform: translateY(-20px) 升起动画。
- 滑动多选：通过 touchstart 记录起点，touchmove 计算手指划过的坐标范围，实时批量更新 selectedCards 状态。

---

## 七、 移动端横屏适配方案

### 7.1 强制横屏 CSS (Orientation Lock)
当用户持握方式为竖屏时，使用媒体查询覆盖一层提示：
@media screen and (orientation: portrait) {
.rotate-mask {
display: flex;
position: fixed;
z-index: 10000;
/* 显示“请旋转手机以获得最佳体验” */
}
}

游戏主体容器采用固定宽高比布局：
.game-container {
width: 100vw;
height: 100vh;
position: relative;
overflow: hidden;
background-color: #0e3d0e; /* 经典牌桌绿 */
}

### 7.2 手牌间距算法 (Responsive Cards)
由于“升级”手牌极多（最高可达 33 张），需要根据手牌总数动态调整负 margin，确保不溢出屏幕：
.card-item {
width: 75px;
height: 105px;
margin-left: -45px;
transition: transform 0.1s ease-in-out;
}

---

## 八、 开发难点与建议

### 8.1 规则引擎实现 (RuleEngine)
建议使用纯函数编写判定逻辑，入参为：(当前选中的牌, 本轮首家出的牌, 当前主花色, 当前级牌)。
核心判定优先级：同花色跟牌 > 主牌毙掉 > 垫牌。

### 8.2 断线重连 (Reconnection)
- 利用 socket.io 自带的 reconnect 机制。
- 重连成功后，客户端立即发送 sync_request。
- 服务端应返回包含所有玩家手牌数、桌面残留牌、当前分数的全量快照 (Snapshot)，直接覆盖本地 Redux 状态。

### 8.3 动画性能优化
- 尽量使用 CSS3 硬件加速 (transform/opacity) 而非修改 top/left。
- 出牌到牌桌中央的过程建议使用 Absolute 配合 Transition，保持 60fps 的流畅度。

---

## 九、 结语
本方案为“在线升级”类项目提供了标准化的前端蓝图。通过“状态驱动”而非“过程驱动”的思路，可以极大降低多人实时对局中逻辑冲突的概率。
