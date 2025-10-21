// 音频播放卡顿诊断脚本
// 用于分析缓冲、解码性能和播放连续性

console.clear()
console.log('🔍 音频播放卡顿诊断工具')
console.log('='.repeat(70))
console.log('')

// 诊断数据收集
const diagnostics = {
  bufferEvents: [],
  decodeTimings: [],
  playbackGaps: [],
  queueStates: [],
  startTime: Date.now()
}

// 保存原始方法
const originalAddAudioData = audioPlaybackService.addAudioData.bind(audioPlaybackService)
const originalGetPlaybackStats = audioPlaybackService.getPlaybackStats.bind(audioPlaybackService)

// 1. 监控缓冲事件
let lastAudioTime = 0
let gapCount = 0

audioPlaybackService.addAudioData = async function(data) {
  const now = Date.now()
  const timeSinceLastChunk = lastAudioTime ? now - lastAudioTime : 0
  lastAudioTime = now

  // 检测数据到达间隔
  if (timeSinceLastChunk > 200) { // 超过200ms视为可能的gap
    gapCount++
    diagnostics.playbackGaps.push({
      time: now - diagnostics.startTime,
      gap: timeSinceLastChunk,
      chunkSize: data.byteLength
    })
    console.warn(`⚠️ 数据到达间隔过大: ${timeSinceLastChunk}ms (块大小: ${data.byteLength} bytes)`)
  }

  // 记录队列状态
  const stats = originalGetPlaybackStats()
  diagnostics.queueStates.push({
    time: now - diagnostics.startTime,
    queueLength: stats.queueLength,
    queueBytes: stats.queueBytes,
    isPlaying: stats.isPlaying,
    isBuffering: stats.isBuffering
  })

  // 调用原始方法
  return originalAddAudioData(data)
}

// 2. 监控解码性能
let decodeCount = 0
const decodeTimings = []

// 拦截 playNext 来测量解码时间
const playNextMethod = Object.getPrototypeOf(audioPlaybackService).playNext
if (playNextMethod) {
  Object.getPrototypeOf(audioPlaybackService).playNext = async function() {
    const decodeStart = performance.now()
    decodeCount++

    try {
      await playNextMethod.call(this)

      const decodeTime = performance.now() - decodeStart
      decodeTimings.push(decodeTime)
      diagnostics.decodeTimings.push({
        time: Date.now() - diagnostics.startTime,
        duration: decodeTime,
        count: decodeCount
      })

      if (decodeTime > 50) {
        console.warn(`⚠️ 解码耗时过长: ${decodeTime.toFixed(2)}ms (#${decodeCount})`)
      } else {
        console.log(`⚡ 解码完成: ${decodeTime.toFixed(2)}ms (#${decodeCount})`)
      }
    } catch (error) {
      console.error('❌ 解码错误:', error)
    }
  }
}

// 3. 实时监控仪表板
let monitorInterval = null

function startRealTimeMonitor() {
  console.log('\n📊 启动实时监控 (每2秒更新)\n')

  monitorInterval = setInterval(() => {
    const stats = audioPlaybackService.getPlaybackStats()
    const bufferConfig = stats.bufferConfig

    // 计算平均解码时间
    const avgDecodeTime = decodeTimings.length > 0
      ? (decodeTimings.reduce((a, b) => a + b, 0) / decodeTimings.length).toFixed(2)
      : 'N/A'

    // 计算最大解码时间
    const maxDecodeTime = decodeTimings.length > 0
      ? Math.max(...decodeTimings).toFixed(2)
      : 'N/A'

    // 队列健康度评估
    const queueHealth = stats.queueLength / bufferConfig.maxChunks
    let healthIcon = '✅'
    let healthStatus = '健康'

    if (stats.isPlaying && stats.queueLength <= bufferConfig.rebufferThreshold) {
      healthIcon = '🔴'
      healthStatus = '危险 - 队列即将耗尽'
    } else if (queueHealth < 0.3) {
      healthIcon = '🟡'
      healthStatus = '警告 - 缓冲偏低'
    }

    console.clear()
    console.log('📊 实时播放监控')
    console.log('='.repeat(70))
    console.log('')

    console.log('🎵 播放状态:')
    console.log(`   状态: ${stats.isPlaying ? '▶️ 播放中' : '⏸️ 已暂停'}`)
    console.log(`   缓冲: ${stats.isBuffering ? '⏳ 缓冲中' : '✅ 就绪'}`)
    console.log(`   AudioContext: ${stats.audioContextState}`)
    console.log('')

    console.log('📦 队列状态:')
    console.log(`   当前: ${stats.queueLength} / ${bufferConfig.maxChunks} 块 (${stats.queueBytes} bytes)`)
    console.log(`   健康度: ${healthIcon} ${healthStatus}`)
    console.log('')

    console.log('⚡ 解码性能:')
    console.log(`   总次数: ${decodeCount}`)
    console.log(`   平均耗时: ${avgDecodeTime} ms`)
    console.log(`   最大耗时: ${maxDecodeTime} ms`)
    console.log(`   成功率: ${stats.successRate}`)
    console.log('')

    console.log('📈 播放统计:')
    console.log(`   总块数: ${stats.totalChunks}`)
    console.log(`   成功: ${stats.successfulChunks}`)
    console.log(`   失败: ${stats.failedChunks}`)
    console.log(`   总时长: ${stats.totalDuration.toFixed(2)}s`)
    console.log('')

    console.log('⚠️ 异常检测:')
    console.log(`   数据间隔过大: ${gapCount} 次`)
    console.log(`   解码超时 (>50ms): ${decodeTimings.filter(t => t > 50).length} 次`)
    console.log('')

    console.log('='.repeat(70))
    console.log('💡 执行 stopRealTimeMonitor() 停止监控')
    console.log('💡 执行 generateDiagnosticReport() 生成完整报告')
  }, 2000)
}

function stopRealTimeMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
    console.log('\n⏹️ 监控已停止\n')
  }
}

// 4. 生成诊断报告
function generateDiagnosticReport() {
  console.clear()
  console.log('📋 音频播放卡顿诊断报告')
  console.log('='.repeat(70))
  console.log('')

  const stats = audioPlaybackService.getPlaybackStats()
  const bufferConfig = stats.bufferConfig

  // 分析解码性能
  const avgDecodeTime = decodeTimings.length > 0
    ? decodeTimings.reduce((a, b) => a + b, 0) / decodeTimings.length
    : 0
  const maxDecodeTime = decodeTimings.length > 0 ? Math.max(...decodeTimings) : 0
  const slowDecodes = decodeTimings.filter(t => t > 50).length

  console.log('## 🎯 问题诊断\n')

  // 诊断 1: 缓冲配置
  console.log('### 1️⃣ 缓冲配置分析\n')
  console.log(`当前配置:`)
  console.log(`  - minChunks: ${bufferConfig.minChunks}`)
  console.log(`  - minBytes: ${bufferConfig.minBytes}`)
  console.log(`  - maxChunks: ${bufferConfig.maxChunks}`)
  console.log(`  - timeoutMs: ${bufferConfig.timeoutMs}`)
  console.log(`  - rebufferThreshold: ${bufferConfig.rebufferThreshold}`)
  console.log('')

  if (bufferConfig.minChunks < 5) {
    console.log('⚠️ **问题**: minChunks 过低 (当前: ' + bufferConfig.minChunks + ')')
    console.log('   原因: WebCodecs 解码需要更多缓冲来保持流畅')
    console.log('   建议: 增加到 5-8 块')
    console.log('')
  }

  if (bufferConfig.timeoutMs < 1000) {
    console.log('⚠️ **问题**: timeoutMs 过短 (当前: ' + bufferConfig.timeoutMs + 'ms)')
    console.log('   原因: 可能在缓冲不足时提前开始播放')
    console.log('   建议: 增加到 1000-1500ms')
    console.log('')
  }

  // 诊断 2: 解码性能
  console.log('### 2️⃣ 解码性能分析\n')
  console.log(`解码统计:`)
  console.log(`  - 平均耗时: ${avgDecodeTime.toFixed(2)} ms`)
  console.log(`  - 最大耗时: ${maxDecodeTime.toFixed(2)} ms`)
  console.log(`  - 慢解码 (>50ms): ${slowDecodes} 次 (${(slowDecodes / decodeTimings.length * 100).toFixed(1)}%)`)
  console.log('')

  if (avgDecodeTime > 20) {
    console.log('⚠️ **问题**: 平均解码时间过长 (' + avgDecodeTime.toFixed(2) + 'ms)')
    console.log('   原因: WebCodecs 解码性能不足或系统负载高')
    console.log('   建议: ')
    console.log('     1. 增加缓冲块数 (minChunks: 8)')
    console.log('     2. 检查浏览器性能 (关闭其他标签页)')
    console.log('     3. 检查音频块大小是否过大')
    console.log('')
  }

  // 诊断 3: 数据到达间隔
  console.log('### 3️⃣ 数据到达分析\n')
  console.log(`间隔过大事件: ${gapCount} 次`)
  console.log('')

  if (gapCount > 3) {
    console.log('⚠️ **问题**: 音频数据到达间隔不稳定')
    console.log('   原因: 网络延迟或服务器 TTS 生成速度慢')
    console.log('   建议: ')
    console.log('     1. 增加缓冲: minChunks: 8, timeoutMs: 1500')
    console.log('     2. 检查网络连接质量')
    console.log('     3. 检查服务器 TTS 性能')
    console.log('')

    // 显示前5个最大间隔
    const topGaps = diagnostics.playbackGaps
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)

    console.log('最大的5次间隔:')
    topGaps.forEach((gap, idx) => {
      console.log(`  ${idx + 1}. ${gap.gap}ms (块大小: ${gap.chunkSize} bytes)`)
    })
    console.log('')
  }

  // 诊断 4: 队列低水位
  const lowWaterMarks = diagnostics.queueStates.filter(
    s => s.isPlaying && s.queueLength <= bufferConfig.rebufferThreshold
  ).length

  console.log('### 4️⃣ 队列健康度\n')
  console.log(`队列低水位事件: ${lowWaterMarks} 次`)
  console.log('')

  if (lowWaterMarks > 5) {
    console.log('🔴 **严重问题**: 频繁出现队列低水位')
    console.log('   原因: 播放速度快于数据到达/解码速度')
    console.log('   这是导致卡顿的主要原因！')
    console.log('   建议: ')
    console.log('     1. 立即增加 minChunks 到 8-10')
    console.log('     2. 增加 timeoutMs 到 1500-2000ms')
    console.log('     3. 考虑降低播放优先级,优先缓冲')
    console.log('')
  }

  // 总结和建议
  console.log('## 💡 推荐配置\n')

  let recommendedConfig = {
    minChunks: bufferConfig.minChunks,
    minBytes: bufferConfig.minBytes,
    maxChunks: bufferConfig.maxChunks,
    timeoutMs: bufferConfig.timeoutMs,
    rebufferThreshold: bufferConfig.rebufferThreshold
  }

  // 根据诊断调整建议
  if (lowWaterMarks > 5 || gapCount > 3 || avgDecodeTime > 20) {
    recommendedConfig = {
      minChunks: 8,
      minBytes: 2048,
      maxChunks: 15,
      timeoutMs: 1500,
      rebufferThreshold: 3
    }
    console.log('📊 推荐使用 **高缓冲配置** (适合当前情况):')
  } else if (avgDecodeTime > 10 || gapCount > 1) {
    recommendedConfig = {
      minChunks: 5,
      minBytes: 2048,
      maxChunks: 12,
      timeoutMs: 1000,
      rebufferThreshold: 2
    }
    console.log('📊 推荐使用 **中等缓冲配置**:')
  } else {
    console.log('📊 当前配置基本合理,建议微调:')
    recommendedConfig.minChunks = Math.max(5, bufferConfig.minChunks)
    recommendedConfig.timeoutMs = Math.max(1000, bufferConfig.timeoutMs)
  }

  console.log('')
  console.log('```javascript')
  console.log('audioPlaybackService.setBufferConfig({')
  console.log(`  minChunks: ${recommendedConfig.minChunks},`)
  console.log(`  minBytes: ${recommendedConfig.minBytes},`)
  console.log(`  maxChunks: ${recommendedConfig.maxChunks},`)
  console.log(`  timeoutMs: ${recommendedConfig.timeoutMs},`)
  console.log(`  rebufferThreshold: ${recommendedConfig.rebufferThreshold}`)
  console.log('})')
  console.log('```')
  console.log('')

  console.log('='.repeat(70))
  console.log('✅ 诊断完成')
  console.log('')
  console.log('💾 诊断数据已保存到: window.audioDiagnostics')
  console.log('')
}

// 导出函数和数据
window.startRealTimeMonitor = startRealTimeMonitor
window.stopRealTimeMonitor = stopRealTimeMonitor
window.generateDiagnosticReport = generateDiagnosticReport
window.audioDiagnostics = diagnostics

console.log('✅ 诊断工具已加载')
console.log('')
console.log('📖 使用说明:')
console.log('='.repeat(70))
console.log('')
console.log('1️⃣ 启动实时监控:')
console.log('   startRealTimeMonitor()')
console.log('')
console.log('2️⃣ 发送语音输入触发 TTS 播放')
console.log('')
console.log('3️⃣ 观察实时监控数据 (自动更新)')
console.log('')
console.log('4️⃣ 停止监控并生成报告:')
console.log('   stopRealTimeMonitor()')
console.log('   generateDiagnosticReport()')
console.log('')
console.log('='.repeat(70))
console.log('')
