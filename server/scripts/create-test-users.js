/**
 * 创建测试用户脚本
 * 运行: node scripts/create-test-users.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 连接数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjgame';

// 测试用户数据
const testUsers = [
  { username: 'test1', password: '123456', nickname: '测试玩家1' },
  { username: 'test2', password: '123456', nickname: '测试玩家2' },
  { username: 'test3', password: '123456', nickname: '测试玩家3' },
  { username: 'test4', password: '123456', nickname: '测试玩家4' },
  { username: 'admin', password: 'admin123', nickname: '管理员' }
];

async function createTestUsers() {
  try {
    // 连接数据库
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 连接成功');

    // 获取User模型
    const User = require('../src/models/User');

    // 清除现有测试用户（可选）
    const existingUsers = await User.find({ 
      username: { $in: testUsers.map(u => u.username) } 
    });
    
    if (existingUsers.length > 0) {
      console.log('⚠️  发现已存在的测试用户，将删除后重新创建');
      await User.deleteMany({ 
        username: { $in: testUsers.map(u => u.username) } 
      });
    }

    // 创建测试用户
    for (const userData of testUsers) {
      try {
        // 直接使用原始密码，让pre-save中间件自动加密
        const user = new User({
          username: userData.username,
          password: userData.password,
          nickname: userData.nickname,
          avatar: ''
        });

        await user.save();
        console.log(`✅ 创建用户: ${userData.username} (${userData.nickname})`);
      } catch (error) {
        console.error(`❌ 创建用户 ${userData.username} 失败:`, error.message);
      }
    }

    // 列出所有用户
    const allUsers = await User.find({}, 'username nickname createdAt');
    console.log('\n📋 当前所有用户:');
    allUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.nickname}) - ${user.createdAt}`);
    });

    console.log('\n✅ 测试用户创建完成');
    console.log('\n📝 测试账户信息:');
    testUsers.forEach(user => {
      console.log(`  用户名: ${user.username}, 密码: ${user.password}, 昵称: ${user.nickname}`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB 连接已关闭');
  }
}

// 运行脚本
createTestUsers();