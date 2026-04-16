# SJGame API 对接文档

本文档包含所有已实现的 HTTP API 和 Socket 事件列表。

---

## 一、HTTP API

基础 URL: `http://localhost:3000`

### 1. 用户认证

#### 1.1 用户注册

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/auth/register` |
| Content-Type | application/json |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | String | 是 | 用户名，2-20字符 |
| password | String | 是 | 密码，最少6字符 |
| nickname | String | 否 | 昵称，默认等于用户名 |

**请求示例**
```json
{
  "username": "player1",
  "password": "123456",
  "nickname": "玩家一"
}
```

**响应成功**
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "player1",
      "nickname": "玩家一",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**响应失败**
```json
{
  "success": false,
  "message": "用户名已存在"
}
```

---

#### 1.2 用户登录

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/auth/login` |
| Content-Type | application/json |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | String | 是 | 用户名 |
| password | String | 是 | 密码 |

**请求示例**
```json
{
  "username": "player1",
  "password": "123456"
}
```

**响应成功**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "player1",
      "nickname": "玩家一"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**响应失败**
```json
{
  "success": false,
  "message": "用户名或密码错误"
}
```

---

#### 1.3 获取用户信息

| 项目 | 内容 |
|------|------|
| 方法 | GET |
| 路径 | `/api/auth/info` |
| Header | Authorization: Bearer {token} |

**响应成功**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "player1",
      "nickname": "玩家一",
      "avatar": ""
    }
  }
}
```

**响应失败**
```json
{
  "success": false,
  "message": "无效的 token"
}
```

---

#### 1.4 用户退出登录

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/auth/logout` |
| Header | Authorization: Bearer {token} |

**响应成功**
```json
{
  "success": true,
  "message": "退出登录成功"
}
```

**响应失败**
```json
{
  "success": false,
  "message": "无效的 token"
}
```

---

### 2. 房间管理

#### 2.1 创建房间

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/room/create` |
| Header | Authorization: Bearer {token} |
| Content-Type | application/json |

**请求参数**

无（用户ID从token中获取）

**响应成功**
```json
{
  "success": true,
  "message": "房间创建成功",
  "data": {
    "room": {
      "id": "507f1f77bcf86cd799439011",
      "roomCode": "123456",
      "status": "waiting",
      "ownerId": "507f1f77bcf86cd799439011"
    },
    "player": {
      "seatIndex": 0,
      "team": "A",
      "isOwner": true
    }
  }
}
```

---

#### 2.2 加入房间

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/room/join` |
| Header | Authorization: Bearer {token} |
| Content-Type | application/json |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| roomCode | String | 是 | 6位房间号 |

**请求示例**
```json
{
  "roomCode": "123456"
}
```

**响应成功**
```json
{
  "success": true,
  "message": "加入房间成功",
  "data": {
    "room": {
      "id": "507f1f77bcf86cd799439011",
      "roomCode": "123456",
      "status": "waiting"
    },
    "player": {
      "seatIndex": 1,
      "team": "B",
      "isOwner": false
    }
  }
}
```

**响应失败**
```json
{
  "success": false,
  "message": "房间不存在"
}
```

---

#### 2.3 获取房间信息

| 项目 | 内容 |
|------|------|
| 方法 | GET |
| 路径 | `/api/room/:roomCode` |
| Header | Authorization: Bearer {token} |

**路径参数**

| 参数名 | 说明 |
|--------|------|
| roomCode | 6位房间号 |

**响应成功**
```json
{
  "success": true,
  "data": {
    "room": {
      "id": "507f1f77bcf86cd799439011",
      "roomCode": "123456",
      "status": "waiting",
      "levelA": 2,
      "levelB": 2,
      "currentRound": 0
    },
    "players": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "username": "player1",
        "nickname": "玩家一",
        "seatIndex": 0,
        "team": "A",
        "isReady": false,
        "isOwner": true
      }
    ],
    "playerCount": 1
  }
}
```

---

#### 2.4 获取房间列表

| 项目 | 内容 |
|------|------|
| 方法 | GET |
| 路径 | `/api/room` |
| Header | Authorization: Bearer {token} |

**响应成功**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": "507f1f77bcf86cd799439011",
        "roomCode": "123456",
        "status": "waiting",
        "levelA": 2,
        "levelB": 2,
        "playerCount": 2,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## 二、Socket API

连接地址: `http://localhost:3000`

**连接认证**

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

---

### 1. 连接与认证

#### 1.1 连接成功

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |

```javascript
socket.on('connect', () => {
  console.log('连接成功');
});
```

#### 1.2 认证失败

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | auth:failed |

```javascript
socket.on('auth:failed', (data) => {
  console.log(data.message); // '无效的 token'
});
```

