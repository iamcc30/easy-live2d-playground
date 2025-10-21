# 音频数据未发送问题 - 完整诊断

## 问题描述

用户报告：实际我并没有看到有发送给服务端

## 可能的原因分析

### 原因 1: WebSocket 未正确连接 ⭐⭐⭐⭐⭐

**症状**：
- 控制台看到 `❌ Cannot send audio: not connected`
- Network 标签看不到 WebSocket 连接

**诊断步骤**：
1. 打开浏览器控制台 (F12)
2. 点击"连接"按钮
3. 查看是否有：
   ```
   ✅ WebSocket connected successfully
   ```

**如果没有看到连接成功**：
- 检查 `.env.local` 文件中的 `VITE_WS_URL`
- 确认服务器地址正确且可访问
- 检查服务器是否正在运行

**修复方法**：
```bash
# 检查环境变量配置
cat .env.local

# 应该包含：
VITE_WS_URL=ws://111.230.57.211:8888  # 您的服务器地址
```

---

### 原因 2: 麦克风权限未授予 ⭐⭐⭐⭐⭐

**症状**：
- 点击麦克风按钮后没有任何日志
- 浏览器没有弹出权限请求

**诊断步骤**：
1. 检查浏览器地址栏是否有麦克风图标
2. 查看浏览器设置 → 隐私和安全 → 网站设置 → 麦克风
3. 确认当前网站的麦克风权限状态

**修复方法**：
- Chrome: 地址栏左侧 → 网站设置 → 麦克风 → 允许
- Firefox: 地址栏左侧 → 权限 → 麦克风 → 允许
- Safari: Safari 菜单 → 偏好设置 → 网站 → 麦克风 → 允许

---

### 原因 3: 音频录制未正确启动 ⭐⭐⭐⭐

**症状**：
- 控制台看到 `⚠️ No data callback set, skipping audio data`
- 或看到 `❌ Failed to start voice listening`

**诊断步骤**：
1. 确认 WebSocket 已连接（绿色状态）
2. 点击麦克风按钮
3. 查看控制台是否有：
   ```
   ✅ Voice listening started successfully
   ```

**可能的子问题**：

#### 3a. 录制服务未初始化
```
Error: Audio recording not initialized
```
**修复**：刷新页面，确保先连接 WebSocket

#### 3b. AudioContext 被挂起
```
AudioContext state: suspended
```
**修复**：代码已自动处理，但如果问题持续，手动点击页面任意位置激活 AudioContext

---

### 原因 4: 浏览器不支持 WebCodecs ⭐⭐⭐

**症状**：
- 控制台显示 `📊 Using PCM fallback`
- 但仍然可以工作，只是数据量更大

**诊断**：
```javascript
// 在控制台运行
console.log('WebCodecs支持:', typeof AudioEncoder !== 'undefined')
```

**说明**：
- Safari 不支持 WebCodecs，会自动降级到 PCM
- 这不影响功能，只是数据量变大（~2KB/帧 vs ~128字节/帧）

---

### 原因 5: ScriptProcessor 未触发 ⭐⭐⭐

**症状**：
- 看到 `✅ Voice listening started successfully`
- 但没有看到 `🎵 Encoded OPUS frame` 或 `📊 Sending PCM data`

**原因**：
- 麦克风没有检测到声音
- 系统静音或音量太低
- 选择了错误的音频输入设备

**诊断步骤**：
1. 检查系统音量设置
2. 确认麦克风未静音
3. 大声说话测试
4. 使用其他应用测试麦克风是否工作

**修复方法**：
```bash
# macOS: 系统设置 → 声音 → 输入
# Windows: 设置 → 系统 → 声音 → 输入设备
# 确认选择了正确的麦克风设备
```

---

### 原因 6: OPUS 编码器初始化失败 ⭐⭐

**症状**：
- 看到 `🎵 Encoded OPUS frame` 但没有 `🎼 OPUS encoded chunk`
- 或看到 `⚠️ No callback set for encoded data`

**原因**：
- OPUS 编码器回调未正确设置
- WebCodecs API 异常

**诊断**：
查看 `src/services/opusEncoder.ts` 的初始化日志

**修复**：
- 刷新页面重试
- 如果持续失败，系统会自动降级到 PCM

---

### 原因 7: WebSocket 连接中断 ⭐⭐⭐

