// Session ID 诊断脚本
// 在浏览器控制台运行此脚本来诊断 session_id 问题

console.log('🔍 === Session ID 诊断开始 ===\n')

// 1. 检查 WebSocket 服务状态
console.log('1️⃣ WebSocket 服务状态:')
console.log('   连接状态:', websocketService.getConnectionState())
console.log('   是否连接:', websocketService.isConnected())
console.log('')

// 2. 检查 Session Info
console.log('2️⃣ Session 信息:')
const sessionInfo = websocketService.getSessionInfo()
console.log('   完整信息:', JSON.stringify(sessionInfo, null, 2))
console.log('   sessionId:', sessionInfo.sessionId)
console.log('   sessionId 是否为空:', sessionInfo.sessionId === '')
console.log('   sessionId 长度:', sessionInfo.sessionId.length)
console.log('')

// 3. 检查 Chat Store
console.log('3️⃣ Chat Store 状态:')
console.log('   isConnected:', chatStore.isConnected)
console.log('   connectionState:', chatStore.connectionState)
console.log('')

// 4. 提供测试步骤
console.log('4️⃣ 测试步骤:')
console.log('   a) 如果未连接，请点击右上角的"连接"按钮')
console.log('   b) 观察控制台输出，查找以下日志:')
console.log('      - 📨 Received JSON message: ...')
console.log('      - 👋 Server hello response: ...')
console.log('      - 📝 Session ID assigned: ...')
console.log('   c) 如果看到以上日志，session_id 应该被正确设置')
console.log('   d) 如果没有看到，说明服务器可能:')
console.log('      - 未返回 hello 响应')
console.log('      - 返回的消息类型不是 "hello"')
console.log('      - 返回的 hello 消息中没有 session_id 字段')
console.log('')

// 5. 模拟 startListen 调用
console.log('5️⃣ 模拟 startListen 调用:')
console.log('   运行以下命令来查看会发送什么:')
console.log('   websocketService.startListen("auto")')
console.log('   (注意: 这会实际发送消息到服务器!)')
console.log('')

console.log('🔍 === 诊断完成 ===')
console.log('如果 sessionId 为空，请:')
console.log('1. 检查上面的输出')
console.log('2. 点击"连接"按钮')
console.log('3. 查看新的日志输出')
console.log('4. 特别注意是否出现 "📨 Received JSON message" 和 "👋 Server hello response"')
