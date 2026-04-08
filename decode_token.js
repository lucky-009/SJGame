// 手动解析JWT token（不使用jsonwebtoken库）
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWMzOTcyYzg2Yjc2N2NlNWJkYmNjNjEiLCJ1c2VybmFtZSI6InBsYXllcjEiLCJpYXQiOjE3NzQ5NDk5NjcsImV4cCI6MTc3NTU1NDc2N30.3b82GymHcMnNxYnlA5SILYhaz770p4FuRot4omLT1No';

// JWT由三部分组成，用点号分隔
const parts = token.split('.');
console.log('JWT Token 分析:');
console.log('总长度:', token.length);

// 解析Header（第一部分）
const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
console.log('\nHeader:', header);

// 解析Payload（第二部分）
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
console.log('\nPayload:', payload);

// 验证用户信息
console.log('\n用户信息:');
console.log('- userId:', payload.userId);
console.log('- username:', payload.username);

// 验证时间
const currentTime = Math.floor(Date.now() / 1000);
console.log('\n时间验证:');
console.log('- 当前时间戳:', currentTime);
console.log('- 签发时间 (iat):', payload.iat);
console.log('- 过期时间 (exp):', payload.exp);
console.log('- Token 是否过期:', payload.exp < currentTime);

// 签名（第三部分）
console.log('\n签名:', parts[2]);