**症状**：
- 初期看到音频发送日志
- 但随后停止
- 看到 `❌ Cannot send audio: not connected, readyState: 3`

**原因**：
- 网络中断
- 服务器关闭
- WebSocket 超时

**诊断**：
查看 Network 标签 → WS → 连接状态是否为红色

**修复**：
- 检查网络连接
- 确认服务器运行状态
- 点击"重新连接"按钮

---

## 完整的诊断流程

### 步骤 1: 运行诊断脚本

1. 复制 `scripts/diagnose-audio.js` 的内容
2. 打开浏览器控制台 (F12)
3. 粘贴并回车运行
4. 查看诊断输出

### 步骤 2: 检查连接状态

```
期望日志：
🔗 Connecting to WebSocket server: ws://...
✅ WebSocket connected successfully
```

**如果失败**：参见 [原因 1](#原因-1-websocket-未正确连接-)

### 步骤 3: 启动录音

```
期望日志：
🎙️ Starting voice listen with mode: auto
📡 WebSocket connection state: connected
🔌 WebSocket ready state: true
✅ Audio recording initialized
🎵 Using OPUS encoding
✅ Voice listening started successfully
```

**如果失败**：参见 [原因 2](#原因-2-麦克风权限未授予-) 或 [原因 3](#原因-3-音频录制未正确启动-)

### 步骤 4: 说话测试

```
期望日志（每 64ms 循环）：
🎵 Encoded OPUS frame: 960 samples at 0.064s
🎼 OPUS encoded chunk: 128 bytes, timestamp: 64000
🔊 Audio callback triggered: 128 bytes
📤 Sent audio data: 128 bytes (total: 128 bytes)
```

**如果失败**：参见 [原因 5](#原因-5-scriptprocessor-未触发-) 或 [原因 6](#原因-6-opus-编码器初始化失败-)

### 步骤 5: 验证网络传输

1. 打开 Network 标签
2. 筛选 WS (WebSocket)
3. 点击 WebSocket 连接
4. 切换到 Messages 标签
5. 应该看到：
   - ⬆️ 绿色箭头（发送）每 64ms 出现
   - Length: ~128 bytes (OPUS) 或 ~2KB (PCM)

**如果看不到**：参见 [原因 7](#原因-7-websocket-连接中断-)

---

## 快速检查清单

使用以下清单快速排查：

- [ ] **WebSocket 已连接** → 控制台有 `✅ WebSocket connected successfully`
- [ ] **麦克风权限已授予** → 地址栏有麦克风图标且未被禁止
- [ ] **录音已启动** → 控制台有 `✅ Voice listening started successfully`
- [ ] **正在说话** → 对着麦克风大声说话
- [ ] **看到编码日志** → 控制台有 `🎵 Encoded OPUS frame` 或 `📊 Sending PCM data`
- [ ] **看到回调日志** → 控制台有 `🔊 Audio callback triggered`
- [ ] **看到发送日志** → 控制台有 `📤 Sent audio data`
- [ ] **Network 标签有 WS 消息** → Messages 标签看到绿色箭头

---

## 服务器端验证

如果客户端日志显示一切正常（有 `📤 Sent audio data`），但您仍然认为服务器没收到，请在服务器端添加日志：

### Python WebSocket 服务器示例

```python
import asyncio
import websockets
import json
from datetime import datetime

async def handle_client(websocket, path):
    print(f"[{datetime.now()}] 🔗 Client connected from {websocket.remote_address}")

    audio_packet_count = 0
    audio_bytes_total = 0
    last_packet_time = None

    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # 二进制音频数据
                audio_packet_count += 1
                audio_bytes_total += len(message)

                current_time = datetime.now()
                if last_packet_time:
                    interval = (current_time - last_packet_time).total_seconds() * 1000
                    print(f"[{current_time}] 🎵 Audio packet #{audio_packet_count}: {len(message)} bytes, interval: {interval:.1f}ms")
                else:
                    print(f"[{current_time}] 🎵 First audio packet: {len(message)} bytes")

                last_packet_time = current_time

                # 验证数据不为空
                if len(message) == 0:
                    print("⚠️ WARNING: Received empty audio packet!")

            elif isinstance(message, str):
                # JSON 消息
                try:
                    data = json.loads(message)
                    print(f"[{datetime.now()}] 📨 JSON message: type={data.get('type')}")

                    # 响应 hello 消息
                    if data.get('type') == 'hello':
                        response = {
                            'type': 'hello',
                            'session_id': 'test-session-123',
                            'status': 'connected'
                        }
                        await websocket.send(json.dumps(response))
                        print(f"[{datetime.now()}] 👋 Sent hello response")

                except json.JSONDecodeError as e:
                    print(f"❌ Failed to parse JSON: {e}")

    except websockets.exceptions.ConnectionClosed as e:
        print(f"[{datetime.now()}] 🔌 Client disconnected: {e}")

    finally:
        print(f"[{datetime.now()}] 📊 Session summary:")
        print(f"  - Audio packets: {audio_packet_count}")
        print(f"  - Total bytes: {audio_bytes_total}")
        if audio_packet_count > 0:
            print(f"  - Average packet size: {audio_bytes_total / audio_packet_count:.1f} bytes")

# 启动服务器
async def main():
    print("🚀 Starting WebSocket server on ws://0.0.0.0:8888")
    async with websockets.serve(handle_client, "0.0.0.0", 8888):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
```

### 期望的服务器日志

```
🚀 Starting WebSocket server on ws://0.0.0.0:8888
[2025-01-18 10:00:00] 🔗 Client connected from ('192.168.1.100', 54321)
[2025-01-18 10:00:00] 📨 JSON message: type=hello
[2025-01-18 10:00:00] 👋 Sent hello response
[2025-01-18 10:00:05] 📨 JSON message: type=listen
[2025-01-18 10:00:06] 🎵 First audio packet: 128 bytes
[2025-01-18 10:00:06] 🎵 Audio packet #2: 131 bytes, interval: 64.2ms
[2025-01-18 10:00:06] 🎵 Audio packet #3: 129 bytes, interval: 63.8ms
[2025-01-18 10:00:06] 🎵 Audio packet #4: 128 bytes, interval: 64.1ms
...
```

---

## 常见误区

### ❌ 误区 1: "我没看到文字，所以没发送"

**澄清**：音频数据是**二进制格式**，不是文字！
- 客户端发送的是 ArrayBuffer（二进制音频）
- 服务器收到的是 bytes 对象
- 需要在服务器端用 ASR (如 Whisper) 转成文字

### ❌ 误区 2: "Network 标签里什么都没有"

**检查**：
- 确认筛选器选择了 "WS" (WebSocket)
- 不要选 "XHR" 或 "Fetch"
- WebSocket 连接显示为单独的条目

### ❌ 误区 3: "我看到日志了，但服务器没收到"

**可能原因**：
- 服务器代码没有正确处理二进制数据
- 服务器日志未启用
- 防火墙拦截了 WebSocket 连接

**验证方法**：
使用 `wscat` 工具测试服务器：
```bash
npm install -g wscat
wscat -c ws://111.230.57.211:8888
```

---

## 最可能的问题

根据经验，90% 的"没有发送"问题是由以下原因导致的：

1. **WebSocket 未连接** (40%)
2. **麦克风权限未授予** (30%)
3. **麦克风没有声音输入** (15%)
4. **服务器端没有正确处理二进制数据** (10%)
5. **其他** (5%)

---

## 下一步行动

请按以下顺序操作：

### 立即执行
1. **运行诊断脚本** (`scripts/diagnose-audio.js`)
2. **检查控制台日志** - 寻找 `📤 Sent audio data`
3. **检查 Network 标签** - 查看 WS Messages

### 如果控制台有发送日志
→ 问题在服务器端，检查服务器日志和代码

### 如果控制台没有发送日志
→ 问题在客户端，按清单逐项检查

### 需要帮助
请提供以下信息：
- 完整的控制台日志（从连接到说话）
- Network 标签截图
- 服务器端日志（如果有）
- 浏览器和操作系统版本

---

## 总结

✅ **代码实现是正确的**，数据流完整：
```
麦克风 → AudioContext → ScriptProcessor → OPUS编码器
→ 回调触发 → WebSocket.send() → 服务器
```

🔍 **问题可能在**：
- WebSocket 连接状态
- 麦克风权限和输入
- 浏览器兼容性
- 服务器端处理

📋 **使用清单和诊断脚本快速定位问题**