---

#### 1.3 退出登录

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | auth:logout |

**说明**: 退出登录时通知服务端断开连接，清除在线状态

**发送参数**

无

**发送示例**
```javascript
socket.emit('auth:logout', {}, (response) => {
  console.log(response); // { success: true, message: '退出登录成功' }
});
```

---

### 2. 房间事件

#### 2.1 加入房间

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | room:join |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| roomCode | String | 是 | 6位房间号 |

**发送示例**
```javascript
socket.emit('room:join', { roomCode: '123456' }, (response) => {
  console.log(response);
});
```

**响应**
```json
{
  "success": true,
  "data": {
    "roomCode": "123456",
    "status": "waiting",
    "seatIndex": 1,
    "team": "B",
    "players": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "username": "player1",
        "seatIndex": 0,
        "team": "A",
        "isReady": false,
        "isOwner": true
      }
    ],
    "levelA": 2,
    "levelB": 2
  }
}
```

---

#### 2.2 玩家加入通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | room:player_joined |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | String | 玩家ID |
| username | String | 用户名 |
| seatIndex | Number | 座位号 (0-3) |
| team | String | 队伍 (A/B) |

```javascript
socket.on('room:player_joined', (data) => {
  console.log(`${data.username} 加入了房间，座位 ${data.seatIndex}`);
});
```

---

#### 2.3 玩家准备

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:ready |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| roomCode | String | 是 | 房间号 |
| isReady | Boolean | 是 | true=准备, false=取消准备 |

**发送示例**
```javascript
socket.emit('game:ready', { roomCode: '123456', isReady: true }, (response) => {
  console.log(response);
});
```

**响应**
```json
{
  "success": true
}
```

---

#### 2.4 玩家准备通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | room:player_ready |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | String | 玩家ID |
| seatIndex | Number | 座位号 |
| isReady | Boolean | 准备状态 |

---

#### 2.5 房间列表更新

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | room:list_updated |

**触发时机**: 房间创建、加入、离开、游戏开始/结束时自动推送

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| rooms | Array | 房间列表 |

**rooms 数组项**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | String | 房间ID |
| roomCode | String | 6位房间号 |
| status | String | 房间状态 (waiting/playing) |
| levelA | Number | A队等级 |
| levelB | Number | B队等级 |
| playerCount | Number | 当前玩家数 |
| createdAt | String | 创建时间 |

```javascript
socket.on('room:list_updated', (data) => {
  console.log('房间列表更新:', data.rooms);
});
```

---

#### 2.6 游戏即将开始

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | room:game_starting |

```javascript
socket.on('room:game_starting', () => {
  console.log('游戏即将开始');
});
```

---

#### 2.7 玩家离开

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | room:player_left |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | String | 玩家ID |
| seatIndex | Number | 座位号 |

---

#### 2.8 离开房间

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | room:leave |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| roomCode | String | 是 | 房间号 |

**发送示例**
```javascript
socket.emit('room:leave', { roomCode: '123456' }, (response) => {
  console.log(response);
});
```

---

### 3. 游戏事件

#### 3.1 房间列表更新（游戏相关）

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | room:list_updated |

**说明**: 当房间开始游戏时，该房间从等待列表中移除，客户端收到此事件后更新房间列表

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| rooms | Array | 房间列表 |

```javascript
socket.on('room:list_updated', (data) => {
  console.log('房间列表更新:', data.rooms);
});
```

---

#### 3.2 发牌完成

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:deal_complete |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| players | Array | 玩家手牌信息 |

```javascript
socket.on('game:deal_complete', (data) => {
  console.log(data.players);
  // [
  //   { seatIndex: 0, cardCount: 25 },
  //   { seatIndex: 1, cardCount: 25 },
  //   { seatIndex: 2, cardCount: 25 },
  //   { seatIndex: 3, cardCount: 25 }
  // ]
});
```

---

#### 3.3 轮到你操作

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:your_turn |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| action | String | 操作类型 |
| seatIndex | Number | 当前玩家座位 |
| level | Number | 当前等级 |
| handCards | Array | 玩家手牌 |
| trumpSuit | String | 主花色 (spade/heart/club/diamond) |
| isNoTrump | Boolean | 是否无主 |

**action 类型**

| 值 | 说明 |
|----|------|
| call_banker | 抢庄 |
| lock_banker | 锁庄 |
| call_trump | 抢主色 |
| lock_trump | 锁主色 |
| reverse_trump | 反主色 |
| bury_bottom | 埋底 |
| play_cards | 出牌 |

---

#### 3.4 抢庄

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:call_banker |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| card | String | 是 | 抢庄的牌 (如 "spade_2") |

