// 音频缓冲监控脚本
// 实时监控音频缓冲状态和播放质量

console.clear()
console.log('📊 音频缓冲监控 - 实时状态')
console.log('='.repeat(70))
console.log('')

// 监控配置
const MONITOR_INTERVAL = 1000 // 1秒更新一次
let monitorTimer = null

// 启动监控
function startBufferMonitor() {
  console.log('🚀 启动缓冲监控...\n')

  monitorTimer = setInterval(() => {
    // 清空控制台保持清晰
    console.clear()
    console.log('📊 音频缓冲监控 - 实时状态')
    console.log('='.repeat(70))
    console.log('')

    try {
      // 获取统计数据
      const stats = audioPlaybackService.getPlaybackStats()
      const config = stats.bufferConfig

      // 显示缓冲配置
      console.log('⚙️  缓冲配置:')
      console.log('   最小块数:', config.minChunks, '块')
      console.log('   最小字节:', config.minBytes, 'bytes')
      console.log('   最大块数:', config.maxChunks, '块')
      console.log('   缓冲超时:', config.timeoutMs, 'ms')
      console.log('   重缓冲阈值:', config.rebufferThreshold, '块')
      console.log('')

      // 显示当前状态
      console.log('📈 当前状态:')
      console.log('   播放状态:', stats.isPlaying ? '✅ 播放中' : '⏸️  已暂停')
      console.log('   缓冲状态:', stats.isBuffering ? '⏳ 缓冲中' : '✅ 就绪')
      console.log('   AudioContext:', stats.audioContextState || '未初始化')
      console.log('')

      // 显示队列信息
      const queuePercent = Math.min(100, (stats.queueLength / config.maxChunks * 100)).toFixed(1)
      const queueBar = '█'.repeat(Math.floor(stats.queueLength / config.maxChunks * 20)) +
                       '░'.repeat(20 - Math.floor(stats.queueLength / config.maxChunks * 20))

      console.log('📦 队列状态:')
      console.log('   队列长度:', stats.queueLength, '/', config.maxChunks, '块', `(${queuePercent}%)`)
      console.log('   [' + queueBar + ']')
      console.log('   队列字节:', (stats.queueBytes / 1024).toFixed(2), 'KB')
      console.log('')

      // 显示播放统计
      console.log('🎵 播放统计:')
      console.log('   总块数:', stats.totalChunks)
      console.log('   成功解码:', stats.successfulChunks)
      console.log('   失败块数:', stats.failedChunks)
      console.log('   成功率:', stats.successRate)
      console.log('   总字节:', (stats.totalBytes / 1024).toFixed(2), 'KB')
      console.log('   总时长:', stats.totalDuration.toFixed(2), 's')
      console.log('')

      // 缓冲健康度评估
      const bufferHealth = getBufferHealth(stats, config)
      console.log('💊 缓冲健康度:', bufferHealth.level, bufferHealth.icon)
      console.log('   ', bufferHealth.message)
      console.log('')

      // 性能建议
      const suggestions = getPerformanceSuggestions(stats, config)
      if (suggestions.length > 0) {
        console.log('💡 性能建议:')
        suggestions.forEach(suggestion => {
          console.log('   •', suggestion)
        })
        console.log('')
      }

      console.log('='.repeat(70))
      console.log('💡 提示: 执行 stopBufferMonitor() 停止监控')
      console.log('💡 提示: 执行 adjustBuffer({minChunks: 5}) 调整缓冲参数')

    } catch (error) {
      console.error('❌ 监控失败:', error)
    }
  }, MONITOR_INTERVAL)

  console.log('✅ 监控已启动 (每', MONITOR_INTERVAL / 1000, '秒更新)')
}

// 停止监控
function stopBufferMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
    console.log('⏹️  监控已停止')
  }
}

// 评估缓冲健康度
function getBufferHealth(stats, config) {
  const queueRatio = stats.queueLength / config.maxChunks
  const successRate = parseFloat(stats.successRate)

  if (successRate < 50) {
    return {
      level: '危险',
      icon: '🔴',
      message: '解码成功率过低,检查音频格式'
    }
  }

  if (stats.isPlaying) {
    if (stats.queueLength <= config.rebufferThreshold) {
      return {
        level: '警告',
        icon: '🟡',
        message: '队列即将耗尽,可能出现卡顿'
      }
    }
    if (queueRatio < 0.3) {
      return {
        level: '一般',
        icon: '🟢',
        message: '播放正常,缓冲偏低'
      }
    }
    return {
      level: '优秀',
      icon: '✅',
      message: '播放流畅,缓冲充足'
    }
  } else {
    if (stats.isBuffering) {
      return {
        level: '缓冲中',
        icon: '⏳',
        message: `等待缓冲 (${stats.queueLength}/${config.minChunks} 块)`
      }
    }
    if (stats.queueLength > 0) {
      return {
        level: '待播放',
        icon: '⏸️',
        message: '队列有数据但未播放'
      }
    }
    return {
      level: '空闲',
      icon: '💤',
      message: '等待音频数据'
    }
  }
}

