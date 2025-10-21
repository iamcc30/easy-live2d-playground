# 音频卡顿终极诊断工具

## 🔍 问题分析

经过三轮优化仍然卡顿,说明问题可能不在我们优化的地方。让我们从零开始诊断。

## 可能的根本原因

1. **服务器端问题**: 音频数据发送不连续
2. **网络问题**: 数据包到达不稳定
3. **解码性能**: WebCodecs 解码太慢
4. **浏览器问题**: AudioContext 的实现问题
5. **数据格式问题**: OPUS 数据本身有问题

## 📊 完整诊断脚本

在浏览器控制台运行以下脚本进行完整诊断:

```javascript
// =============================================================================
// 音频播放卡顿完整诊断工具
// =============================================================================

console.clear()
console.log('🔍 开始音频播放诊断...\n')

// 1. 检查 AudioContext 状态
console.log('📱 === AudioContext 状态 ===')
const ctx = audioPlaybackService.audioContext
if (ctx) {
  console.table({
    '采样率': ctx.sampleRate + ' Hz',
    '状态': ctx.state,
    '当前时间': ctx.currentTime.toFixed(3) + 's',
    '基准延迟': ctx.baseLatency ? (ctx.baseLatency * 1000).toFixed(2) + 'ms' : 'N/A',
    '输出延迟': ctx.outputLatency ? (ctx.outputLatency * 1000).toFixed(2) + 'ms' : 'N/A'
  })
} else {
  console.error('❌ AudioContext 未初始化!')
}

// 2. 检查播放统计
console.log('\n📊 === 播放统计 ===')
const stats = audioPlaybackService.getPlaybackStats()
console.table({
  '播放状态': stats.isPlaying ? '✅ 播放中' : '⏸️ 暂停',
  '解码状态': stats.isDecoding ? '🔄 解码中' : '⏹️ 停止',
  '缓冲状态': stats.isBuffering ? '⏳ 缓冲中' : '✅ 正常',
  '编码队列': `${stats.encodedQueueLength} / ${stats.bufferConfig.encodedMaxChunks}`,
  '解码队列': `${stats.decodedQueueLength} / ${stats.bufferConfig.decodedMaxChunks}`,
  '解码成功率': stats.decodeSuccessRate,
  '总字节数': (stats.totalBytes / 1024).toFixed(2) + ' KB',
  '总时长': stats.totalDuration.toFixed(2) + 's',
  '卡顿次数': stats.stutterCount,
  '卡顿率': stats.stutterRate,
  '平均连接数': stats.avgConcatCount
})

// 3. 检查缓冲区配置
console.log('\n⚙️ === 缓冲区配置 ===')
console.table(stats.bufferConfig)

// 4. 性能测试 - 解码速度
console.log('\n⏱️ === 解码性能测试 ===')
console.log('提示: 观察解码日志中的时间间隔')
console.log('正常: 每个解码应该 < 50ms')
console.log('问题: 如果解码 > 100ms, 说明解码是瓶颈\n')

// 5. 数据接收测试
console.log('📡 === 数据接收监控 ===')
let lastDataTime = Date.now()
let dataGaps = []

// 监听 WebSocket 数据接收
const originalHandleAudioData = websocketService.handleAudioData
if (originalHandleAudioData) {
  console.log('⚠️ 无法直接监听 WebSocket, 请观察控制台的 "📥 Encoded chunk queued" 日志')
  console.log('正常: 数据应该连续到达, 间隔 < 100ms')
  console.log('问题: 如果间隔 > 500ms, 说明服务器或网络是瓶颈\n')
}

// 6. 播放时序检查
console.log('🎵 === 播放时序检查 ===')
console.log('观察以下日志:')
console.log('- "⏭️ Pre-scheduling next audio chunk" 应该频繁出现')
console.log('- "🚨 STUTTER #X detected" 不应该频繁出现')
console.log('- "🔊 Playing audio buffer" 应该连续出现\n')

// 7. 实时监控
console.log('📈 === 启动实时监控 (每2秒刷新) ===')
console.log('运行以下命令停止监控: clearInterval(window.audioMonitor)\n')

window.audioMonitor = setInterval(() => {
  const s = audioPlaybackService.getPlaybackStats()
  const timestamp = new Date().toLocaleTimeString()

  console.log(`[${timestamp}] 编码:${s.encodedQueueLength} | 解码:${s.decodedQueueLength} | 播放:${s.isPlaying?'▶️':'⏸️'} | 缓冲:${s.isBuffering?'⏳':'✅'} | 卡顿:${s.stutterCount}`)

  // 检测异常情况
  if (s.isPlaying && s.decodedQueueLength < 3) {
    console.warn(`⚠️ 警告: 解码队列过低 (${s.decodedQueueLength}), 即将卡顿!`)
  }
  if (s.encodedQueueLength === 0 && s.isDecoding) {
    console.warn(`⚠️ 警告: 编码队列为空, 网络可能有问题!`)
  }
  if (s.decodedQueueLength > 50) {
    console.warn(`⚠️ 注意: 解码队列过高 (${s.decodedQueueLength}), 可能有延迟`)
  }
}, 2000)

console.log('\n✅ 诊断工具启动完成!')
console.log('💡 提示: 播放音频并观察上面的日志和实时监控\n')
```

## 🔧 根据诊断结果的解决方案

