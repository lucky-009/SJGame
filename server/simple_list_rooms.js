/**
 * 简单查看所有房间信息
 */

const mongoose = require('mongoose');
const Room = require('./src/models/Room');
const RoomPlayer = require('./src/models/RoomPlayer');

async function simpleListRooms() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/sjgame', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功');

    // 查找所有房间
    const rooms = await Room.find({}).sort({ createdAt: -1 });
    
    console.log(`📋 找到 ${rooms.length} 个房间:`);
    
    for (const room of rooms) {
      console.log(`\n🏠 房间 ${room.roomCode}:`);
      console.log('- 房间ID:', room._id);
      console.log('- 房主ID:', room.ownerId);
      console.log('- 状态:', room.status);
      console.log('- 创建时间:', room.createdAt);
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 运行查询
simpleListRooms();