// 获取性能建议
function getPerformanceSuggestions(stats, config) {
  const suggestions = []

  // 成功率建议
  const successRate = parseFloat(stats.successRate)
  if (successRate < 80 && stats.totalChunks > 5) {
    suggestions.push(`解码成功率 ${stats.successRate},考虑检查音频格式`)
  }

  // 缓冲建议
  if (stats.isPlaying && stats.queueLength <= config.rebufferThreshold) {
    suggestions.push('队列过低,建议增加 minChunks 或 minBytes')
  }

  if (stats.queueLength >= config.maxChunks) {
    suggestions.push('队列已满,考虑增加 maxChunks 或加快播放')
  }

  // AudioContext 建议
  if (stats.audioContextState === 'suspended') {
    suggestions.push('AudioContext 暂停,需要用户交互恢复')
  }

  return suggestions
}

// 快速调整缓冲参数
function adjustBuffer(config) {
  try {
    audioPlaybackService.setBufferConfig(config)
    console.log('✅ 缓冲参数已更新:', config)
  } catch (error) {
    console.error('❌ 更新失败:', error)
  }
}

// 预设配置
const BUFFER_PRESETS = {
  // 低延迟 (适合实时对话)
  lowLatency: {
    minChunks: 2,
    minBytes: 512,
    maxChunks: 5,
    timeoutMs: 300,
    rebufferThreshold: 1
  },

  // 平衡 (默认配置)
  balanced: {
    minChunks: 3,
    minBytes: 1024,
    maxChunks: 10,
    timeoutMs: 500,
    rebufferThreshold: 1
  },

  // 高缓冲 (适合不稳定网络)
  highBuffer: {
    minChunks: 5,
    minBytes: 2048,
    maxChunks: 15,
    timeoutMs: 1000,
    rebufferThreshold: 2
  },

  // 超高缓冲 (适合极不稳定网络)
  veryHighBuffer: {
    minChunks: 8,
    minBytes: 4096,
    maxChunks: 20,
    timeoutMs: 1500,
    rebufferThreshold: 3
  }
}

// 应用预设配置
function applyPreset(presetName) {
  const preset = BUFFER_PRESETS[presetName]
  if (preset) {
    adjustBuffer(preset)
    console.log(`✅ 已应用预设: ${presetName}`)
  } else {
    console.error('❌ 未知预设:', presetName)
    console.log('可用预设:', Object.keys(BUFFER_PRESETS).join(', '))
  }
}

// 导出函数到全局
if (typeof window !== 'undefined') {
  window.startBufferMonitor = startBufferMonitor
  window.stopBufferMonitor = stopBufferMonitor
  window.adjustBuffer = adjustBuffer
  window.applyPreset = applyPreset
  window.BUFFER_PRESETS = BUFFER_PRESETS
}

// 使用说明
console.log('📖 使用说明:')
console.log('='.repeat(70))
console.log('')
console.log('🚀 启动监控:')
console.log('   startBufferMonitor()')
console.log('')
console.log('⏹️  停止监控:')
console.log('   stopBufferMonitor()')
console.log('')
console.log('🔧 调整缓冲参数:')
console.log('   adjustBuffer({ minChunks: 5, minBytes: 2048 })')
console.log('')
console.log('📦 应用预设配置:')
console.log('   applyPreset("lowLatency")      // 低延迟 (实时对话)')
console.log('   applyPreset("balanced")        // 平衡 (默认)')
console.log('   applyPreset("highBuffer")      // 高缓冲 (不稳定网络)')
console.log('   applyPreset("veryHighBuffer")  // 超高缓冲 (极不稳定)')
console.log('')
console.log('📊 查看可用预设:')
console.log('   console.log(BUFFER_PRESETS)')
console.log('')
console.log('='.repeat(70))
console.log('')
console.log('💡 提示: 输入 startBufferMonitor() 开始实时监控')
console.log('')
