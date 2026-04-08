/**
 * 验证新创建的房间
 */

const mongoose = require('mongoose');
const Room = require('./src/models/Room');
const RoomPlayer = require('./src/models/RoomPlayer');
const User = require('./src/models/User');

async function verifyPlayer1Room() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/sjgame', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功');

    // 查找新创建的房间（房间号 111586）
    const room = await Room.findOne({ roomCode: '111586' });
    if (!room) {
      console.log('❌ 找不到新房间');
      return;
    }

    console.log('📋 新房间信息:');
    console.log('- 房间ID:', room._id);
    console.log('- 房间号:', room.roomCode);
    console.log('- 房主ID:', room.ownerId);

    // 查找房主用户信息
    const ownerUser = await User.findById(room.ownerId);
    console.log('\n👤 房主用户信息:');
    console.log('- 用户名:', ownerUser?.username);
    console.log('- 用户ID:', ownerUser?._id);

    // 查找房间内的所有玩家
    const players = await RoomPlayer.find({ roomId: room._id });
    console.log('\n👥 房间内玩家:');
    console.log('玩家数量:', players.length);

    players.forEach((player, index) => {
      console.log(`\n玩家 ${index + 1}:`);
      console.log('- 用户ID:', player.userId);
      console.log('- 座位:', player.seatIndex);
      console.log('- 队伍:', player.team);
      console.log('- 是否房主:', player.isOwner);
      console.log('- 是否准备:', player.isReady);
    });

    // 查找关联的用户信息
    const playerInfo = await User.findById(players[0].userId);
    console.log('\n🎯 完整玩家信息:');
    console.log('- 用户名:', playerInfo?.username);
    console.log('- 用户ID:', playerInfo?._id);
    console.log('- 是否房主:', players[0].isOwner);

    // 检查player1的房主状态
    if (players[0].isOwner && ownerUser?.username === 'player1') {
      console.log('\n🎉 成功！player1是这个房间的房主！');
      console.log('房间号:', room.roomCode);
      console.log('房间ID:', room._id);
      console.log('你现在可以用player1账号登录，进入房间号:', room.roomCode);
      console.log('进入后你会看到自己是房主，可以点击"解散房间"按钮');
    } else {
      console.log('\n❌ 失败！player1不是房主');
    }

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 运行验证
verifyPlayer1Room();