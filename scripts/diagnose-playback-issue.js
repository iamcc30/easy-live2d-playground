// 语音播放问题诊断脚本
// 在浏览器控制台执行以诊断播放问题

console.clear()
console.log('🔍 语音播放问题诊断脚本')
console.log('='.repeat(60))
console.log('')

// 诊断结果收集
const diagnostics = {
  audioContext: null,
  websocket: null,
  audioReceived: false,
  decodeAttempted: false,
  decodeSucceeded: false,
  playbackAttempted: false,
  playbackSucceeded: false,
  errors: []
}

// ============================================
// 阶段 1: 检查 AudioContext 状态
// ============================================
console.log('📋 阶段 1/6: 检查 AudioContext 状态')
console.log('-'.repeat(60))

try {
  // 检查服务是否初始化
  if (!audioPlaybackService) {
    diagnostics.errors.push('audioPlaybackService 未定义')
    console.error('❌ audioPlaybackService 未定义')
    console.log('💡 请先运行: await audioPlaybackService.initialize()')
  } else {
    const contextState = audioPlaybackService.getAudioContextState()
    diagnostics.audioContext = contextState

    console.log('AudioContext 状态:', contextState)

    if (contextState === 'suspended') {
      diagnostics.errors.push('AudioContext 处于 suspended 状态')
      console.warn('⚠️  AudioContext 处于 suspended 状态')
      console.log('💡 解决方法: 需要用户交互后恢复')
      console.log('   执行: document.addEventListener("click", async () => {')
      console.log('           await audioPlaybackService.audioContext?.resume()')
      console.log('         }, { once: true })')
    } else if (contextState === 'running') {
      console.log('✅ AudioContext 状态正常 (running)')
    } else if (contextState === null) {
      diagnostics.errors.push('AudioContext 未初始化')
      console.error('❌ AudioContext 未初始化')
      console.log('💡 解决方法: await audioPlaybackService.initialize()')
    } else {
      diagnostics.errors.push(`AudioContext 状态异常: ${contextState}`)
      console.error('❌ AudioContext 状态异常:', contextState)
    }
  }
} catch (error) {
  diagnostics.errors.push(`AudioContext 检查失败: ${error.message}`)
  console.error('❌ AudioContext 检查失败:', error)
}

console.log('')

// ============================================
// 阶段 2: 检查 WebSocket 连接状态
// ============================================
console.log('📋 阶段 2/6: 检查 WebSocket 连接状态')
console.log('-'.repeat(60))

try {
  if (!websocketService) {
    diagnostics.errors.push('websocketService 未定义')
    console.error('❌ websocketService 未定义')
  } else {
    const connectionState = websocketService.getConnectionState()
    const isConnected = websocketService.isConnected()
    diagnostics.websocket = { state: connectionState, connected: isConnected }

    console.log('WebSocket 状态:', connectionState)
    console.log('是否连接:', isConnected)

    if (!isConnected) {
      diagnostics.errors.push('WebSocket 未连接')
      console.error('❌ WebSocket 未连接')
      console.log('💡 解决方法: await websocketService.connect()')
    } else {
      console.log('✅ WebSocket 连接正常')

      // 检查 session 信息
      const session = websocketService.getSessionInfo()
      console.log('Session ID:', session.sessionId)
      console.log('接收到的音频字节:', session.audioBytesReceived)

      if (session.audioBytesReceived === 0) {
        diagnostics.errors.push('未接收到任何音频数据')
        console.warn('⚠️  未接收到任何音频数据')
        console.log('💡 可能原因: 服务器未发送 TTS 音频')
      } else {
        diagnostics.audioReceived = true
        console.log('✅ 已接收音频数据:', session.audioBytesReceived, 'bytes')
      }
    }
  }
} catch (error) {
  diagnostics.errors.push(`WebSocket 检查失败: ${error.message}`)
  console.error('❌ WebSocket 检查失败:', error)
}

console.log('')

// ============================================
// 阶段 3: 检查播放统计
// ============================================
console.log('📋 阶段 3/6: 检查播放统计')
console.log('-'.repeat(60))

