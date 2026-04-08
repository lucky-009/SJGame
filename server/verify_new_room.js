/**
 * 验证新房间是否正确创建
 */

const mongoose = require('mongoose');
const Room = require('./src/models/Room');
const RoomPlayer = require('./src/models/RoomPlayer');
const User = require('./src/models/User');

async function verifyNewRoom() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/sjgame', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功');

    // 查找新创建的房间（房间号 783297）
    const room = await Room.findOne({ roomCode: '783297' });
    if (!room) {
      console.log('❌ 找不到新房间');
      return;
    }

    console.log('📋 新房间信息:');
    console.log('- 房间ID:', room._id);
    console.log('- 房间号:', room.roomCode);
    console.log('- 房主ID:', room.ownerId);
    console.log('- 状态:', room.status);

    // 查找房主用户信息
    const ownerUser = await User.findById(room.ownerId);
    console.log('\n👤 房主用户信息:');
    console.log('- 用户名:', ownerUser?.username);
    console.log('- 用户ID:', ownerUser?._id);

    // 查找房间内的所有玩家
    const players = await RoomPlayer.find({ roomId: room._id })
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
      if (player.userId && room.ownerId.equals(player.userId._id)) {
        console.log('✅ 这是房主');
      } else {
        console.log('❌ 这不是房主');
      }
    });

    // 检查player1的房主状态
    const player1InRoom = players.find(p => p.userId?.username === 'player1');
    if (player1InRoom) {
      console.log('\n🎯 player1的房主状态:');
      console.log('- 用户名:', player1InRoom.userId?.username);
      console.log('- 用户ID:', player1InRoom.userId?._id);
      console.log('- 是否房主:', player1InRoom.isOwner ? '✅ 是房主' : '❌ 不是房主');
      
      if (player1InRoom.isOwner) {
        console.log('\n🎉 成功！player1是这个房间的房主！');
        console.log('房间号:', room.roomCode);
        console.log('你现在可以用这个房间号进入游戏，并且会显示为房主');
      } else {
        console.log('\n❌ 失败！player1不是房主');
      }
    } else {
      console.log('\n❌ 房间中找不到player1');
    }

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 运行验证
verifyNewRoom();