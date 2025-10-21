#!/usr/bin/env node
/**
 * WebSocket 语音交互系统 - 自动化测试脚本
 *
 * 使用方法:
 * 1. 确保应用正在运行 (pnpm dev)
 * 2. 在浏览器控制台执行此脚本
 * 3. 按照提示完成各项测试
 */

// 测试配置
const TEST_CONFIG = {
  // 测试超时时间
  CONNECTION_TIMEOUT: 10000,
  RECORDING_DURATION: 10000,
  TTS_WAIT_TIMEOUT: 30000,

  // 测试阈值
  MIN_AUDIO_CHUNKS: 5,
  MIN_SUCCESS_RATE: 0.8,
}

// 测试状态
const testResults = {
  connection: null,
  hello: null,
  sessionId: null,
  audioRecording: null,
  audioSending: null,
  ttsReceiving: null,
  audioPlayback: null,
  endToEnd: null,
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logHeader(message) {
  console.log('\n' + '='.repeat(60))
  log(message, 'bright')
  console.log('='.repeat(60) + '\n')
}

// 测试 1: 连接和 Hello 消息
async function testConnection() {
  logHeader('测试 1/5: WebSocket 连接与 Hello 消息')

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      logError('连接超时')
      testResults.connection = false
      reject(new Error('Connection timeout'))
    }, TEST_CONFIG.CONNECTION_TIMEOUT)

    websocketService.connect({
      onConnected: () => {
        clearTimeout(timeout)
        logSuccess('WebSocket 连接成功')
        testResults.connection = true
      },

      onHello: (message) => {
        logSuccess('Hello 消息交换成功')
        testResults.hello = true

        console.group('📨 Hello 响应详情')
        console.log('协议版本:', message.version)
        console.log('传输方式:', message.transport)
        console.log('MCP 支持:', message.features?.mcp)

        const session = websocketService.getSessionInfo()
        console.log('Session ID:', session.sessionId)
        testResults.sessionId = session.sessionId

        if (message.session_id) {
          logInfo('服务器返回了 session_id (非标准)')
        } else {
          logInfo('服务器未返回 session_id (符合协议)')
        }
        console.groupEnd()

        resolve(message)
      },

      onError: (error) => {
        clearTimeout(timeout)
        logError(`连接错误: ${error.message}`)
        testResults.connection = false
        testResults.hello = false
        reject(error)
      }
    })
  })
}

// 测试 2: 音频录制与发送
async function testAudioRecording() {
  logHeader('测试 2/5: 音频录制与发送')

  let audioChunksSent = 0
  let totalBytesSent = 0

  // 初始化录音
  await audioRecordingService.initialize()
  logSuccess('音频录制服务初始化完成')

  // 检查编码器状态
  const encoderStatus = audioRecordingService.getEncoderStatus()
  console.group('🎤 音频编码器状态')
  console.log('支持 MediaRecorder:', encoderStatus.supported)
  console.log('当前状态:', encoderStatus.state)
  console.log('音频格式:', encoderStatus.format)
  console.groupEnd()

  if (encoderStatus.format === 'opus/ogg') {
    logSuccess('使用 OPUS/OGG 编码 (最优)')
  } else if (encoderStatus.format === 'pcm') {
    logWarning('降级到 PCM 编码 (带宽较高)')
  }

  // 开始监听
  websocketService.startListen('auto')
  logSuccess('已发送 Listen 消息 (auto 模式)')

  // 开始录音
  await audioRecordingService.startRecording((audioData) => {
    audioChunksSent++
    totalBytesSent += audioData.byteLength

    // 发送到服务器
    websocketService.sendAudioData(audioData)

    if (audioChunksSent === 1) {
      logInfo(`首个音频块: ${audioData.byteLength} bytes`)
    }
  })

  logSuccess('录音已启动')
  logInfo(`请说话测试... (录制 ${TEST_CONFIG.RECORDING_DURATION / 1000} 秒)`)

  // 录制指定时长
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.RECORDING_DURATION))

  // 停止录音
  await audioRecordingService.stopRecording()
  websocketService.stopListen()
  logSuccess('录音已停止')

  // 验证结果
  console.group('📊 录音统计')
  console.log('发送音频块数:', audioChunksSent)
  console.log('总发送字节:', totalBytesSent)
  console.log('平均块大小:', Math.round(totalBytesSent / audioChunksSent), 'bytes')

  const session = websocketService.getSessionInfo()
  console.log('WebSocket 已发送:', session.audioBytesSent, 'bytes')
  console.groupEnd()

  // 判断测试结果
  if (audioChunksSent >= TEST_CONFIG.MIN_AUDIO_CHUNKS) {
    logSuccess(`发送了 ${audioChunksSent} 个音频块`)
    testResults.audioRecording = true
    testResults.audioSending = true
  } else {
    logError(`音频块数量不足: ${audioChunksSent} < ${TEST_CONFIG.MIN_AUDIO_CHUNKS}`)
    testResults.audioRecording = false
    testResults.audioSending = false
  }

  return { audioChunksSent, totalBytesSent }
}

