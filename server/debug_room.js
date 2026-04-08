/**
 * 检查房间和玩家数据的调试脚本
 */

const mongoose = require('mongoose');
const Room = require('./src/models/Room');
const RoomPlayer = require('./src/models/RoomPlayer');
const User = require('./src/models/User');

async function checkRoomData() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/sjgame', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功');

    // 查找指定房间ID
    const roomId = '69cb89eb7b65fd90f1378ba3';
    const roomCode = '830478';
    console.log('\n🔍 查找房间:', roomId);
    console.log('房间号:', roomCode);

    // 先查找这个房间号的所有房间
    console.log('\n📋 查找所有房间号为 830478 的房间:');
    const allRooms = await Room.find({ roomCode: roomCode });
    console.log(`找到 ${allRooms.length} 个房间`);
    
    for (const r of allRooms) {
      console.log('\n房间详细信息:');
      console.log('- ID:', r._id);
      console.log('- 房间号:', r.roomCode);
      console.log('- 房主ID:', r.ownerId);
      console.log('- 状态:', r.status);
      console.log('- 创建时间:', r.createdAt);
      console.log('- 更新时间:', r.updatedAt);
      
      // 查找房主用户信息
      const ownerUser = await User.findById(r.ownerId);
      console.log('\n👤 房主用户信息:');
      console.log('- 用户名:', ownerUser?.username);
      console.log('- ID:', ownerUser?._id);
      
      // 查找房间内的所有玩家
      const players = await RoomPlayer.find({ roomId: r._id })
        .populate('userId', 'username nickname avatar')
        .sort({ seatIndex: 1 });
      
      console.log('\n👥 房间内玩家:');
      players.forEach((player, index) => {
        console.log(`\n玩家 ${index + 1}:`);
        console.log('- 用户名:', player.userId?.username);
        console.log('- 用户ID:', player.userId?._id);
        console.log('- 座位:', player.seatIndex);
        console.log('- 队伍:', player.team);
        console.log('- 是否房主:', player.isOwner);
        console.log('- 是否准备:', player.isReady);
        
        // 检查这个用户ID是否等于房主ID
        if (player.userId && r.ownerId.equals(player.userId._id)) {
          console.log('✅ 这是房主');
        } else {
          console.log('❌ 这不是房主');
        }
      });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      console.log('❌ 房间不存在');
      return;
    }

    console.log('📋 房间信息:');
    console.log('- ID:', room._id);
    console.log('- 房间号:', room.roomCode);
    console.log('- 房主ID:', room.ownerId);
    console.log('- 状态:', room.status);
    console.log('- 创建时间:', room.createdAt);
    console.log('- 更新时间:', room.updatedAt);

    // 查找房主用户信息
    const ownerUser = await User.findById(room.ownerId);
    console.log('\n👤 房主用户信息:');
    console.log('- 用户名:', ownerUser?.username);
    console.log('- ID:', ownerUser?._id);

    // 查找房间内的所有玩家
    console.log('\n👥 房间内玩家:');
    const players = await RoomPlayer.find({ roomId: room._id })
      .populate('userId', 'username nickname avatar')
      .sort({ seatIndex: 1 });

    players.forEach((player, index) => {
      console.log(`\n玩家 ${index + 1}:`);
      console.log('- 用户名:', player.userId?.username);
      console.log('- 用户ID:', player.userId?._id);
      console.log('- 座位:', player.seatIndex);
      console.log('- 队伍:', player.team);
      console.log('- 是否房主:', player.isOwner);
      console.log('- 是否准备:', player.isReady);
      
      // 检查这个用户ID是否等于房主ID
      if (player.userId && room.ownerId.equals(player.userId._id)) {
        console.log('✅ 这是房主');
      } else {
        console.log('❌ 这不是房主');
      }
    });

    // 检查是否有player1用户
    console.log('\n🔍 查找player1用户:');
    const player1User = await User.findOne({ username: 'player1' });
    if (player1User) {
      console.log('- player1用户ID:', player1User._id);
      
      // 查找player1在房间中的记录
      const player1InRoom = await RoomPlayer.findOne({ 
        roomId: room._id, 
        userId: player1User._id 
      });
      
      if (player1InRoom) {
        console.log('- player1在房间中的座位:', player1InRoom.seatIndex);
        console.log('- player1是否房主:', player1InRoom.isOwner);
      } else {
        console.log('- player1不在这个房间中');
      }
    } else {
      console.log('❌ 找不到player1用户');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 运行检查
checkRoomData();