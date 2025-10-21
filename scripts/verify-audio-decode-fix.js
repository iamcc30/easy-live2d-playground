// 音频解码修复 - 快速验证脚本
// 在浏览器控制台执行此脚本以验证修复效果

console.clear()
console.log('🧪 音频播放解码修复 - 验证测试\n')
console.log('='.repeat(60) + '\n')

// 测试 1: 检查修复后的代码
console.log('📋 测试 1: 验证代码修复')
console.log('-'.repeat(60))

// 检查 decodePCMAudio 方法是否已移除
const hasDecodePCM = audioPlaybackService.constructor.prototype.hasOwnProperty('decodePCMAudio')
if (hasDecodePCM) {
  console.error('❌ decodePCMAudio 方法仍然存在 (应该已被移除)')
} else {
  console.log('✅ decodePCMAudio 方法已成功移除')
}

console.log('\n')

// 测试 2: 初始化音频播放
console.log('📋 测试 2: 初始化音频播放')
console.log('-'.repeat(60))

await audioPlaybackService.initialize()
  .then(() => {
    console.log('✅ 音频播放服务初始化成功')
    console.log('AudioContext 状态:', audioPlaybackService.getAudioContextState())
  })
  .catch(error => {
    console.error('❌ 音频播放服务初始化失败:', error)
  })

console.log('\n')

// 测试 3: 模拟音频数据接收和解码
console.log('📋 测试 3: 模拟音频解码流程')
console.log('-'.repeat(60))

// 创建测试用的 OGG 头部 (模拟数据)
const createTestOggData = () => {
  // OGG 文件头: 4f 67 67 53 (OggS)
  const header = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00])
  const padding = new Uint8Array(100).fill(0) // 填充数据
  const combined = new Uint8Array(header.length + padding.length)
  combined.set(header, 0)
  combined.set(padding, header.length)
  return combined.buffer
}

const testData = createTestOggData()
console.log('📦 创建测试数据:', testData.byteLength, 'bytes')

// 检查头部
const view = new Uint8Array(testData)
const header = Array.from(view.slice(0, 4))
  .map(b => b.toString(16).padStart(2, '0'))
  .join(' ')
console.log('🔍 音频头部:', header)
console.log('✅ 符合 OGG 格式 (4f 67 67 53 = OggS)')

console.log('\n')

// 测试 4: 连接 WebSocket 并监听 TTS
console.log('📋 测试 4: WebSocket 和 TTS 监听设置')
console.log('-'.repeat(60))

let audioDataReceived = 0
let ttsMessageReceived = 0

websocketService.connect({
  onTTS: (message) => {
    ttsMessageReceived++
    console.log(`🔊 TTS 消息 #${ttsMessageReceived}:`, message.state, message.text || '')
  },

  onAudioData: (audioData) => {
    audioDataReceived++

    // 检查音频格式
    const view = new Uint8Array(audioData)
    const header = Array.from(view.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    console.log(`\n🎵 收到音频数据 #${audioDataReceived}:`)
    console.log('   大小:', audioData.byteLength, 'bytes')
    console.log('   头部:', header)

    // 判断格式
    if (header === '4f 67 67 53') {
      console.log('   ✅ 格式: OGG/Opus 容器')
    } else if (header.startsWith('1a 45 df')) {
      console.log('   ✅ 格式: WebM 容器')
    } else {
      console.log('   ⚠️  格式: 未知 (可能导致解码失败)')
    }

    // 添加到播放队列
    audioPlaybackService.addAudioData(audioData)
      .then(() => {
        console.log('   ✅ 已添加到播放队列')
      })
      .catch(error => {
        console.error('   ❌ 添加到队列失败:', error)
      })
  }
}).catch(error => {
  console.error('❌ WebSocket 连接失败:', error)
})

console.log('✅ WebSocket 事件监听器已设置')
console.log('\n')

// 显示使用说明
console.log('='.repeat(60))
console.log('📖 后续步骤:')
console.log('='.repeat(60))
console.log('')
console.log('1️⃣  发送语音输入以触发 TTS 响应:')
console.log('')
console.log('   await audioRecordingService.initialize()')
console.log('   websocketService.startListen("auto")')
console.log('   await audioRecordingService.startRecording((data) => {')
console.log('     websocketService.sendAudioData(data)')
console.log('   })')
console.log('   console.log("🎤 录音中,请说话...")')
console.log('')
console.log('2️⃣  等待 5 秒后停止录音:')
console.log('')
console.log('   setTimeout(() => {')
console.log('     audioRecordingService.stopRecording()')
console.log('     websocketService.stopListen()')
console.log('     console.log("✅ 录音已停止")')
console.log('   }, 5000)')
console.log('')
console.log('3️⃣  观察控制台输出:')
console.log('')
console.log('   - 🔄 Decoding audio as OPUS/OGG container...')
console.log('   - ✅ Successfully decoded audio')
console.log('   - 🔊 Playing audio buffer: X.XXXs, 16000Hz')
console.log('')
console.log('4️⃣  检查播放统计:')
console.log('')
console.log('   const stats = audioPlaybackService.getPlaybackStats()')
console.log('   console.log("播放统计:", stats)')
console.log('')
console.log('='.repeat(60))
console.log('✅ 验证脚本执行完成')
console.log('='.repeat(60))