// 测试 3: TTS 接收与播放
async function testAudioPlayback() {
  logHeader('测试 3/5: TTS 音频接收与播放')

  let ttsStartReceived = false
  let audioChunksReceived = 0
  let totalBytesReceived = 0

  // 初始化播放
  await audioPlaybackService.initialize()
  logSuccess('音频播放服务初始化完成')

  // 重新连接以设置监听器
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (audioChunksReceived > 0) {
        logWarning('收到音频数据但未完成播放')
        resolve({ audioChunksReceived, totalBytesReceived })
      } else {
        logError('未收到 TTS 音频数据')
        testResults.ttsReceiving = false
        testResults.audioPlayback = false
        reject(new Error('No TTS audio received'))
      }
    }, TEST_CONFIG.TTS_WAIT_TIMEOUT)

    websocketService.connect({
      onTTS: (message) => {
        console.group('🔊 TTS 消息')
        console.log('状态:', message.state)
        console.log('文本:', message.text || '(无文本)')
        console.groupEnd()

        if (message.state === 'start') {
          ttsStartReceived = true
          logSuccess('收到 TTS 开始消息')
        } else if (message.state === 'stop') {
          clearTimeout(timeout)
          logSuccess('收到 TTS 结束消息')

          // 等待播放完成
          setTimeout(() => {
            const stats = audioPlaybackService.getPlaybackStats()
            console.group('📊 播放统计')
            console.log('总接收块数:', stats.totalChunks)
            console.log('成功解码:', stats.successfulChunks)
            console.log('失败块数:', stats.failedChunks)
            console.log('成功率:', stats.successRate)
            console.log('总时长:', stats.totalDuration.toFixed(2) + 's')
            console.groupEnd()

            const successRate = stats.successfulChunks / stats.totalChunks
            if (successRate >= TEST_CONFIG.MIN_SUCCESS_RATE) {
              logSuccess(`播放成功率: ${(successRate * 100).toFixed(1)}%`)
              testResults.ttsReceiving = true
              testResults.audioPlayback = true
            } else {
              logError(`播放成功率过低: ${(successRate * 100).toFixed(1)}%`)
              testResults.ttsReceiving = true
              testResults.audioPlayback = false
            }

            resolve({ audioChunksReceived, totalBytesReceived })
          }, 2000)
        }
      },

      onAudioData: (audioData) => {
        audioChunksReceived++
        totalBytesReceived += audioData.byteLength

        if (audioChunksReceived === 1) {
          logInfo(`首个音频块: ${audioData.byteLength} bytes`)

          // 检查格式
          const view = new Uint8Array(audioData)
          const header = Array.from(view.slice(0, 4))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')

          if (header === '4f 67 67 53') {
            logInfo('音频格式: OGG/Opus ✅')
          } else if (header === '1a 45 df a3') {
            logInfo('音频格式: WebM ✅')
          } else {
            logInfo(`音频格式: 未知 (${header})`)
          }
        }

        // 添加到播放队列
        audioPlaybackService.addAudioData(audioData)
      }
    })

    logInfo('等待服务器 TTS 响应...')
    logInfo('(提示: 您可能需要先发送一些语音输入)')
  })
}

// 测试 4: 端到端流程
async function testEndToEnd() {
  logHeader('测试 4/5: 端到端语音对话流程')

  logInfo('此测试将执行完整的语音对话流程:')
  logInfo('1. 连接服务器')
  logInfo('2. 录制语音')
  logInfo('3. 发送到服务器')
  logInfo('4. 接收 TTS 响应')
  logInfo('5. 播放音频')
  console.log('')

  try {
    // 1. 确保已连接
    if (!websocketService.isConnected()) {
      await websocketService.connect()
      logSuccess('WebSocket 连接成功')
    }

    // 2. 初始化音频系统
    await audioRecordingService.initialize()
    await audioPlaybackService.initialize()
    logSuccess('音频系统初始化完成')

    // 3. 设置监听器
    let ttsReceived = false
    websocketService.connect({
      onTTS: (message) => {
        if (message.state === 'start') {
          ttsReceived = true
          logSuccess('收到 TTS 响应')
        }
      },
      onAudioData: (data) => {
        audioPlaybackService.addAudioData(data)
      }
    })

    // 4. 开始录音
    websocketService.startListen('auto')
    await audioRecordingService.startRecording((data) => {
      websocketService.sendAudioData(data)
    })

    logSuccess('开始录音，请说话...')
    logInfo('录制 5 秒后自动停止')

    // 5. 等待录制
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 6. 停止录音
    await audioRecordingService.stopRecording()
    websocketService.stopListen()
    logSuccess('录音已停止')

    // 7. 等待 TTS 响应
    logInfo('等待服务器处理...')
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (ttsReceived) {
          resolve(true)
        } else {
          reject(new Error('No TTS response'))
        }
      }, 15000)

      const checkInterval = setInterval(() => {
        if (ttsReceived) {
          clearTimeout(timeout)
          clearInterval(checkInterval)
          resolve(true)
        }
      }, 500)
    })

    logSuccess('端到端测试完成')
    testResults.endToEnd = true

  } catch (error) {
    logError(`端到端测试失败: ${error.message}`)
    testResults.endToEnd = false
    throw error
  }
}

