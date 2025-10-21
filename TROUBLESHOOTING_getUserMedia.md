# getUserMedia Error Troubleshooting Guide

## 🐛 Error Description

**Error**: `TypeError: Cannot read properties of undefined (reading 'getUserMedia')`

**Location**: `audioRecording.ts:30` → `navigator.mediaDevices.getUserMedia()`

**Stack Trace**:
```
at AudioRecordingService.initialize (audioRecording.ts:30:55)
at Proxy.connectWebsocket (chat.ts:159:35)
at toggleConnection (FloatingChatInterface.vue:53:23)
```

## 🎯 Root Cause

The error occurs because **`navigator.mediaDevices` is `undefined`** in your browser environment. This happens when:

1. **🔒 Non-HTTPS Context**: `getUserMedia` requires a secure context (HTTPS or localhost)
2. **🌐 Browser Compatibility**: Older browsers don't support `navigator.mediaDevices`
3. **⚙️ Permissions**: MediaDevices API is disabled or blocked by browser settings

## ✅ Solutions Applied

### 1. Browser Capability Detection

**File**: `src/utils/browserCapabilities.ts`

A new utility has been created to detect browser capabilities before attempting to use getUserMedia:

```typescript
// Check browser capabilities
const capabilities = getBrowserCapabilities()
// Returns: { getUserMedia, audioContext, webCodecs, isSecureContext, protocol }

// Get error message for unsupported features
const errorMessage = getUnsupportedFeatureMessage(capabilities)
// Returns helpful error messages for missing features
```

**Features**:
- ✅ Detects getUserMedia support
- ✅ Checks for AudioContext availability
- ✅ Verifies WebCodecs API support
- ✅ Validates secure context (HTTPS/localhost)
- ✅ Provides detailed error messages

### 2. Enhanced Audio Recording Service

**File**: `src/services/audioRecording.ts`

**Changes**:
- Added browser capability check before attempting getUserMedia
- Logs detailed capability information for debugging
- Provides clear error messages when features are unavailable
- Added `isInitialized()` method to check if service is ready

**Usage**:
```typescript
await audioRecordingService.initialize()
// Now throws descriptive error if getUserMedia is unavailable

if (audioRecordingService.isInitialized()) {
  // Safe to use recording features
}
```

### 3. Graceful Degradation in Chat Store

**File**: `src/stores/chat.ts`

**Changes**:
- WebSocket connection now continues even if audio initialization fails
- Shows appropriate warning/success messages based on audio availability
- Text-only mode available when audio features are unavailable
- Validates audio initialization before attempting to use recording

**Behavior**:
- ✅ **Audio Available**: "Websocket连接已建立，音频功能可用"
- ⚠️ **Audio Unavailable**: "Websocket连接已建立（仅文本模式）"
- ❌ **Connection Failed**: Appropriate error message

## 🔍 Diagnostic Steps

### Step 1: Check Browser Capabilities

Open browser console and run:
```javascript
console.log('getUserMedia supported:', !!navigator.mediaDevices?.getUserMedia)
console.log('Protocol:', window.location.protocol)
console.log('Secure context:', window.isSecureContext)
console.log('Hostname:', window.location.hostname)
```

### Step 2: Check Development Server URL

**✅ HTTPS or localhost required**:
- ✅ `https://example.com` - Secure context
- ✅ `http://localhost:5173` - Secure context (localhost)
- ✅ `http://127.0.0.1:5173` - Secure context (loopback)
- ❌ `http://192.168.x.x:5173` - NOT secure context
- ❌ `http://example.local:5173` - NOT secure context

### Step 3: Verify Browser Support

**Minimum Browser Versions**:
- Chrome: 53+ (2016)
- Firefox: 36+ (2015)
- Safari: 11+ (2017)
- Edge: 79+ (2020)

### Step 4: Check Browser Console

After connecting, you should see:
```
🌐 Browser Capabilities
  getUserMedia: ✅
  AudioContext: ✅
  WebCodecs: ✅ (or ❌ with fallback)
  Secure Context: ✅
  Protocol: https: (or http: with localhost)
```

## 🛠️ Quick Fixes

### Fix 1: Use HTTPS in Development

**Option A - vite.config.ts** (Basic self-signed cert):
```typescript
export default defineConfig({
  server: {
    https: true,
    host: '0.0.0.0'
  }
})
```

**Option B - Local tunnel** (for remote testing):
```bash
# Using ngrok
npx ngrok http 5173

# Using cloudflared
cloudflared tunnel --url http://localhost:5173
```

### Fix 2: Access via localhost

Instead of:
```
http://192.168.1.100:5173  ❌
```

Use:
```
http://localhost:5173       ✅
http://127.0.0.1:5173       ✅
```

### Fix 3: Test with Different Browser

If using Safari or Firefox with issues, try:
1. Chrome (best getUserMedia support)
2. Edge (Chromium-based, good compatibility)
3. Firefox (good support, may require permissions)

## 🧪 Testing the Fix

### Test 1: Browser Capability Detection
```typescript
import { logBrowserCapabilities } from '@/utils/browserCapabilities'

// In browser console or component
logBrowserCapabilities()
```

### Test 2: WebSocket Connection
1. Click connect button in UI
2. Check console for:
   - ✅ "Browser Capabilities" log
   - ✅ "Audio services initialized" or "Audio services unavailable"
   - ✅ Connection success message

### Test 3: Voice Recording
1. Ensure connected with audio available
2. Click microphone button
3. Grant microphone permission
4. Should see: "🎤 Started voice listening"

## 📝 Error Messages Reference

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `getUserMedia is not supported` | Non-secure context | Use HTTPS or localhost |
| `AudioContext not supported` | Old browser | Update browser |
| `音频功能不可用` | Audio init failed | Check console for details |
| `音频录制未初始化` | Trying to record without init | Check connection status |

## 🚀 Production Deployment Checklist

- [ ] HTTPS certificate configured
- [ ] Force HTTPS redirect enabled
- [ ] Browser compatibility warnings implemented
- [ ] Fallback UI for non-audio mode
- [ ] Permission prompts user-friendly
- [ ] Error messages translated and clear

## 🔗 Related Files

**Modified**:
- `src/utils/browserCapabilities.ts` - NEW: Browser feature detection
- `src/services/audioRecording.ts` - Enhanced error handling
- `src/stores/chat.ts` - Graceful degradation support

**Related**:
- `src/utils/errorHandler.ts` - Error notification system
- `src/components/FloatingChatInterface.vue` - UI connection handling
- `src/config/websocket.ts` - Audio configuration

## 📚 Additional Resources

- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- [Can I Use: getUserMedia](https://caniuse.com/stream)
- [WebRTC getUserMedia Guide](https://www.webrtc.org/getting-started/media-capture-and-constraints)

## 💡 Summary

**What Changed**:
1. ✅ Added browser capability detection utility
2. ✅ Enhanced audio service with validation
3. ✅ Graceful degradation for WebSocket connection
4. ✅ Better error messages and logging

**Result**:
- WebSocket connection works even without audio
- Clear error messages guide users to solutions
- Text-only mode available as fallback
- Comprehensive debugging information logged

**Next Steps**:
1. Test in development with `http://localhost:5173`
2. Verify browser console shows capability information
3. For production, ensure HTTPS is properly configured
4. Consider implementing UI warnings for unsupported browsers
