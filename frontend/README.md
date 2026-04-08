# SJGame - 在线升级游戏前端

四人在线扑克游戏（升级）前端应用，采用 React + Redux + Socket.IO 技术栈开发。

## 项目介绍

本项目是"升级"扑克游戏的 Web 前端实现。升级是一款四人对抗的扑克游戏，支持实时在线对战。

### 核心特性

- 实时多人在线对战
- 完整的升级游戏规则实现
- 移动端横屏适配
- 流畅的动画体验

## 技术栈

- **框架**: React 18 (Class Component 模式)
- **状态管理**: Redux + Redux Toolkit
- **路由**: React Router v6
- **实时通信**: Socket.IO Client
- **构建工具**: Vite

## 项目结构

```
frontend/
├── src/
│   ├── components/          # 可复用 UI 组件
│   │   ├── Card/          # 扑克牌组件
│   │   ├── PlayerInfo/    # 玩家信息组件
│   │   ├── Timer/         # 倒计时组件
│   │   └── Button/        # 按钮组件
│   │
│   ├── pages/             # 页面组件
│   │   ├── Login/         # 登录页
│   │   ├── Lobby/         # 大厅页
│   │   ├── Room/          # 房间页
│   │   ├── Game/          # 游戏页（核心对局）
│   │   └── Result/        # 结算页
│   │
│   ├── store/             # Redux Store
│   │   ├── index.js       # Store 配置
│   │   ├── userSlice.js   # 用户状态
│   │   ├── roomSlice.js   # 房间状态
│   │   └── gameSlice.js   # 游戏状态
│   │
│   ├── services/          # 服务层
│   │   ├── api.js         # HTTP 请求封装
│   │   └── socket.js      # Socket 连接管理
│   │
│   ├── utils/             # 工具函数
│   │   ├── constants.js   # 常量定义
│   │   └── cardUtils.js   # 牌相关工具
│   │
│   ├── ruleEngine/        # 游戏规则引擎
│   │   ├── index.js       # 导出入口
│   │   ├── card.js        # 牌型判断
│   │   ├── follow.js      # 跟牌规则
│   │   └── compare.js     # 大小比较
│   │
│   ├── styles/            # 全局样式
│   │   └── index.css
│   │
│   ├── App.jsx            # 根组件
│   └── main.jsx          # 入口文件
│
├── index.html
├── package.json
└── vite.config.js
```

## 已实现功能

### 基础功能
- [x] 用户登录/注册
- [x] Token 认证
- [x] 房间创建/加入
- [x] 房间准备系统
- [x] 房主权限控制

### 游戏核心
- [x] Redux 状态管理
- [x] Socket 实时通信
- [x] 发牌阶段 UI
- [x] 抢庄/抢主阶段
- [x] 底牌处理（埋底）
- [x] 出牌阶段
- [x] 选牌交互（点击/滑动）
- [x] 回合结算
- [x] 单局结算

### UI/UX
- [x] 强制横屏适配
- [x] 竖屏提示遮罩
- [x] 玩家环形布局
- [x] 倒计时组件
- [x] 扑克牌组件
- [x] 动画效果

### 规则引擎
- [x] 牌型识别（单张、对子、连对、510K）
- [x] 主牌判断
- [x] 跟牌规则校验
- [x] 大小比较
- [x] 分数计算
- [x] 抠底倍数计算

## 待办事项

### 高优先级
- [ ] 后端 API 对接（当前为模拟数据）
- [ ] 完整的 Socket 事件处理
- [ ] 断线重连功能
- [ ] 抢庄/抢主 UI 交互
- [ ] 埋底选择 UI
- [ ] 抄底 UI
- [ ] 特殊规则：抽大经
- [ ] 罚分机制

### 中优先级
- [ ] 出牌动画优化
- [ ] 触摸滑动选牌
- [ ] 牌型提示功能
- [ ] 断线提示
- [ ] 房间内聊天功能
- [ ] 音效

### 低优先级
- [ ] 背景音乐
- [ ] 成就系统
- [ ] 排行榜
- [ ] 社交功能

## 开发指南

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 React Class Component 模式
- Redux 状态更新使用 Redux Toolkit

## API 配置

在 `src/utils/constants.js` 中配置 API 和 Socket 地址：

```javascript
export const API_BASE_URL = 'http://localhost:3000/api';
export const SOCKET_URL = 'http://localhost:3000';
```

## 游戏规则概述

### 基本规则
- 四名玩家按顺时针编号为1~4号位
- 1号位与3号位为队伍A，2号位与4号位为队伍B
- 使用两副扑克牌（共108张）
- 队伍率先升到A，并在A等级以庄家队伍赢得对局则获得整场胜利

### 游戏阶段
1. 发牌阶段 - 每人25张，剩余8张底牌
2. 抢庄阶段（首局）- 确定庄家队伍
3. 抢主阶段 - 确定主花色
4. 底牌处理 - 庄家拿底牌并埋底
5. 出牌阶段 - 四人轮流出牌
6. 结算阶段 - 计算得分和等级变化

## 注意事项

1. 当前版本前端为完整实现，但需要后端服务配合
2. 后端未实现时，登录和房间操作使用模拟数据
3. 移动端强制横屏，请使用手机横屏体验
4. 开发时需要同时启动前端和后端服务

## 版本

当前版本: 1.0.0

## 许可证

MIT License
