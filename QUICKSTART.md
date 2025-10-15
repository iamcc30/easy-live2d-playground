# Websocket Chat - Quick Start Guide

## 快速开始

### 1. 环境配置

创建 `.env.local` 文件（基于 `.env.example`）:

```bash
cp .env.example .env.local
```

编辑 `.env.local`:

```env
# Websocket服务器地址（已配置为你的服务器）
VITE_WS_URL=ws://live.mindarae.com:8888

# 访问令牌（请联系管理员获取）
VITE_ACCESS_TOKEN=your_token_here
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

```bash
pnpm dev
```

## 使用说明

### 连接到服务器

1. 打开应用后，在右上角可以看到连接状态按钮
2. 状态指示:
   - ⚪ 未连接
   - 🟡 连接中...
   - 🟢 已连接
   - 🟠 重连中...
   - 🔴 连接失败

3. 点击连接按钮建立Websocket连接

### 语音对话

**连接成功后:**

1. 点击麦克风按钮 🎤 开始语音输入
2. 说话后会自动发送到服务器进行识别
3. AI响应会以语音形式播放
4. Live2D角色会根据情感状态自动改变表情

**支持的监听模式:**

- **Auto模式** (默认): 服务器自动检测语音结束
- **Manual模式**: 手动点击停止
- **Realtime模式**: 持续监听（需要AEC支持）

### 表情系统

服务器返回的情感类型会自动映射到Live2D表情:

| 情感类型 | Live2D表情 | 持续时间 |
|---------|-----------|---------|
| happy   | happy     | 3秒     |
| sad     | sad       | 3秒     |
| angry   | angry     | 3秒     |
| surprised | surprised | 3秒   |
| normal  | normal    | 持续    |

## 功能特性

### ✅ 已实现

- [x] Websocket连接管理
- [x] 自动重连机制
- [x] 语音录制和发送
- [x] TTS音频播放
- [x] 嘴型同步
- [x] 情感表情联动
- [x] 连接状态可视化
- [x] 错误提示

### 🎯 工作流程

```
用户点击麦克风
    ↓
开始录音 + 发送到服务器
    ↓
服务器语音识别
    ↓
LLM处理 + 生成响应
    ↓
服务器发送:
  - TTS音频数据
  - 文本内容
  - 情感状态
    ↓
客户端播放音频 + 显示文本
    ↓
Live2D角色同步:
  - 嘴型动画
  - 表情变化
```

## 技术细节

### 音频格式

**客户端→服务器:**
- 格式: OPUS (自动降级到PCM)
- 采样率: 16000 Hz
- 声道: 单声道
- 帧长: 60ms
- 浏览器支持: Chrome 94+, Edge 94+ (WebCodecs API)
- 自动降级: 不支持浏览器使用PCM (Int16)

**服务器→客户端:**
- 格式: OPUS
- 采样率: 24000 Hz
- 声道: 单声道
- 帧长: 60ms

### 消息协议

**握手 (Hello):**
```json
{
  "type": "hello",
  "version": 1,
  "transport": "websocket",
  "features": { "mcp": true },
  "audio_params": {
    "format": "opus",
    "sample_rate": 16000,
    "channels": 1,
    "frame_duration": 60
  }
}
```

**开始监听:**
```json
{
  "session_id": "",
  "type": "listen",
  "state": "start",
  "mode": "auto"
}
```

**TTS状态:**
```json
{
  "type": "tts",
  "state": "sentence_start",
  "text": "你好，主人！"
}
```

**情感状态:**
```json
{
  "type": "llm",
  "emotion": "happy"
}
```

## 故障排除

### 连接失败

**问题**: 点击连接后显示🔴连接失败

**解决方案**:
1. 检查服务器地址是否正确: `ws://live.mindarae.com:8888`
2. 确认access_token有效
3. 查看浏览器控制台错误信息
4. 确认服务器正在运行

### 无法录音

**问题**: 点击麦克风按钮没有反应

**解决方案**:
1. 确保已建立Websocket连接（🟢已连接）
2. 检查浏览器麦克风权限
3. 尝试刷新页面重新授权
4. 查看控制台错误信息

### 没有声音

**问题**: 服务器响应但听不到声音

**解决方案**:
1. 检查浏览器音量设置
2. 确认AudioContext已启动（可能需要用户交互）
3. 查看控制台是否有音频解码错误
4. 尝试刷新页面

### 表情不变化

**问题**: Live2D角色表情不随情感变化

**解决方案**:
1. 确认模型包含对应的表情定义
2. 检查控制台情感消息是否接收
3. 查看表情ID映射是否正确
4. 确认表情文件在模型资源中存在

## 开发调试

### 查看日志

打开浏览器控制台查看详细日志:

- `🔗 Websocket connected`: 连接成功
- `🎤 Started voice listening`: 开始监听
- `🔊 TTS message`: 收到TTS消息
- `😊 LLM emotion`: 收到情感消息
- `🎵 Received audio`: 收到音频数据

### 切换模式

在 `FloatingChatInterface.vue` 中可以切换语音模式:

```typescript
const useWebsocket = ref(true) // true: Websocket模式, false: 本地语音识别
```

### 测试连接

```typescript
// 在浏览器控制台执行
const store = useChatStore()

// 测试连接
await store.connectWebsocket()

// 测试语音
await store.startVoiceListen('auto')

// 停止监听
store.stopVoiceListen()

// 断开连接
store.disconnectWebsocket()
```

## 性能优化建议

1. **音频缓冲**: 根据网络情况调整音频队列大小
2. **重连策略**: 当前最多重连10次，间隔3秒
3. **资源清理**: 页面卸载时自动断开连接和释放资源
4. **移动端优化**:
   - 降低音频分辨率
   - 禁用抗锯齿
   - 使用低功耗模式

## 下一步

1. **测试OPUS编码器**:
   - 在Chrome/Edge浏览器中测试OPUS编码
   - 在不支持浏览器中验证PCM降级
   - 检查浏览器控制台确认使用的编码格式

2. **添加更多表情映射**: 在 `App.vue:189-195` 扩展表情映射表

3. **自定义监听模式**: 在UI中添加模式切换按钮

4. **添加聊天历史**: 已支持本地存储,可扩展云端同步

## 相关文档

- 详细实现文档: `WEBSOCKET_IMPLEMENTATION.md`
- 协议规范: `Websocket连接.md`
- 项目说明: `CLAUDE.md`

## 技术支持

如有问题，请查看:
1. 浏览器控制台错误信息
2. `WEBSOCKET_IMPLEMENTATION.md` 故障排除部分
3. 服务器端日志
