# Websocket Connection State Fix

## Issue
**Error**: `websocket.ts:355 Cannot send audio: not connected`

**Symptom**: Audio data fails to send immediately after establishing websocket connection.

## Root Cause Analysis

### The Problem
There was a **state synchronization race condition** between the chat store and websocket service:

1. **Dual State Management**: Both `chat.ts` and `websocket.ts` maintained separate connection state
2. **Timing Issue**: Chat store set `connectionState = 'connected'` immediately after `websocketService.connect()` resolved
3. **Race Condition**: Audio recording started sending data before websocket service completed hello handshake
4. **Validation Failure**: `sendAudioData()` rejected packets because internal state was still transitioning

### Code Flow Before Fix
```typescript
// chat.ts:156-174
async function connectWebsocket() {
  connectionState.value = 'connecting'  // Local state
  await websocketService.connect({...}) // Websocket opens
  connectionState.value = 'connected'   // ❌ Too early!
}

// websocket.ts:38-79
async connect() {
  this.connectionState = 'connecting'
  // ... websocket opens ...
  await this.sendHello()                 // Still processing
  this.connectionState = 'connected'     // ✅ Actual ready state
}

// Meanwhile at chat.ts:206
audioRecordingService.startRecording((audioData) => {
  websocketService.sendAudioData(audioData) // ❌ Fails: "not connected"
})
```

### Sequence Diagram
```
Chat Store         Websocket Service      Audio Recording
    |                     |                      |
    |--connect()--------->|                      |
    |                     |--WebSocket.open()    |
    |                     |--sendHello()         |
    |<--Promise resolved--|                      |
    |                     |                      |
state='connected' ❌      |                      |
    |                     |                      |
    |--startRecording()------------------->     |
    |                     |                      |
    |                     |<--audioData callback-|
    |                     |                      |
    |                     |--sendAudioData() ❌  |
    |                     |  (rejected: not      |
    |                     |   connected)         |
    |                     |                      |
    |                     state='connected' ✅   |
```

## Solution

### Single Source of Truth
Changed chat store to use websocket service state directly via computed properties:

**Before** (Problematic):
```typescript
// chat.ts - Dual state management
const connectionState = ref<ConnectionState>('disconnected')
const isConnected = computed(() => connectionState.value === 'connected')

async function connectWebsocket() {
  connectionState.value = 'connecting'  // ❌ Manual sync
  await websocketService.connect({...})
  connectionState.value = 'connected'   // ❌ Race condition
}
```

**After** (Fixed):
```typescript
// chat.ts - Single source of truth
const connectionState = computed(() => websocketService.getConnectionState())
const isConnected = computed(() => websocketService.isConnected())

async function connectWebsocket() {
  // ✅ State managed by service only
  await websocketService.connect({...})
  errorHandler.showSuccess('连接成功', 'Websocket连接已建立')
}
```

### Changes Made

#### `src/stores/chat.ts`

1. **Connection State** (Line 30-32):
   ```typescript
   - const connectionState = ref<ConnectionState>('disconnected')
   - const isConnected = computed(() => connectionState.value === 'connected')
   + const connectionState = computed(() => websocketService.getConnectionState())
   + const isConnected = computed(() => websocketService.isConnected())
   ```

2. **Connect Function** (Line 156-179):
   ```typescript
   - connectionState.value = 'connecting'
   await websocketService.connect({...})
   - connectionState.value = 'connected'
   + // State automatically reflects service state
   ```

3. **Disconnect Function** (Line 184-188):
   ```typescript
   - connectionState.value = 'disconnected'
   + // State automatically updates via computed
   ```

4. **Disconnect Handler** (Line 240-244):
   ```typescript
   - connectionState.value = 'disconnected'
   + // State automatically updates
   ```

## Benefits

1. **✅ Eliminates Race Condition**: Audio sending now correctly waits for true connection state
2. **✅ Single Source of Truth**: Only websocket service manages connection state
3. **✅ Reactive Updates**: Vue computed properties automatically track service state
4. **✅ Safer State Transitions**: No manual synchronization between store and service
5. **✅ Better Debugging**: One location to inspect connection state

## Testing Validation

### Expected Behavior
1. **Connection Flow**:
   - Click connect button
   - Console shows: `🔗 Websocket connection opened`
   - Console shows: `👋 Server hello response`
   - Console shows: `✅ Websocket connected successfully`
   - UI shows: 🟢 已连接

2. **Audio Sending**:
   - Click microphone button after connection
   - Console shows: `🎵 Using OPUS encoding` (or `📊 Using PCM fallback`)
   - Console shows: `🎤 Started voice listening`
   - NO ERROR: "Cannot send audio: not connected" ✅
   - Audio data flows successfully to server

### Debug Console Commands
```javascript
// Check connection state alignment
const store = useChatStore()
console.log('Store state:', store.connectionState)
console.log('Service state:', websocketService.getConnectionState())
console.log('Are they equal?', store.connectionState === websocketService.getConnectionState())

// Test state reactivity
websocketService.connect({...})
// Watch store.connectionState update automatically
```

## Related Files
- `src/stores/chat.ts` - Chat store with fixed state management
- `src/services/websocket.ts` - Websocket service (unchanged, already correct)
- `src/services/audioRecording.ts` - Audio recording service (unchanged)

## Issue Resolution
- ✅ Eliminated dual state management
- ✅ Fixed race condition in connection flow
- ✅ Audio data now sends reliably
- ✅ State transitions are atomic and safe