try {
  const stats = audioPlaybackService.getPlaybackStats()

  console.log('播放统计:')
  console.log('  总块数:', stats.totalChunks)
  console.log('  成功解码:', stats.successfulChunks)
  console.log('  失败块数:', stats.failedChunks)
  console.log('  成功率:', stats.successRate)
  console.log('  队列长度:', stats.queueLength)
  console.log('  是否播放中:', stats.isPlaying)
  console.log('  总时长:', stats.totalDuration.toFixed(2) + 's')

  // 分析统计数据
  if (stats.totalChunks === 0) {
    diagnostics.errors.push('未尝试解码任何音频块')
    console.warn('⚠️  未尝试解码任何音频块')
    console.log('💡 可能原因: 未调用 addAudioData() 或 WebSocket 未接收数据')
  } else {
    diagnostics.decodeAttempted = true
    console.log('✅ 已尝试解码', stats.totalChunks, '个音频块')

    if (stats.successfulChunks === 0) {
      diagnostics.errors.push('所有音频块解码失败')
      console.error('❌ 所有音频块解码失败 (0/' + stats.totalChunks + ')')
      console.log('💡 可能原因:')
      console.log('   1. 音频格式不正确 (不是 OGG/Opus)')
      console.log('   2. 音频数据损坏')
      console.log('   3. 浏览器不支持该格式')
    } else {
      diagnostics.decodeSucceeded = true
      const successRate = stats.successfulChunks / stats.totalChunks

      if (successRate < 0.5) {
        diagnostics.errors.push(`解码成功率过低: ${stats.successRate}`)
        console.error('❌ 解码成功率过低:', stats.successRate)
      } else if (successRate < 0.8) {
        diagnostics.errors.push(`解码成功率偏低: ${stats.successRate}`)
        console.warn('⚠️  解码成功率偏低:', stats.successRate)
      } else {
        console.log('✅ 解码成功率正常:', stats.successRate)
      }
    }

    if (stats.isPlaying) {
      diagnostics.playbackAttempted = true
      diagnostics.playbackSucceeded = true
      console.log('✅ 当前正在播放')
    } else if (stats.successfulChunks > 0) {
      diagnostics.playbackAttempted = true
      console.warn('⚠️  已解码但未播放')
      console.log('💡 可能原因:')
      console.log('   1. AudioContext suspended (需要用户交互)')
      console.log('   2. 音频播放完成')
      console.log('   3. 播放出错')
    }
  }
} catch (error) {
  diagnostics.errors.push(`播放统计检查失败: ${error.message}`)
  console.error('❌播放统计检查失败:', error)
}

console.log('')

// ============================================
// 阶段 4: 测试音频格式检测
// ============================================
console.log('📋 阶段 4/6: 测试音频格式支持')
console.log('-'.repeat(60))

try {
  // 测试浏览器是否支持 OGG/Opus
  const testFormats = async () => {
    const audioContext = new AudioContext()

    // 测试 1: 空 ArrayBuffer (预期失败,但不应该崩溃)
    try {
      await audioContext.decodeAudioData(new ArrayBuffer(0))
      console.log('⚠️  空 ArrayBuffer 被接受 (异常)')
    } catch (error) {
      console.log('✅ 空 ArrayBuffer 正确拒绝')
    }

    // 测试 2: 创建最小的 OGG 头部测试
    const minOggHeader = new Uint8Array([
      0x4f, 0x67, 0x67, 0x53,  // "OggS"
      0x00, 0x02, 0x00, 0x00
    ])

    try {
      await audioContext.decodeAudioData(minOggHeader.buffer)
      console.log('✅ 浏览器接受 OGG 格式 (但数据不完整会失败)')
    } catch (error) {
      // 预期会失败 (数据不完整),但至少识别了格式
      if (error.message.includes('decode')) {
        console.log('✅ 浏览器支持 OGG 格式解码')
      } else {
        console.warn('⚠️  OGG 格式测试失败:', error.message)
      }
    }

    await audioContext.close()
  }

  await testFormats()
} catch (error) {
  diagnostics.errors.push(`格式支持测试失败: ${error.message}`)
  console.error('❌ 格式支持测试失败:', error)
}

console.log('')

// ============================================
// 阶段 5: 设置实时监控
// ============================================
console.log('📋 阶段 5/6: 设置实时监控')
console.log('-'.repeat(60))