**发送示例**
```javascript
socket.emit('game:call_banker', { card: 'heart_2' }, (response) => {
  console.log(response);
});
```

**响应**
```json
{
  "success": true
}
```

---

#### 3.5 抢庄通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:banker_called |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 抢庄玩家座位 |
| team | String | 队伍 (A/B) |
| card | String | 抢庄的牌 |
| suit | String | 花色 |

---

#### 3.6 锁庄

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:lock_banker |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| card | String | 是 | 锁庄的牌 (对子) |

---

#### 3.7 锁庄通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:banker_locked |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 锁庄玩家座位 |
| card | String | 锁庄的牌 |

---

#### 3.8 反庄

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:reverse_banker |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| card | String | 是 | 反庄的牌 (对子) |

---

#### 3.9 反庄通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:banker_reversed |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 反庄玩家座位 |
| team | String | 队伍 |
| card | String | 反庄的牌 |
| suit | String | 花色 |

---

#### 3.10 抢主色

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:call_trump |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| card | String | 是 | 抢主的牌 (当前等级牌) |

**发送示例**
```javascript
socket.emit('game:call_trump', { card: 'spade_3' }, (response) => {
  console.log(response);
});
```

---

#### 3.11 抢主通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:trump_called |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 抢主玩家座位 |
| suit | String | 主花色 |

---

#### 3.12 锁主色

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:lock_trump |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| card | String | 是 | 锁主的牌 (对子) |

---

#### 3.13 锁主通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:trump_locked |

---

#### 3.14 反主色

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:reverse_trump |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| card | String | 是 | 反主的牌 (对子) |

---

#### 3.15 反主通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:trump_reversed |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 反主玩家座位 |
| suit | String | 新主花色 |
| isNoTrump | Boolean | 是否无主 |

---

#### 3.16 补底

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:bottom_drawn |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 庄家座位 |
| bottomCards | Array | 底牌列表 |
| totalCards | Number | 补底后手牌数 |

---

#### 3.17 埋底

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:bury_bottom |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cards | Array | 是 | 8张埋底牌 |

**发送示例**
```javascript
socket.emit('game:bury_bottom', {
  cards: ['spade_2', 'spade_3', 'heart_5', 'club_8', 'diamond_9', 'heart_J', 'club_Q', 'diamond_K']
}, (response) => {
  console.log(response);
});
```

---

#### 3.18 埋底完成

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:bottom_buried |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 庄家座位 |
| buryCount | Number | 埋底数量 |

---

#### 3.19 出牌阶段开始

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:playing_start |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| bankerSeat | Number | 庄家座位 |
| bankerTeam | String | 庄家队伍 |
| trumpSuit | String | 主花色 |
| isNoTrump | Boolean | 是否无主 |
| level | Number | 当前等级 |
| currentTurn | Number | 当前回合 |

---

#### 3.20 出牌

| 事件 | 说明 |
|------|------|
| 方向 | 客户端 → 服务端 |
| 事件名 | game:play_cards |

**发送参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cards | Array | 是 | 要出的牌 |

**发送示例**
```javascript
socket.emit('game:play_cards', {
  cards: ['spade_7', 'spade_7', 'spade_8']
}, (response) => {
  console.log(response);
});
```

**响应成功**
```json
{
  "success": true
}
```

**响应失败（罚分）**
```json
{
  "success": false,
  "message": "出牌不满足规则",
  "penalty": 20
}
```

---

#### 3.21 出牌通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:card_played |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 出牌玩家座位 |
| cards | Array | 出的牌 |
| playType | String | 出牌类型 (normal/trumpKill/discard) |
| remainingCards | Number | 剩余手牌数 |

---

#### 3.22 罚分通知

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:play_penalty |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| seatIndex | Number | 被罚分玩家座位 |
| penalty | Number | 罚分分值 |
| reason | String | 罚分原因 |

---

#### 3.23 回合结果

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:turn_result |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| turnIndex | Number | 回合号 |
| winnerSeat | Number | 获胜玩家座位 |
| winnerTeam | String | 获胜队伍 |
| score | Number | 本回合得分 |
| teamAScore | Number | A队累计得分 |
| teamBScore | Number | B队累计得分 |
| isLastTurn | Boolean | 是否最后一回合 |

---

#### 3.24 抠底揭示

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:bottom_reveal |
| 触发时机 | 最后一轮结算完成后、单局结算前 |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| bottomCards | Array\<String\> | 底牌内容（8张） |
| winnerSeat | Number | 获胜玩家座位 |
| winnerTeam | String | 获胜队伍 (A/B) |
| bottomResult | Object/null | 抠底结果（闲家获胜时才有值） |
| └─ success | Boolean | 是否抠底成功 |
| └─ multiplier | Number | 抠底倍数 |
| └─ baseScore | Number | 底牌原始分数 |
| └─ drawScore | Number | 抠底得分 |
| └─ winnerTeam | String | 得分归属队伍 |
| teamAScore | Number | A队总分（含抠底） |
| teamBScore | Number | B队总分（含抠底） |

