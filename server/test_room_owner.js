/**
 * 模拟API调用来测试房主信息问题
 */

const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/sjgame', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ 数据库连接成功');
  
  // 测试API响应
  testAPI();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err);
});

async function testAPI() {
  try {
    console.log('\n🔍 测试获取房间信息 API...');
    
    // 直接测试数据库查询
    const Room = require('./src/models/Room');
    const RoomPlayer = require('./src/models/RoomPlayer');
    const User = require('./src/models/User');
    
    // 获取房间号 830478
    const room = await Room.findOne({ roomCode: '830478' });
    if (!room) {
      console.log('❌ 房间不存在');
      return;
    }
    
    console.log('\n📋 房间基本信息:');
    console.log('- ID:', room._id);
    console.log('- 房间号:', room.roomCode);
    console.log('- 房主ID:', room.ownerId);
    
    // 获取所有玩家信息
    const players = await RoomPlayer.find({ roomId: room._id })
      .populate('userId', 'username nickname avatar')
      .sort({ seatIndex: 1 });
    
    console.log('\n👥 玩家详细信息:');
    players.forEach((player, index) => {
      console.log(`\n玩家 ${index + 1}:`);
      console.log('- 用户名:', player.userId?.username);
      console.log('- 用户ID:', player.userId?._id);
      console.log('- 座位:', player.seatIndex);
      console.log('- 队伍:', player.team);
      console.log('- 是否房主:', player.isOwner);
      console.log('- 是否准备:', player.isReady);
    });
    
    // 模拟API响应格式
    const playerList = players.map(p => ({
      userId: p.userId._id,
      username: p.userId.username,
      nickname: p.userId.nickname,
      seatIndex: p.seatIndex,
      team: p.team,
      isReady: p.isReady,
      isOwner: p.isOwner
    }));
    
    console.log('\n🎯 模拟API响应:');
    console.log(JSON.stringify({
      success: true,
      data: {
        room: {
          id: room._id,
          roomCode: room.roomCode,
          status: room.status,
          levelA: room.levelA,
          levelB: room.levelB,
          currentRound: room.currentRound
        },
        players: playerList,
        playerCount: players.length
      }
    }, null, 2));
    
    // 检查player1的房主状态
    const player1 = playerList.find(p => p.username === 'player1');
    if (player1) {
      console.log('\n🎯 player1的房主状态:');
      console.log('- 用户名:', player1.username);
      console.log('- 用户ID:', player1.userId);
      console.log('- 是否房主:', player1.isOwner ? '✅ 是房主' : '❌ 不是房主');
      
      if (!player1.isOwner) {
        console.log('\n🔍 分析问题:');
        console.log('1. player1的用户ID:', player1.userId);
        console.log('2. 房主用户ID:', room.ownerId);
        console.log('3. 两者是否相等:', player1.userId.equals(room.ownerId) ? '相等' : '不相等');
        console.log('4. 数据库中player1的isOwner字段:', players.find(p => p.userId.username === 'player1')?.isOwner);
      }
    } else {
      console.log('\n❌ 房间中找不到player1');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}