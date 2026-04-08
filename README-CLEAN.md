# MongoDB 房间数据清理脚本

## 使用说明

这个脚本用于清理MongoDB中的所有房间相关数据。

### 运行步骤

1. **确保MongoDB服务正在运行**
   ```bash
   # 检查MongoDB状态
   mongod --status
   ```

2. **进入server目录**
   ```bash
   cd server
   ```

3. **运行清理脚本**
   ```bash
   node ../clean-room-data.js
   ```

### 清理范围

脚本将清理以下MongoDB集合中的所有数据：
- `rooms` - 房间基本信息
- `roomplayers` - 房间玩家关系
- `gamerounds` - 游戏回合信息
- `playercards` - 玩家手牌信息
- `playrecords` - 出牌记录
- `roundscores` - 回合得分信息

### 注意事项

1. **备份数据**：运行前请确保重要数据已备份
2. **环境变量**：如果使用了环境变量配置MongoDB连接，请确保`.env`文件存在
3. **确认操作**：脚本会显示将要删除的数据量，请仔细确认
4. **不可恢复**：删除操作无法恢复，请谨慎操作

### 停止脚本

如需停止脚本，按 `Ctrl+C` 即可。

### 验证清理结果

脚本运行完成后，会显示每个集合剩余的记录数，用于验证清理是否成功。