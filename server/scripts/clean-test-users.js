/**
 * 清理测试用户脚本
 * 运行: node scripts/clean-test-users.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 连接数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjgame';

// 要删除的测试用户名
const testUsernames = ['test1', 'test2', 'test3', 'test4', 'admin'];

async function cleanTestUsers() {
  try {
    // 连接数据库
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 连接成功');

    // 获取User模型
    const User = require('../src/models/User');

    // 查找现有测试用户
    const existingUsers = await User.find({ 
      username: { $in: testUsernames } 
    });
    
    if (existingUsers.length === 0) {
      console.log('ℹ️  没有找到测试用户，无需清理');
      return;
    }

    console.log(`找到 ${existingUsers.length} 个测试用户，准备删除...`);
    
    // 删除测试用户
    const result = await User.deleteMany({ 
      username: { $in: testUsernames } 
    });
    
    console.log(`✅ 已删除 ${result.deletedCount} 个测试用户`);

    // 验证删除结果
    const remainingUsers = await User.find({ 
      username: { $in: testUsernames } 
    });
    
    if (remainingUsers.length === 0) {
      console.log('✅ 所有测试用户已成功删除');
    } else {
      console.log(`⚠️  仍有 ${remainingUsers.length} 个用户未删除`);
      remainingUsers.forEach(user => {
        console.log(`  - ${user.username}`);
      });
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB 连接已关闭');
  }
}

// 运行脚本
cleanTestUsers();