try {
  // 监听 WebSocket 音频数据
  let audioDataCount = 0
  websocketService.connect({
    onAudioData: (audioData) => {
      audioDataCount++

      console.log(`\n🎵 [实时] 收到音频数据 #${audioDataCount}:`)
      console.log('   大小:', audioData.byteLength, 'bytes')

      // 检查格式
      const view = new Uint8Array(audioData)
      const header = Array.from(view.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ')
      console.log('   头部:', header)

      if (header === '4f 67 67 53') {
        console.log('   ✅ 格式: OGG/Opus')
      } else if (header.startsWith('1a 45 df')) {
        console.log('   ✅ 格式: WebM')
      } else {
        console.log('   ⚠️  格式: 未知 -', header)
      }

      // 添加到播放队列
      audioPlaybackService.addAudioData(audioData)
        .then(() => {
          console.log('   ✅ 已加入播放队列')
        })
        .catch(error => {
          console.error('   ❌ 加入队列失败:', error)
        })
    },

    onTTS: (message) => {
      console.log(`\n🔊 [实时] TTS 消息:`)
      console.log('   状态:', message.state)
      console.log('   文本:', message.text || '(无)')
    }
  })

  console.log('✅ 实时监控已启用')
  console.log('💡 发送语音输入以触发 TTS 响应,观察上方日志')
} catch (error) {
  diagnostics.errors.push(`监控设置失败: ${error.message}`)
  console.error('❌ 监控设置失败:', error)
}

console.log('')

// ============================================
// 阶段 6: 生成诊断报告
// ============================================
console.log('📋 阶段 6/6: 诊断报告')
console.log('='.repeat(60))

// 分析问题
const analyzeIssue = () => {
  console.log('\n🔍 问题分析:\n')

  if (diagnostics.errors.length === 0) {
    console.log('✅ 未发现明显问题,系统可能正常')
    console.log('💡 如果仍无法播放,请检查:')
    console.log('   1. 是否发送了语音输入触发 TTS')
    console.log('   2. 服务器是否正常返回音频')
    console.log('   3. 浏览器音量是否静音')
    return
  }

  console.log('❌ 发现以下问题:\n')
  diagnostics.errors.forEach((error, index) => {
    console.log(`   ${index + 1}. ${error}`)
  })

  console.log('\n🎯 诊断结论:\n')

  // 问题分类
  if (diagnostics.audioContext === 'suspended') {
    console.log('⚠️  **主要问题: AudioContext 被浏览器暂停**')
    console.log('')
    console.log('   原因: 浏览器的自动播放策略要求用户交互')
    console.log('   解决方法:')
    console.log('')
    console.log('   // 方法 1: 点击页面后恢复')
    console.log('   document.addEventListener("click", async () => {')
    console.log('     const ctx = audioPlaybackService.audioContext')
    console.log('     if (ctx && ctx.state === "suspended") {')
    console.log('       await ctx.resume()')
    console.log('       console.log("✅ AudioContext 已恢复")')
    console.log('     }')
    console.log('   }, { once: true })')
    console.log('')
    console.log('   // 方法 2: 在按钮点击事件中初始化')
    console.log('   button.addEventListener("click", async () => {')
    console.log('     await audioPlaybackService.initialize()')
    console.log('     // ... 其他操作')
    console.log('   })')
    console.log('')
  } else if (!diagnostics.audioReceived) {
    console.log('⚠️  **主要问题: 未接收到音频数据**')
    console.log('')
    console.log('   可能原因:')
    console.log('   1. WebSocket 未连接或连接断开')
    console.log('   2. 服务器未发送 TTS 音频')
    console.log('   3. 未发送语音输入触发 TTS')
    console.log('')
    console.log('   解决方法:')
    console.log('   1. 检查 WebSocket 连接: websocketService.isConnected()')
    console.log('   2. 查看服务器日志确认是否生成 TTS')
    console.log('   3. 发送测试语音输入')
    console.log('')
  } else if (!diagnostics.decodeAttempted) {
    console.log('⚠️  **主要问题: 音频数据未被处理**')
    console.log('')
    console.log('   可能原因:')
    console.log('   1. 未调用 audioPlaybackService.addAudioData()')
    console.log('   2. WebSocket 事件处理器未正确设置')
    console.log('')
    console.log('   解决方法: 检查 onAudioData 事件处理器')
    console.log('')
  } else if (!diagnostics.decodeSucceeded) {
    console.log('❌ **主要问题: 音频解码失败**')
    console.log('')
    console.log('   可能原因:')
    console.log('   1. 音频格式不正确 (不是 OGG/Opus 或 WebM/Opus)')
    console.log('   2. 音频数据损坏')
    console.log('   3. 浏览器不支持该音频格式')
    console.log('')
    console.log('   解决方法:')
    console.log('   1. 检查实时监控日志中的音频头部')
    console.log('   2. 验证服务器发送的音频格式')
    console.log('   3. 查看浏览器控制台的解码错误详情')
    console.log('')
    console.log('   💡 这种情况下可能需要 opus-decoder 库')
    console.log('')
  } else if (!diagnostics.playbackSucceeded) {
    console.log('⚠️  **主要问题: 解码成功但未播放**')
    console.log('')
    console.log('   可能原因:')
    console.log('   1. AudioContext suspended (最常见)')
    console.log('   2. 音频播放器配置问题')
    console.log('   3. 音频缓冲区问题')
    console.log('')
    console.log('   解决方法: 参考上方 AudioContext 恢复方法')
    console.log('')
  } else {
    console.log('✅ 系统工作正常')
    console.log('')
    console.log('   如果仍然听不到声音,检查:')
    console.log('   1. 系统音量/浏览器音量')
    console.log('   2. 耳机/扬声器连接')
    console.log('   3. 音频输出设备设置')
    console.log('')
  }
}

analyzeIssue()

console.log('='.repeat(60))
console.log('✅ 诊断完成')
console.log('='.repeat(60))
console.log('')
console.log('💡 后续步骤:')
console.log('   1. 根据上方诊断结论修复问题')
console.log('   2. 发送语音输入触发 TTS (如果未发送)')
console.log('   3. 观察实时监控日志')
console.log('   4. 如需重新诊断,刷新页面并重新运行脚本')
console.log('')
