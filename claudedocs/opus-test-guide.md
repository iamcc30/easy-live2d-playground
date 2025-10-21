# OPUS 编解码测试方案

## 🎯 测试目的

验证 WebCodecs OPUS 编码器和解码器是否能正常工作,确保:
1. ✅ OPUS 编码输出纯帧数据 (无容器头)
2. ✅ 编码后的数据可以被正确解码
3. ✅ 解码后的音频可以正常播放
4. ✅ 整个编解码流程没有数据损坏

## 🚀 快速开始

### 1. 访问测试页面

启动开发服务器后,访问:
```
http://localhost:5173/opus-test
```

### 2. 测试步骤

#### 步骤 1: 初始化
```
点击 "🔧 初始化编解码器" 按钮
```
- 检查浏览器是否支持 WebCodecs API
- 初始化 OPUS 编码器和解码器
- 创建 AudioContext

**预期结果**:
```
✅ OPUS 编码器可用
✅ OPUS 解码器初始化成功
✅ AudioContext 创建成功: 16000Hz
🎉 所有编解码器准备就绪
```

#### 步骤 2: 录音和编码
```
点击 "🎤 开始录音" 按钮
对着麦克风说话 5-10 秒
点击 "🛑 停止录音" 按钮
```

**预期结果**:
```
🎤 录音已开始
📦 收到 OPUS 帧: 50 bytes (总计: 50 bytes)
📦 收到 OPUS 帧: 52 bytes (总计: 102 bytes)
...
✅ 编码器已刷新
✅ 录音完成: 150 帧
```

**关键指标**:
- 编码帧数: 约 16-17 帧/秒 (60ms/帧)
- 每帧大小: 50-80 bytes
- 录音 10 秒 → 约 160 帧 → 约 8-12 KB

#### 步骤 3: 保存数据 (可选)
```
点击 "📥 下载 OPUS 数据" 按钮
```

这会下载一个 `.opus` 文件,包含纯 OPUS 帧 (无容器)。

你可以:
1. 用十六进制编辑器查看文件内容
2. 发送给服务器进行解码测试
3. 作为测试数据保存

#### 步骤 4: 解码和播放
```
点击 "🔊 解码并播放" 按钮
```

**预期结果**:
```
🔊 开始解码 OPUS 数据
🔄 已解码 10/150 帧
🔄 已解码 20/150 帧
...
✅ 解码完成: 150/150 帧
🎵 合并音频: 9.00s
🔊 开始播放
```

**成功标志**:
- 解码成功率: 100% (所有帧都成功解码)
- 能听到自己录制的声音
- 音质清晰,无杂音或断续

## 📊 测试数据分析

### 正常的数据特征

#### OPUS 帧大小
```
静音/低音量: 20-40 bytes
正常说话: 50-80 bytes
大声说话: 80-120 bytes

平均: 60 bytes/帧
```

#### 帧率
```
配置: 60ms/帧
理论帧率: 1000ms ÷ 60ms = 16.67 帧/秒
10秒录音: 约 167 帧
```

#### 数据大小
```
10秒录音:
- 帧数: 约 167 帧
- 大小: 167 × 60 bytes = 约 10 KB
- 压缩率: 16kHz × 16bit × 1ch × 10s = 320KB (PCM)
           10KB (OPUS) = 97% 压缩率
```

### 异常情况检测

#### ❌ 没有 OPUS 帧生成
**症状**:
```
录音时日志中没有"收到 OPUS 帧"消息
编码帧数始终为 0
```

**可能原因**:
1. 麦克风权限被拒绝
2. WebCodecs 编码器初始化失败
3. 音频输入设备问题
4. AudioContext 被浏览器暂停

**诊断**:
- 检查浏览器控制台是否有错误
- 确认麦克风权限已授予
- 尝试刷新页面重新初始化

#### ❌ 解码失败
**症状**:
```
解码时出现"解码帧 X 失败"消息
解码成功率 < 100%
```

**可能原因**:
1. OPUS 数据损坏
2. 编码参数与解码器不匹配
3. 内存不足导致数据丢失

**诊断**:
- 检查编码时是否有错误消息
- 尝试缩短录音时长 (5秒以内)
- 清理资源后重新测试

#### ❌ 播放无声音
**症状**:
```
解码成功,但播放时听不到声音
```

**可能原因**:
1. 系统音量静音
2. AudioContext 被浏览器自动暂停
3. 录音时没有声音输入 (全静音)

**诊断**:
- 检查系统音量设置
- 录音时确保对着麦克风说话
- 尝试在录音时拍手或发出响声

## 🔍 验证 OPUS 数据格式

### 查看下载的 .opus 文件

使用十六进制编辑器 (如 HxD, 010 Editor) 打开下载的文件:

```
正确的 OPUS 帧 (纯帧,无容器):
00000000: FC 80 21 ... (OPUS 魔术字节)
```

