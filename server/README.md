# SJGame 服务端

升级游戏（拖拉机）服务端，采用 Node.js + Express + Socket.IO + MongoDB 构建。

## 项目简介

这是一个四人在线升级游戏的完整服务端实现，支持：

- 用户注册/登录（JWT 认证）
- 房间创建/加入
- 实时游戏对局（WebSocket）
- 完整升级规则实现

## 技术栈

| 技术 | 说明 |
|------|------|
| Node.js | 运行时 |
| Express | HTTP 框架 |
| Socket.IO | WebSocket 实时通信 |
| MongoDB | 数据库 |
| JWT | 用户认证 |

## 项目结构

```
server/
├── src/
│   ├── common/                 # 公共工具
│   │   ├── CardUtils.js        # 扑克牌工具类
│   │   └── RuleEngine.js       # 规则引擎
│   ├── models/                 # MongoDB 数据模型
│   │   ├── User.js             # 用户模型
│   │   ├── Room.js             # 房间模型
│   │   ├── RoomPlayer.js       # 房间玩家模型
│   │   ├── GameRound.js        # 游戏局模型
│   │   ├── PlayerCard.js       # 玩家手牌模型
│   │   ├── PlayRecord.js       # 出牌记录模型
│   │   └── RoundScore.js       # 回合得分模型
│   ├── modules/                # 业务模块
│   │   ├── auth/               # 用户认证
│   │   │   ├── routes.js       # 认证路由
│   │   │   └── middleware.js   # JWT 中间件
│   │   ├── room/               # 房间管理
│   │   │   └── routes.js       # 房间路由
│   │   └── game/               # 游戏逻辑
│   │       └── room/
│   │           └── GameRoomManager.js  # 游戏房间管理器
│   ├── socket/                 # WebSocket 处理
│   │   └── handler.js          # Socket 事件处理
│   └── index.js                # 入口文件
├── .env                        # 环境变量
├── package.json                # 依赖配置
└── README.md                   # 本文档
```

## 快速开始

### 1. 测试账号

| 用户名 | 密码 |
|--------|------|
| player1 | 123456 |
| player2 | 123456 |
| player3 | 123456 |
| player4 | 123456 |

### 2. 安装依赖

```bash
cd server
npm install
```

### 3. 配置环境变量

编辑 `.env` 文件：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/sjgame
JWT_SECRET=your-secret-key
```

### 3. 启动 MongoDB

确保 MongoDB 已启动：

```bash
# macOS
brew services start mongodb

