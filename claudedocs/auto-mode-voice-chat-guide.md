# Auto 模式语音聊天使用指南

## 概述

本应用已完整实现基于 WebSocket 的 auto 模式语音聊天功能,符合协议规范 (`Websocket连接.md`),支持服务器端 VAD (Voice Activity Detection) 自动检测语音结束。

## 功能特性

### ✅ 已实现功能

1. **原生 WebSocket 连接**
   - 自动重连机制
   - 连接状态可视化
   - URL 查询参数认证

2. **Auto 模式语音监听**
   - 服务器端 VAD 自动检测
   - OPUS 音频编码
   - 实时音频流传输

3. **完整的状态机管理**
   - kDeviceStateIdle (空闲)
   - kDeviceStateConnecting (连接中)
   - kDeviceStateListening (监听中)
   - kDeviceStateSpeaking (播放中)

4. **UI 交互**
   - 连接状态指示器
   - 语音按钮 (麦克风图标)
   - 实时状态反馈

## 使用步骤

### 1. 配置后端服务器

确保 `.env.local` 配置正确:

```bash
# WebSocket 服务器地址
VITE_WS_URL=http://111.230.57.211:8888

# 访问令牌 (如果不需要认证,可以是任意值)
VITE_ACCESS_TOKEN=your-token-here
```

### 2. 启动应用

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 3. 连接到 WebSocket 服务器

1. **打开浏览器访问** `http://localhost:5173`

2. **点击右上角的连接按钮**
   - 初始状态: ⚪ 未连接
   - 连接中: 🟡 连接中...
   - 连接成功: 🟢 已连接
   - 连接失败: 🔴 连接失败

3. **查看浏览器控制台确认连接**
   ```
   🔗 Connecting to WebSocket server: ws://111.230.57.211:8888
   📝 Authentication info: { ... }
   🔗 WebSocket connection established
   👋 Server hello response: { ... }
   ✅ WebSocket connected successfully
   ```

### 4. 开始 Auto 模式语音聊天

1. **确保已连接** (🟢 已连接)

2. **点击麦克风按钮** 🎤
   - 按钮变为 🔴 (录音中)
   - 开始说话

3. **说话后停止**
   - 服务器自动检测语音结束 (VAD)
   - 自动停止录音
   - 接收识别结果和 TTS 响应

4. **收听 AI 回复**
   - 按钮变为 🔊 (播放中)
   - Live2D 角色嘴型同步
   - 播放结束后回到空闲状态

## 协议流程说明

### Auto 模式完整流程

```
1. 用户点击 🎤 按钮
   ↓
2. 发送 listen(start, mode='auto') 消息
   {
     "session_id": "",
     "type": "listen",
     "state": "start",
     "mode": "auto"
   }
   ↓
3. 开始录音并发送音频数据 (OPUS 二进制)
   ↓
4. 服务器 VAD 检测到语音结束
   ↓
5. 服务器发送识别结果 (具体格式待确认)
   ↓
6. 服务器发送 TTS 状态消息
   {
     "type": "tts",
     "state": "sentence_start",
     "text": "AI 回复内容"
   }
   ↓
7. 服务器发送 TTS 音频数据 (OPUS 二进制)
   ↓
8. 客户端播放 TTS 音频 + 嘴型同步
   ↓
9. 播放结束,服务器发送
   {
     "type": "tts",
     "state": "stop"
   }
   ↓
10. 回到空闲状态,可以重新开始
```

### 状态转换

```
kDeviceStateIdle (空闲)
  ↓ 点击 🟢 连接按钮
kDeviceStateConnecting (连接中)
  ↓ 连接成功
kDeviceStateIdle (空闲)
  ↓ 点击 🎤 麦克风
kDeviceStateListening (监听中)
  ↓ 服务器 VAD 检测完成 / 自动停止
kDeviceStateSpeaking (播放中)
  ↓ TTS 播放结束
kDeviceStateIdle (空闲)
```

## 关键代码位置

### 连接管理

**文件**: `src/services/websocket.ts`

```typescript
// 连接到服务器
async connect(handlers: WebsocketEventHandlers = {}): Promise<void>

// 发送 listen 开始消息
startListen(mode: ListenMode = 'auto'): void

// 发送 listen 停止消息
stopListen(): void

// 发送音频数据
sendAudioData(data: ArrayBuffer): void
```

### 状态管理

**文件**: `src/stores/chat.ts`

```typescript
// 连接到 WebSocket
async connectWebsocket(): Promise<void>

// 开始语音监听 (auto 模式)
async startVoiceListen(mode: ListenMode = 'auto'): Promise<void>

// 停止语音监听
stopVoiceListen(): void

// 处理 TTS 消息
function handleTTSMessage(message: TTSMessage): void

// 处理情感消息
function handleLLMMessage(message: LLMMessage): void
```

### UI 组件

**文件**: `src/components/FloatingChatInterface.vue`

