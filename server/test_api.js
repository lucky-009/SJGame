/**
 * 测试API响应的脚本
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./src/index').app;

// 连接数据库
mongoose.connect('mongodb://localhost:27017/sjgame_test', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ 测试数据库连接成功');
  
  // 运行测试
  testAPI();
}).catch(err => {
  console.error('❌ 测试数据库连接失败:', err);
});

async function testAPI() {
  try {
    // 测试获取房间信息API
    const response = await request(app)
      .get('/api/room/830478')
      .set('Authorization', 'Bearer test-token'); // 需要实际的token
    
    console.log('\n🔍 API响应结果:');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.body, null, 2));
    
    if (response.body.success) {
      const { room, players } = response.body.data;
      console.log('\n📋 API返回的房间信息:');
      console.log('- 房间号:', room.roomCode);
      console.log('- 状态:', room.status);
      
      console.log('\n👥 API返回的玩家信息:');
      players.forEach((player, index) => {
        console.log(`\n玩家 ${index + 1}:`);
        console.log('- 用户名:', player.username);
        console.log('- 座位:', player.seatIndex);
        console.log('- 队伍:', player.team);
        console.log('- 是否房主:', player.isOwner);
        console.log('- 是否准备:', player.isReady);
      });
      
      // 检查每个玩家的isOwner字段
      const myPlayer = players.find(p => p.username === 'player1');
      if (myPlayer) {
        console.log('\n🎯 player1的房主状态:', myPlayer.isOwner ? '是房主' : '不是房主');
      }
    }
    
  } catch (error) {
    console.error('❌ API测试失败:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 测试数据库连接已关闭');
  }
}