**前端处理建议**

- 展示底牌内容
- 闲家获胜时显示抠底倍数和得分
- 庄家获胜时显示"庄家获胜，无抠底"
- 5秒后自动继续结算

---

#### 3.25 单局结果

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:round_result |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| winner | String | 获胜方 (banker/opponent) |
| bankerTeam | String | 庄家队伍 |
| opponentScore | Number | 闲家得分 |
| levelChange | Number | 等级变化 |
| newLevelA | Number | A队新等级 |
| newLevelB | Number | B队新等级 |
| teamAScore | Number | A队总分 |
| teamBScore | Number | B队总分 |
| gameWinner | String/null | 最终获胜队伍 |

---

#### 3.26 游戏结束

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:game_over |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| winner | String | 获胜队伍 (A/B) |

---

#### 3.27 下一局开始

| 事件 | 说明 |
|------|------|
| 方向 | 服务端 → 客户端 |
| 事件名 | game:next_round |

**接收参数**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| roundIndex | Number | 局号 |
| level | Number | 当前等级 |
| bankerSeat | Number | 庄家座位 |
| bankerTeam | String | 庄家队伍 |
| trumpSuit | String | 主花色 |
| isNoTrump | Boolean | 是否无主 |

---

## 三、牌面表示

### 3.1 牌面字符串格式

```
{花色}_{点数}
```

### 3.2 花色

| 值 | 说明 |
|----|------|
| spade | 黑桃 ♠ |
| heart | 红桃 ♥ |
| club | 梅花 ♣ |
| diamond | 方片 ♦ |
| joker | 王牌 |

### 3.3 点数

| 值 | 说明 |
|----|------|
| 2-10 | 对应数字 |
| J | J |
| Q | Q |
| K | K |
| A | A |
| small | 小王 |
| big | 大王 |

### 3.4 示例

| 牌面字符串 | 对应牌 |
|-----------|--------|
| spade_A | ♠A |
| heart_5 | ♥5 |
| club_K | ♣K |
| joker_small | 小王 |
| joker_big | 大王 |

---

## 四、错误码

| 错误信息 | 说明 |
|---------|------|
| 房间不存在 | 房间号错误 |
| 房间已满 | 已加入4人 |
| 游戏已开始，无法加入 | 房间状态非 waiting |
| 您已在房间中 | 重复加入 |
| 当前不是您的操作回合 | 顺序错误 |
| 手牌中没有这张牌 | 牌不存在 |
| 出牌不满足规则 | 校验失败 |
| 必须埋8张底牌 | 数量错误 |
| A级不能埋分牌 | 规则限制 |

---

## 五、前端对接示例

### 5.1 初始化连接

```javascript
import { io } from 'socket.io-client';

class GameClient {
  constructor() {
    this.socket = null;
    this.token = localStorage.getItem('token');
  }

  connect() {
    this.socket = io('http://localhost:3000', {
      auth: { token: this.token }
    });

    this.socket.on('connect', () => {
      console.log('连接成功');
    });

    this.socket.on('auth:failed', (data) => {
      console.error('认证失败:', data.message);
    });
  }

  joinRoom(roomCode) {
    return new Promise((resolve, reject) => {
      this.socket.emit('room:join', { roomCode }, (response) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.message));
        }
      });
    });
  }

  ready(roomCode, isReady) {
    return new Promise((resolve, reject) => {
      this.socket.emit('game:ready', { roomCode, isReady }, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message));
        }
      });
    });
  }

  playCards(cards) {
    return new Promise((resolve, reject) => {
      this.socket.emit('game:play_cards', { cards }, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message));
        }
      });
    });
  }
}
```

### 5.2 事件监听

```javascript
// 玩家加入
this.socket.on('room:player_joined', (data) => {
  this.updatePlayerList(data);
});

// 玩家准备
this.socket.on('room:player_ready', (data) => {
  this.updateReadyStatus(data);
});

// 轮到你操作
this.socket.on('game:your_turn', (data) => {
  this.showActionPanel(data);
});

// 出牌通知
this.socket.on('game:card_played', (data) => {
  this.showPlayedCards(data);
});

// 回合结果
this.socket.on('game:turn_result', (data) => {
  this.showTurnResult(data);
});

// 单局结果
this.socket.on('game:round_result', (data) => {
  this.showRoundResult(data);
});

// 游戏结束
this.socket.on('game:game_over', (data) => {
  this.showGameOver(data.winner);
});
```
