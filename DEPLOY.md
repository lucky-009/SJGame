# SJGame 部署步骤说明

## 环境要求
- Node.js 18+
- MongoDB（后端依赖）

---

## 一、前置准备

### 1. 修改前端 API 地址
部署前需要将前端连接地址改为服务器 IP：

**文件：** `frontend/src/utils/constants.js`

```javascript
// 第 171 行
export const API_BASE_URL = 'http://你的服务器IP:3000/api';

// 第 174 行  
export const SOCKET_URL = 'http://你的服务器IP:3000';
```

### 2. 配置后端环境变量
在 `server/` 目录下创建 `.env` 文件：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/sjgame
JWT_SECRET=your_secret_key_here
```

---

## 二、服务器部署步骤

### 1. 上传项目到服务器
```bash
# 方式一：通过 scp 上传
scp -r ./server user@服务器IP:/home/user/
scp -r ./frontend user@服务器IP:/home/user/

# 方式二：使用 Git:30000
git clone your-repo-url
```

### 2. 安装依赖

**后端：**
```bash
cd server
npm install --production
```

**前端：**
```bash
cd frontend
npm install
npm run build  # 构建生产版本
```

### 3. 启动服务

**后端（端口 3000）：**
```bash
cd server
npm start
# 或使用 pm2 守护进程
pm2 start npm --name "sjgame-server" -- start
```

**前端（端口 5173）：**
```bash
cd frontend
npm run preview -- --host 0.0.0.0 --port 5173
# 或使用 pm2
pm2 start npm --name "sjgame-frontend" -- run preview -- --host 0.0.0.0 --port 5173
```

---

## 三、PM2 进程管理（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
pm2 start server/src/index.js --name "sjgame-server"

# 启动前端
cd frontend
pm2 start npm --name "sjgame-frontend" -- run preview -- --host 0.0.0.0 --port 5173

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启
pm2 restart all
```

---

## 四、验证部署

- 后端：http://服务器IP:3000/api （应该有响应）
- 前端：http://服务器IP:5173 （应该看到登录页面）
- WebSocket：连接 ws://服务器IP:3000 （正常连接）

---

## 五、常见问题

1. **MongoDB 连接失败**：检查 `MONGODB_URI` 是否正确，确保 MongoDB 已启动
2. **前端无法连接后端**：确认 `constants.js` 中的 IP 地址已修改
3. **端口被占用**：使用 `lsof -i:3000` 或 `lsof -i:5173` 检查
