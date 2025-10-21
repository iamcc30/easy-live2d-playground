# 停止录音消息修复

## 🐛 问题描述

用户点击停止录音按钮时,某些组件没有发送停止消息给服务器。

## 🔍 根本原因

项目中有多个语音控制组件,部分组件的 `stopRecording()` 函数只调用了本地 `speechService.stopRecognition()`,没有检查 WebSocket 连接状态并调用 `chatStore.stopVoiceListen()` 来通知服务器。

### 受影响的组件

1. ❌ **src/components/VoiceControls.vue**
   - 只调用了 `speechService.stopRecognition()`
   - 没有通知服务器停止

2. ❌ **src/components/AnimeVoiceControls.vue**
   - 只调用了 `speechService.stopRecognition()`
   - 没有通知服务器停止

3. ❌ **src/components/FloatingVoiceControls.vue**
   - 只调用了 `speechService.stopRecognition()`
   - 没有通知服务器停止

4. ✅ **src/components/FloatingChatInterface.vue**
   - 正确实现,已经检查 WebSocket 状态
   - 调用 `chatStore.stopVoiceListen()` 通知服务器

### 问题代码

```typescript
// ❌ 问题: 只停止本地服务,不通知服务器
const stopRecording = () => {
  isRecording.value = false
  speechService.stopRecognition()  // 只停止浏览器 Web Speech API
  // 缺少: chatStore.stopVoiceListen() 来发送停止消息给服务器
}
```

### 正确的消息流程

当用户点击停止录音时,应该执行以下流程:

```
用户点击停止按钮
    ↓
stopRecording() 被调用
    ↓
检查 WebSocket 连接状态
    ↓
如果 WebSocket 连接:
    ├─ chatStore.stopVoiceListen()
    │   ├─ audioRecordingService.stopRecording()  (停止录音)
    │   └─ websocketService.stopListen()           (发送停止消息)
    │       └─ 发送 { type: 'listen', state: 'stop' } 给服务器
    └─ isRecording.value = false
否则 (本地模式):
    ├─ speechService.stopRecognition()  (停止浏览器 API)
    └─ isRecording.value = false
```

## ✅ 解决方案

修改所有受影响组件的 `stopRecording()` 函数,添加 WebSocket 状态检查:

```typescript
// ✅ 正确: 根据连接状态选择合适的停止方法
const stopRecording = () => {
  if (!isRecording.value) return

  isRecording.value = false
  emit('recordingChange', false)
  recordingStatus.value = ''
  interimText.value = ''
  stopVoiceWaveAnimation()  // 如果有波形动画

  // 检查是否使用 WebSocket 模式
  if (chatStore.isConnected && chatStore.isListening) {
    // WebSocket 模式 - 这会发送停止消息给服务器
    chatStore.stopVoiceListen()
  } else {
    // 本地语音识别模式
    speechService.stopRecognition()
  }
}
```

### 修改的文件

1. ✅ **src/components/VoiceControls.vue**
   - 添加 WebSocket 状态检查
   - 根据连接状态选择停止方法

2. ✅ **src/components/AnimeVoiceControls.vue**
   - 添加 WebSocket 状态检查
   - 根据连接状态选择停止方法

3. ✅ **src/components/FloatingVoiceControls.vue**
   - 添加 WebSocket 状态检查
   - 根据连接状态选择停止方法

## 📋 验证步骤

### 1. 检查日志输出

启动应用并点击停止录音按钮,应该看到以下日志:

```
🛑 Stopped listening              ← websocketService.stopListen() 的日志
📤 Sent message                    ← 发送停止消息的日志
🛑 Stopped voice listening         ← chatStore.stopVoiceListen() 的日志
```

### 2. 验证服务器接收

在服务器端应该能看到接收到的停止消息:

```json
{
  "session_id": "device-12345-timestamp-random",
  "type": "listen",
  "state": "stop"
}
```

### 3. 测试各个组件

分别测试所有语音控制组件:

- ✅ VoiceControls.vue
- ✅ AnimeVoiceControls.vue
- ✅ FloatingVoiceControls.vue
- ✅ FloatingChatInterface.vue

确保在 WebSocket 连接状态下,点击停止按钮都能发送停止消息给服务器。

### 4. 测试本地模式

断开 WebSocket 连接,测试本地语音识别模式:

- 应该只调用 `speechService.stopRecognition()`
- 不应该尝试发送消息给服务器
- 不应该有 WebSocket 错误

## 🎯 技术细节

### chatStore.stopVoiceListen() 内部实现

```typescript
// src/stores/chat.ts:228-234
function stopVoiceListen(): void {
  audioRecordingService.stopRecording()  // 停止录音
  websocketService.stopListen()           // 发送停止消息
  isListening.value = false               // 更新状态
  console.log('🛑 Stopped voice listening')
}
```

### websocketService.stopListen() 内部实现

```typescript
// src/services/websocket.ts:367-376
stopListen(): void {
  const message: ListenMessage = {
    session_id: this.sessionInfo.sessionId,
    type: 'listen',
    state: 'stop',  // 停止状态
  }
  this.send(message)  // 发送 JSON 消息给服务器
  console.log('🛑 Stopped listening')
}
```

### 消息格式

发送给服务器的停止消息:

```typescript
interface ListenMessage {
  session_id: string    // 会话 ID
  type: 'listen'        // 消息类型
  state: 'stop'         // 停止状态
}
```

## 📊 影响范围

### 修复前

- 3 个组件在 WebSocket 模式下点击停止按钮时不发送停止消息
- 服务器可能无法及时知道录音已停止
- 可能导致服务器资源浪费(继续等待音频数据)

### 修复后

- 所有 4 个语音控制组件都能正确处理停止录音
- WebSocket 模式: 发送停止消息给服务器
- 本地模式: 只停止浏览器 API
- 服务器能及时收到停止通知

## 🔄 相关代码流程

### 完整的录音生命周期

```
开始录音:
用户点击开始
    ↓
startRecording()
    ↓
WebSocket 模式:
    ├─ chatStore.startVoiceListen(mode)
    │   ├─ audioRecordingService.startRecording(callback)
    │   │   └─ 每个音频块 → websocketService.sendAudioData()
    │   └─ websocketService.startListen(mode)
    │       └─ 发送 { type: 'listen', state: 'start', mode }
    └─ isRecording.value = true

本地模式:
    ├─ speechService.startRecognition()
    └─ isRecording.value = true


停止录音:
用户点击停止
    ↓
stopRecording()
    ↓
WebSocket 模式:
    ├─ chatStore.stopVoiceListen()
    │   ├─ audioRecordingService.stopRecording()
    │   │   └─ 停止录音,清理资源
    │   └─ websocketService.stopListen()
    │       └─ 发送 { type: 'listen', state: 'stop' }  ← 关键修复点
    └─ isRecording.value = false

本地模式:
    ├─ speechService.stopRecognition()
    └─ isRecording.value = false
```

## 🎉 总结

修复完成后,所有语音控制组件都能:

1. ✅ 正确检查 WebSocket 连接状态
2. ✅ WebSocket 模式下发送停止消息给服务器
3. ✅ 本地模式下只停止浏览器 API
4. ✅ 提供一致的用户体验
5. ✅ 避免服务器资源浪费

修复涉及的文件:
- src/components/VoiceControls.vue
- src/components/AnimeVoiceControls.vue
- src/components/FloatingVoiceControls.vue

参考实现:
- src/components/FloatingChatInterface.vue (已经正确实现)