```
错误的 OGG 容器:
00000000: 4F 67 67 53 ...  (OggS 容器头)
```

如果看到 `OggS` 或 `1A 45 DF A3` (WebM),说明是容器格式,需要修复编码器。

### 发送给服务器测试

可以将下载的 .opus 文件发送给服务器进行解码测试:

```python
# Python 服务器端测试代码
import opus

decoder = opus.Decoder(16000, 1)

with open('opus-test-xxx.opus', 'rb') as f:
    opus_data = f.read()

try:
    # 尝试解码
    pcm_data = decoder.decode(opus_data, frame_size=960)
    print("✅ 解码成功!")
except Exception as e:
    print(f"❌ 解码失败: {e}")
```

如果服务器能成功解码这个文件,说明客户端编码是正确的。

## 📋 测试检查清单

### ✅ 编码器测试
- [ ] 浏览器支持 WebCodecs API
- [ ] OPUS 编码器初始化成功
- [ ] 录音时生成 OPUS 帧
- [ ] 帧大小合理 (50-80 bytes)
- [ ] 帧率正常 (约 16.67 帧/秒)
- [ ] 下载的文件是纯 OPUS 帧 (无容器头)

### ✅ 解码器测试
- [ ] OPUS 解码器初始化成功
- [ ] 能成功解码所有 OPUS 帧
- [ ] 解码成功率 100%
- [ ] 解码后的音频时长正确
- [ ] 能正常播放解码后的音频
- [ ] 播放的音质清晰,无杂音

### ✅ 整体流程测试
- [ ] 编码 → 保存 → 解码 → 播放 全流程通过
- [ ] 能听到自己录制的声音
- [ ] 音频内容完整,无缺失
- [ ] 无明显的失真或损坏

## 🎯 测试结果判定

### ✅ 测试通过

如果以上所有检查项都通过,说明:

1. **客户端 OPUS 编码正常**
   - WebCodecs AudioEncoder 工作正常
   - 输出纯 OPUS 帧 (无容器)
   - 数据格式符合 OPUS 标准

2. **客户端 OPUS 解码正常**
   - WebCodecs AudioDecoder 工作正常
   - 能正确解码 OPUS 帧
   - 音频质量良好

3. **如果服务器还报错**
   - 问题不在客户端编码
   - 可能是网络传输损坏
   - 可能是服务器解码器配置问题
   - 需要检查服务器端代码

### ❌ 测试失败

如果测试失败,根据失败的步骤:

#### 初始化失败
- 原因: 浏览器不支持 WebCodecs
- 解决: 使用 Chrome 94+, Edge 94+, Opera 80+

#### 编码失败
- 原因: 编码器配置错误或浏览器 bug
- 解决: 检查 OpusEncoder.ts 配置,尝试更新浏览器

#### 解码失败
- 原因: 编码数据损坏或格式不正确
- 解决: 检查编码器输出,确认是纯 OPUS 帧

#### 播放失败
- 原因: AudioContext 问题或系统音频配置
- 解决: 检查系统音量,确认 AudioContext 未被暂停

## 🔧 调试技巧

### 1. 查看浏览器控制台

所有日志都会同时输出到浏览器控制台,可以看到更详细的信息:

```javascript
// 打开控制台: F12 或 Ctrl+Shift+I

// 过滤 OPUS 相关日志
console.filter: opus|OPUS|encode|decode
```

### 2. 检查编码器状态

在浏览器控制台运行:

```javascript
// 查看编码器配置
audioRecordingService.getEncoderStatus()

// 预期输出
{
  supported: true,
  state: 'recording',
  format: 'webcodecs-opus (raw frames)'  // ✅ 正确
}
```

### 3. 手动测试编解码

在浏览器控制台手动创建编解码器:

```javascript
// 测试编码器
const encoder = new AudioEncoder({
  output: (chunk) => console.log('编码帧:', chunk.byteLength, 'bytes'),
  error: (e) => console.error('编码错误:', e)
})

const config = {
  codec: 'opus',
  sampleRate: 16000,
  numberOfChannels: 1
}

AudioEncoder.isConfigSupported(config).then(support => {
  console.log('编码器支持:', support)
})
```

## 📖 相关文档

- [WebCodecs API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [AudioEncoder - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder)
- [AudioDecoder - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder)
- [OPUS Codec](https://opus-codec.org/)

## 🎉 总结

这个测试方案提供了完整的 OPUS 编解码验证:

1. **独立测试**: 不依赖服务器,本地验证编解码
2. **完整流程**: 录音 → 编码 → 保存 → 解码 → 播放
3. **数据验证**: 可以下载 OPUS 数据进行检查
4. **直观反馈**: 通过播放录音验证整个流程
5. **详细日志**: 每个步骤都有详细的日志输出

如果这个测试通过,就可以确认客户端的 OPUS 编解码没有问题! 🚀
