const mongoose = require('./server/node_modules/mongoose');
const dotenv = require('./server/node_modules/dotenv');

dotenv.config({ path: './server/.env' });

// 连接到MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjgame')
  .then(() => {
    console.log('✅ MongoDB 连接成功');
    cleanRoomData();
  })
  .catch(err => {
    console.error('❌ MongoDB 连接失败:', err);
    process.exit(1);
  });

async function cleanRoomData() {
  try {
    const db = mongoose.connection;
    const collections = await db.db.listCollections().toArray();
    
    // 需要清理的房间相关集合
    const roomCollections = [
      'rooms',
      'roomplayers', 
      'gamerounds',
      'playercards',
      'playrecords',
      'roundscores'
    ];
    
    console.log('🧹 开始清理房间数据...');
    
    for (const collectionName of roomCollections) {
      // 检查集合是否存在
      const collectionExists = collections.some(col => col.name === collectionName);
      
      if (collectionExists) {
        const collection = db.db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count > 0) {
          const result = await collection.deleteMany({});
          console.log(`🗑️  清理 ${collectionName}: 删除 ${result.deletedCount} 条记录`);
        } else {
          console.log(`📝 ${collectionName}: 无数据需要清理`);
        }
      } else {
        console.log(`⚠️  集合 ${collectionName} 不存在，跳过`);
      }
    }
    
    console.log('✅ 房间数据清理完成！');
    
    // 验证清理结果
    console.log('\n📊 清理结果验证:');
    for (const collectionName of roomCollections) {
      try {
        const collection = db.db.collection(collectionName);
        const remainingCount = await collection.countDocuments();
        console.log(`${collectionName}: 剩余 ${remainingCount} 条记录`);
      } catch (error) {
        console.log(`${collectionName}: 集合不存在或无法访问`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error);
    process.exit(1);
  }
}