### 场景 1: 编码队列经常为空
**症状**: `encodedQueueLength` 经常 = 0
**原因**: 服务器发送慢或网络差
**解决方案**:
```javascript
// 增加初始缓冲时间
audioPlaybackService.setBufferConfig({
  decodedMinChunks: 25,  // 等待更多缓冲
  timeoutMs: 5000        // 更长的等待时间
})
```

### 场景 2: 解码队列上不去
**症状**: `decodedQueueLength` 总是 < 5
**原因**: 解码太慢
**解决方案**:
```javascript
// 降低质量要求,减少连接数
audioPlaybackService.setBufferConfig({
  maxConcatBuffers: 3,   // 更小的块
  minConcatBuffers: 1
})
```

### 场景 3: 控制台日志显示解码间隔 > 100ms
**症状**: 每次解码耗时很长
**原因**: WebCodecs 性能问题或数据格式问题
**解决方案**: 检查 OPUS 数据是否正确编码

### 场景 4: "📥 Encoded chunk queued" 日志间隔 > 500ms
**症状**: 数据到达不连续
**原因**: 服务器端或网络问题
**解决方案**: 优化服务器发送策略或检查网络

### 场景 5: AudioContext.baseLatency 很高 (> 50ms)
**症状**: 基准延迟过高
**原因**: 浏览器或系统音频配置问题
**解决方案**:
```javascript
// 无法通过代码解决,建议:
// 1. 更新浏览器
// 2. 检查系统音频设置
// 3. 使用 Chrome/Edge (WebCodecs 支持更好)
```

## 🎯 快速测试不同配置

```javascript
// 配置 A: 极端保守 (牺牲启动速度,换取流畅)
audioPlaybackService.setBufferConfig({
  decodedMinChunks: 30,
  rebufferThreshold: 15,
  maxConcatBuffers: 20,
  minConcatBuffers: 10,
  timeoutMs: 6000
})
audioPlaybackService.resetStats()
console.log('✅ 已切换到极端保守配置')

// 配置 B: 极端激进 (启动快,但可能更卡)
audioPlaybackService.setBufferConfig({
  decodedMinChunks: 5,
  rebufferThreshold: 2,
  maxConcatBuffers: 3,
  minConcatBuffers: 1,
  timeoutMs: 1000
})
audioPlaybackService.resetStats()
console.log('✅ 已切换到极端激进配置')

// 配置 C: 单块播放模式 (测试是否是连接问题)
audioPlaybackService.setBufferConfig({
  decodedMinChunks: 10,
  rebufferThreshold: 3,
  maxConcatBuffers: 1,   // 每次只播放1个块
  minConcatBuffers: 1,
  timeoutMs: 3000
})
audioPlaybackService.resetStats()
console.log('✅ 已切换到单块播放模式')

// 配置 D: 恢复默认优化配置
audioPlaybackService.setBufferConfig({
  decodedMinChunks: 15,
  rebufferThreshold: 5,
  maxConcatBuffers: 10,
  minConcatBuffers: 5,
  timeoutMs: 3000
})
audioPlaybackService.resetStats()
console.log('✅ 已恢复默认优化配置')
```

## 🔬 深度诊断 - 解码时间测量

如果怀疑是解码问题,运行这个:

```javascript
// 测量解码时间
let decodeStartTime = 0
let decodeTimes = []

console.log('🔬 开始测量解码性能...')

// 重写解码方法来测量时间
const originalDecode = audioPlaybackService.webCodecsDecoder?.decode
if (originalDecode) {
  console.log('⚠️ 无法直接测量,请观察控制台 "🔄 Decoding chunk" 到 "✅ WebCodecs decode successful" 的时间间隔')
}

console.log('\n观察控制台日志:')
console.log('如果解码时间 < 50ms: 解码正常 ✅')
console.log('如果解码时间 50-100ms: 解码偏慢 ⚠️')
console.log('如果解码时间 > 100ms: 解码是瓶颈 ❌')
```

## 📝 诊断检查清单

运行完整诊断后,回答以下问题:

- [ ] AudioContext 状态是 "running" 吗?
- [ ] 解码成功率 > 95% 吗?
- [ ] 卡顿率 < 10% 吗?
- [ ] 编码队列通常 > 5 吗?
- [ ] 解码队列通常 > 5 吗?
- [ ] 实时监控中看到连续的播放吗?
- [ ] "Pre-scheduling" 日志频繁出现吗?
- [ ] 数据接收间隔 < 200ms 吗?

## 🆘 如果所有优化都无效

可能需要考虑完全不同的方案:

### 方案 1: 降级到 Audio Element
```javascript
// 使用 <audio> 标签 + Blob URL
// 优点: 浏览器原生优化
// 缺点: 需要完整的音频文件
```

### 方案 2: 使用 AudioWorklet
```javascript
// 在独立线程中处理音频
// 优点: 不阻塞主线程
// 缺点: 实现复杂
```

### 方案 3: 服务器端优化
```javascript
// 让服务器发送更大的音频块
// 或者改用流式 MP3 而不是 OPUS
```

## 📞 需要提供的信息

如果诊断后还是卡顿,请提供:

1. 完整的诊断输出
2. AudioContext 的 `baseLatency` 和 `outputLatency`
3. 实时监控中的典型输出 (3-5行)
4. 浏览器版本和操作系统
5. 网络环境 (WiFi/4G/5G/有线)
6. 服务器发送的音频块大小和频率

---

**使用方法**:
1. 复制上面的"完整诊断脚本"到浏览器控制台
2. 开始播放音频
3. 观察输出
4. 根据"根据诊断结果的解决方案"调整配置
5. 测试不同配置看哪个效果最好