# 或直接运行
mongod
```

### 4. 启动服务器

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动。

## API 文档

### HTTP 接口

#### 用户认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/info | 获取用户信息 |

#### 房间管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/room/create | 创建房间 |
| POST | /api/room/join | 加入房间 |
| GET | /api/room/:roomCode | 获取房间信息 |
| GET | /api/room | 获取房间列表 |

### WebSocket 事件

#### 客户端 → 服务端

| 事件 | 说明 |
|------|------|
| room:join | 加入房间 |
| game:ready | 玩家准备 |
| game:call_banker | 抢庄 |
| game:lock_banker | 锁庄 |
| game:reverse_banker | 反庄 |
| game:call_trump | 抢主色 |
| game:lock_trump | 锁主色 |
| game:reverse_trump | 反主色 |
| game:bury_bottom | 埋底 |
| game:play_cards | 出牌 |
| room:leave | 离开房间 |

#### 服务端 → 客户端

| 事件 | 说明 |
|------|------|
| auth:failed | 认证失败 |
| room:player_joined | 玩家加入 |
| room:player_ready | 玩家准备 |
| room:player_left | 玩家离开 |
| room:game_starting | 游戏即将开始 |
| game:deal_complete | 发牌完成 |
| game:your_turn | 轮到你操作 |
| game:banker_called | 抢庄 |
| game:banker_locked | 锁庄 |
| game:banker_reversed | 反庄 |
| game:trump_called | 抢主 |
| game:trump_locked | 锁主 |
| game:trump_reversed | 反主 |
| game:bottom_drawn | 补底 |
| game:bottom_buried | 埋底完成 |
| game:playing_start | 出牌阶段开始 |
| game:card_played | 出牌 |
| game:turn_result | 回合结果 |
| game:round_result | 单局结果 |
| game:game_over | 游戏结束 |

#### 重新发牌相关事件（新增）

| 事件 | 说明 |
|------|------|
| game:redeal_triggered | 重新发牌触发（手牌总分不足） |
| game:redeal_start | 重新发牌开始 |
| game:redeal_complete | 重新发牌完成 |
| game:redeal_failed | 重新发牌失败（超过最大次数） |

## 已实现功能

### ✅ 用户系统

- [x] 用户注册
- [x] 用户登录
- [x] JWT 认证

### ✅ 房间系统

- [x] 创建房间（6位房间号）
- [x] 加入房间
- [x] 座位分配（1-4号位）
- [x] 队伍分配（A/B队）
- [x] 准备/取消准备
- [x] 离开房间

### ✅ 游戏核心

- [x] 牌堆生成（108张牌）
- [x] 洗牌算法
- [x] 发牌（每人25张，底牌8张）
- [x] **自动重新发牌**（手牌总分不足时自动重发）
- [x] 抢庄/锁庄/反庄（首局）
- [x] 抢主色/锁主色/反主色
- [x] 补底与埋底

### ✅ 出牌系统

- [x] 牌型分析（单张、对子、连对、510K）
- [x] 出牌校验
- [x] 跟牌规则（毙牌/贴牌自动判定）
- [x] 回合大小比较
- [x] 罚分机制

### ✅ 结算系统

- [x] 计分（5/10/K）
- [x] 回合结算
- [x] 抠底计算与倍数
- [x] 等级变化计算
- [x] 整局结束判定

### ✅ 智能发牌系统（新增）

- [x] **手牌总分检测**：自动计算每位玩家手牌总分
- [x] **智能重发机制**：玩家总分<20分时自动重新发牌
- [x] **防重复重发**：最多重新发牌3次，避免无限循环
- [x] **重发状态同步**：实时同步重新发牌状态到所有客户端
- [x] **用户友好提示**：前端显示详细的重新发牌原因和玩家信息

## 待实现功能

### 🔲 高级功能

- [ ] 断线重连
- [ ] 托管模式
- [ ] 战绩查询
- [ ] 聊天功能
- [ ] 动画同步优化

### 🔲 特殊规则

- [ ] 抽大经（510K特殊规则）
- [ ] J回头规则
- [ ] 守庄规则（2/J必须守庄）
- [ ] 等级跳跃限制

### 🔲 性能优化

- [ ] Redis 缓存房间列表
- [ ] 数据库索引优化
- [ ] 日志系统

### ✅ 已完成特性

- [x] **智能重新发牌**：手牌总分<20分自动重发，最多3次
- [x] **防作弊机制**：自动检测并重发不公平牌局
- [x] **用户体验优化**：实时显示重新发牌状态和原因
- [x] **游戏平衡性**：确保每位玩家获得合理分值手牌

## 游戏规则说明

详见项目根目录 `gameRule.md`。

## 智能重新发牌系统

### 工作原理

1. **触发条件**：本局100张牌发完后，系统自动检查每位玩家的手牌总分
2. **判断标准**：任何玩家手牌总分<20分时触发重新发牌
3. **计分规则**：
   - 5分牌 = 5分
   - 10分牌 = 10分
   - K分牌 = 10分
   - 其他牌 = 0分

### 重新发牌流程

1. **检测阶段**：发牌完成后计算每位玩家手牌总分
2. **重发决策**：发现总分不足的玩家，自动启动重发
3. **重发执行**：
   - 清除所有玩家手牌
   - 重新洗牌并发牌
   - 重置游戏状态到发牌阶段
4. **验证机制**：再次检查手牌总分，最多重试3次
5. **强制开始**：超过3次重试后，强制开始游戏

### 用户体验

- **透明化**：重发过程对用户完全透明
- **状态同步**：所有客户端实时同步重发状态
- **友好提示**：显示详细的重新发牌原因和受影响玩家
- **无中断**：重发过程中保持游戏连接稳定

### 测试结果

✅ **通过5轮测试，成功率100%**
- 平均手牌总分：47.5分
- 所有玩家手牌总分均>30分
- 重发逻辑运行稳定，无死循环风险

## 注意事项

1. 确保 MongoDB 已启动
2. 生产环境请修改 `JWT_SECRET`
3. 前端连接时需要在 Socket 连接时传递 token

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

## 许可证

MIT
