/**
 * 用player1创建新房间的脚本
 */

const mongoose = require('mongoose');
const Room = require('./src/models/Room');
const RoomPlayer = require('./src/models/RoomPlayer');
const User = require('./src/models/User');

async function createNewRoom() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/sjgame', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功');

    // 查找player1用户
    const player1 = await User.findOne({ username: 'player1' });
    if (!player1) {
      console.log('❌ 找不到player1用户');
      return;
    }

    console.log('👤 找到player1用户:', player1);

    // 生成唯一房间号
    let roomCode;
    let exists = true;
    while (exists) {
      roomCode = Math.floor(Math.random() * 900000) + 100000; // 6位数字
      exists = await Room.findOne({ roomCode });
    }

    console.log('🎯 生成房间号:', roomCode);

    // 创建房间
    const room = new Room({
      roomCode,
      ownerId: player1._id,
      status: 'waiting',
      maxPlayers: 4,
      levelA: 2,
      levelB: 2
    });

    await room.save();
    console.log('🏠 房间创建成功:', room);

    // 创建房主玩家记录
    const roomPlayer = new RoomPlayer({
      roomId: room._id,
      userId: player1._id,
      seatIndex: 0,  // 1号位
      team: 'A',  // 1号位默认为A队
      isReady: false,
      isOwner: true
    });

    await roomPlayer.save();
    console.log('👤 玩家记录创建成功:', roomPlayer);

    console.log('\n🎉 新房间创建成功！');
    console.log('📋 房间信息:');
    console.log('- 房间ID:', room._id);
    console.log('- 房间号:', room.roomCode);
    console.log('- 房主:', player1.username);
    console.log('- 房主ID:', player1._id);
    console.log('- 状态:', room.status);

    console.log('\n👤 player1现在可以进入这个房间，并且是房主');
    console.log('房间号:', room.roomCode);

  } catch (error) {
    console.error('❌ 创建房间失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 运行创建房间
createNewRoom();