```typescript
// 切换连接状态
const toggleConnection = async () => { ... }

// 开始录音 (auto 模式)
const startRecording = async () => {
  if (useWebsocket.value && chatStore.isConnected) {
    await chatStore.startVoiceListen('auto')  // 使用 auto 模式
    isRecording.value = true
  }
}

// 停止录音
const stopRecording = () => {
  if (useWebsocket.value && chatStore.isConnected) {
    chatStore.stopVoiceListen()
    isRecording.value = false
  }
}
```

## 故障排查

### 问题 1: 连接失败

**症状**: 点击连接按钮后显示 🔴 连接失败

**检查清单**:
1. ✅ 确认 `.env.local` 中 `VITE_WS_URL` 正确
2. ✅ 确认后端服务器正在运行
3. ✅ 确认后端实现了 URL 查询参数认证
4. ✅ 查看浏览器控制台错误信息
5. ✅ 查看后端日志

**解决方法**:
```bash
# 测试后端连接
curl -I http://111.230.57.211:8888

# 应该返回 426 Upgrade Required (WebSocket 握手)
```

### 问题 2: 语音按钮无响应

**症状**: 点击 🎤 按钮没有反应

**检查清单**:
1. ✅ 确认已连接 (🟢 已连接)
2. ✅ 确认麦克风权限已授予
3. ✅ 查看控制台是否有错误

**解决方法**:
- 在浏览器地址栏授予麦克风权限
- 使用 HTTPS (某些浏览器要求)

### 问题 3: 录音无法停止

**症状**: 点击麦克风后一直显示 🔴

**原因**: Auto 模式依赖服务器端 VAD 自动停止

**检查**:
1. ✅ 确认后端实现了 VAD 功能
2. ✅ 确认后端能正确检测语音结束
3. ✅ 查看后端日志

### 问题 4: 没有收到 TTS 响应

**症状**: 录音完成后没有播放 AI 回复

**检查清单**:
1. ✅ 确认后端处理了音频数据
2. ✅ 确认后端发送了 TTS 消息
3. ✅ 查看 Network 标签 WebSocket 消息
4. ✅ 查看控制台日志

**调试方法**:
```javascript
// 在控制台查看 WebSocket 消息
// Network 标签 → WS → Messages
```

## 测试检查清单

### 连接测试

- [ ] 点击连接按钮能成功连接
- [ ] 连接状态正确显示 🟢 已连接
- [ ] 控制台显示连接成功日志
- [ ] 收到服务器 hello 响应

### Auto 模式语音测试

- [ ] 点击 🎤 按钮开始录音
- [ ] 录音状态显示 🔴
- [ ] 说话后服务器自动停止录音
- [ ] 收到 TTS 文本消息
- [ ] 播放 TTS 音频
- [ ] Live2D 嘴型同步
- [ ] 播放完成后回到空闲状态

### 错误处理测试

- [ ] 断开网络后自动重连
- [ ] 连接失败显示错误状态 🔴
- [ ] 录音时断开连接能正确处理
- [ ] 播放时断开连接能正确处理

## 性能优化建议

### 1. 音频传输优化

- OPUS 编码参数已优化 (16kHz, 60ms帧)
- 使用 ArrayBuffer 传输二进制数据
- 避免频繁创建大对象

### 2. 网络优化

- 自动重连机制 (最多10次)
- 心跳检测 (保持连接活跃)
- 断线重连不影响用户体验

### 3. UI 性能

- 使用 CSS 动画代替 JS 动画
- 防抖处理频繁事件
- 虚拟滚动 (消息过多时)

## 下一步开发建议

### 1. 增强功能

- [ ] 添加 manual 模式 (手动停止)
- [ ] 添加 realtime 模式 (持续监听)
- [ ] 唤醒词检测
- [ ] MCP 消息支持

### 2. UI 改进

- [ ] 音频波形可视化
- [ ] 录音音量指示
- [ ] 识别结果实时显示
- [ ] 更多 Live2D 表情

### 3. 后端集成

- [ ] 集成真实的 ASR 服务
- [ ] 集成真实的 LLM 服务
- [ ] 集成真实的 TTS 服务
- [ ] 情感分析

## 总结

✅ **Auto 模式语音聊天已完整实现!**

**核心特性**:
- ✅ 原生 WebSocket 连接
- ✅ Auto 模式语音监听 (服务器端 VAD)
- ✅ OPUS 音频编解码
- ✅ 完整的状态机管理
- ✅ 实时 UI 反馈
- ✅ Live2D 嘴型同步

**使用方法**:
1. 连接到 WebSocket 服务器 (点击 🟢 按钮)
2. 点击 🎤 麦克风开始说话
3. 服务器自动检测语音结束 (VAD)
4. 自动接收和播放 AI 回复
5. Live2D 角色同步嘴型

现在您可以开始测试完整的语音聊天功能了!