// 生成测试报告
function generateReport() {
  logHeader('测试报告')

  console.log('测试结果汇总:\n')

  const tests = [
    { name: 'WebSocket 连接', key: 'connection' },
    { name: 'Hello 消息交换', key: 'hello' },
    { name: 'Session ID 处理', key: 'sessionId' },
    { name: '音频录制', key: 'audioRecording' },
    { name: '音频发送', key: 'audioSending' },
    { name: 'TTS 接收', key: 'ttsReceiving' },
    { name: '音频播放', key: 'audioPlayback' },
    { name: '端到端流程', key: 'endToEnd' },
  ]

  let passCount = 0
  let totalTests = 0

  tests.forEach(test => {
    const result = testResults[test.key]
    totalTests++

    if (result === true) {
      passCount++
      logSuccess(`${test.name}: 通过`)
    } else if (result === false) {
      logError(`${test.name}: 失败`)
    } else if (result) {
      passCount++
      logInfo(`${test.name}: ${result}`)
    } else {
      logWarning(`${test.name}: 未测试`)
    }
  })

  console.log('\n' + '='.repeat(60))
  const successRate = (passCount / totalTests * 100).toFixed(1)
  log(`\n总体成功率: ${passCount}/${totalTests} (${successRate}%)\n`,
      successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red')

  if (passCount === totalTests) {
    logSuccess('🎉 所有测试通过！系统运行正常！')
  } else if (passCount >= totalTests * 0.8) {
    logWarning('⚠️  大部分测试通过，但有些问题需要注意')
  } else {
    logError('❌ 多个测试失败，需要排查问题')
  }

  console.log('='.repeat(60) + '\n')

  // 详细统计
  const session = websocketService.getSessionInfo()
  console.group('📊 详细统计')
  console.log('Session ID:', session.sessionId)
  console.log('消息数:', session.messageCount)
  console.log('已发送音频:', (session.audioBytesSent / 1024).toFixed(2) + ' KB')
  console.log('已接收音频:', (session.audioBytesReceived / 1024).toFixed(2) + ' KB')

  const playStats = audioPlaybackService.getPlaybackStats()
  console.log('播放成功率:', playStats.successRate)
  console.log('总播放时长:', playStats.totalDuration.toFixed(2) + 's')
  console.groupEnd()
}

// 主测试流程
async function runAllTests() {
  logHeader('🚀 WebSocket 语音交互系统 - 自动化测试')

  logInfo('开始执行完整测试套件...')
  logInfo('预计耗时: 2-3 分钟')
  console.log('')

  try {
    // 测试 1: 连接
    await testConnection()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 测试 2: 录音
    await testAudioRecording()
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 测试 3: 播放 (需要先有语音输入)
    logInfo('提示: 测试 3 需要服务器返回 TTS 音频')
    logInfo('如果长时间没有响应，可能是因为服务器没有返回数据')
    try {
      await testAudioPlayback()
    } catch (error) {
      logWarning(`播放测试跳过: ${error.message}`)
    }
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 测试 4: 端到端
    await testEndToEnd()

  } catch (error) {
    logError(`测试异常: ${error.message}`)
    console.error(error)
  } finally {
    // 生成报告
    await new Promise(resolve => setTimeout(resolve, 2000))
    generateReport()
  }
}

// 导出测试函数
if (typeof window !== 'undefined') {
  window.runVoiceTests = runAllTests
  window.testConnection = testConnection
  window.testAudioRecording = testAudioRecording
  window.testAudioPlayback = testAudioPlayback
  window.testEndToEnd = testEndToEnd
  window.showTestReport = generateReport
}

// 使用说明
console.log('\n' + '='.repeat(60))
log('🧪 WebSocket 语音交互测试工具已加载', 'bright')
console.log('='.repeat(60))
console.log('\n使用方法:')
console.log('  runVoiceTests()       - 运行完整测试套件')
console.log('  testConnection()      - 仅测试连接')
console.log('  testAudioRecording()  - 仅测试录音')
console.log('  testAudioPlayback()   - 仅测试播放')
console.log('  testEndToEnd()        - 端到端测试')
console.log('  showTestReport()      - 显示测试报告')
console.log('\n' + '='.repeat(60) + '\n')

// 自动运行提示
logInfo('提示: 输入 runVoiceTests() 开始测试')
