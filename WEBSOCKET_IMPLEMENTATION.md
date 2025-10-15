# Websocket Chat Integration - Implementation Guide

## Overview

This document describes the implementation of Websocket-based voice chat integration with the easy-live2d-playground application. The implementation follows the protocol specification defined in `Websocket连接.md`.

## Architecture

### Core Components

1. **Type Definitions** (`src/types/websocket.ts`)
   - Complete TypeScript interfaces for all protocol messages
   - Configuration types for audio and connection settings
   - Event handler types for Websocket events

2. **Configuration** (`src/config/websocket.ts`)
   - Websocket server URL and authentication settings
   - Audio parameters (OPUS, 16kHz, 1 channel, 60ms frames)
   - Device ID and Client ID management
   - Reconnection settings

3. **Services**
   - **WebsocketService** (`src/services/websocket.ts`): Core Websocket connection management
   - **AudioRecordingService** (`src/services/audioRecording.ts`): Microphone audio capture
   - **AudioPlaybackService** (`src/services/audioPlayback.ts`): TTS audio playback
   - **LipSyncService** (`src/utils/lipSync.ts`): Existing lip sync integration

4. **State Management** (`src/stores/chat.ts`)
   - Pinia store for chat state
   - Integration with Websocket and audio services
   - Connection state and message handling

5. **UI Integration** (`src/App.vue`)
   - Live2D character emotion state integration
   - Automatic expression updates based on LLM emotions
   - Lip sync activation during TTS playback

## Protocol Implementation

### Connection Flow

```
1. User initiates connection
   ↓
2. Initialize audio services (recording + playback)
   ↓
3. Create Websocket connection with authentication via subprotocols:
   - Subprotocols sent in Sec-WebSocket-Protocol header:
     * auth.<base64_token>
     * protocol-version.1
     * device-id.<MAC_address>
     * client-id.<UUID>
   Note: Browser WebSocket API doesn't support custom headers,
         so authentication is encoded as WebSocket subprotocols
   ↓
4. Server parses subprotocols from Sec-WebSocket-Protocol header
   ↓
5. Server validates authentication and accepts connection
   ↓
6. Send hello message with audio params
   ↓
7. Receive server hello response
   ↓
8. Connection established ✓
```

**Important**: Authentication is passed via **WebSocket subprotocols** which the server receives in the `Sec-WebSocket-Protocol` HTTP header during the handshake. Server must parse these subprotocols to extract authentication data.

**Server Implementation Required**: See `claudedocs/websocket-header-auth-implementation.md` for detailed server-side implementation examples in Python and Node.js.

### Message Types

#### Client → Server

1. **Hello Message**
   ```typescript
   {
     type: 'hello',
     version: 1,
     transport: 'websocket',
     features: { mcp: true },
     audio_params: {
       format: 'opus',
       sample_rate: 16000,
       channels: 1,
       frame_duration: 60
     }
   }
   ```

2. **Listen Message**
   ```typescript
   // Start listening
   {
     session_id: '',
     type: 'listen',
     state: 'start',
     mode: 'auto' | 'manual' | 'realtime'
   }

   // Stop listening
   {
     session_id: '',
     type: 'listen',
     state: 'stop'
   }
   ```

3. **Binary Audio Data**
   - OPUS-encoded audio frames sent as binary WebSocket messages (Chrome 94+, Edge 94+)
   - Automatic fallback to PCM Int16 on unsupported browsers
   - Format detection logged in console on recording start

#### Server → Client

1. **Hello Response**
   ```typescript
   {
     type: 'hello',
     transport: 'websocket',
     audio_params: {
       format: 'opus',
       sample_rate: 24000,
       channels: 1,
       frame_duration: 60
     }
   }
   ```

2. **TTS Message**
   ```typescript
   {
     type: 'tts',
     state: 'start' | 'stop' | 'sentence_start',
     text?: string  // Only in sentence_start
   }
   ```

3. **LLM Emotion Message**
   ```typescript
   {
     type: 'llm',
     emotion: string  // e.g., 'happy', 'sad', 'surprised'
   }
   ```

4. **Binary Audio Data**
   - OPUS-encoded TTS audio from server
   - Decoded and played through AudioPlaybackService

### Audio Processing

#### Recording (Client → Server)

1. **Capture**: MediaDevices API captures microphone audio
2. **Processing**: ScriptProcessorNode processes audio frames
3. **Encoding**: WebCodecs API OPUS encoding (Chrome 94+, Edge 94+) with automatic PCM Int16 fallback
4. **Transmission**: Binary frames sent via Websocket

#### Playback (Server → Client)

1. **Reception**: Binary audio data received from server
2. **Decoding**: AudioContext decodes OPUS data (or fallback to PCM)
3. **Queueing**: Audio buffers queued for sequential playback
4. **Playback**: AudioBufferSourceNode plays audio
5. **Lip Sync**: Integrated with LipSyncService during playback

## Usage

### Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update configuration:
   ```env
   VITE_WS_URL=wss://your-server.com/ws
   VITE_ACCESS_TOKEN=your_token_here
   ```

### Integration in Components

```typescript
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()

// Connect to Websocket server
await chatStore.connectWebsocket()

// Start voice listening
await chatStore.startVoiceListen('auto')

// Stop listening
chatStore.stopVoiceListen()

// Disconnect
chatStore.disconnectWebsocket()
```

### State Management

```typescript
// Connection state
chatStore.connectionState  // 'disconnected' | 'connecting' | 'connected' | 'error'
chatStore.isConnected      // boolean

// Voice state
chatStore.isListening      // boolean
chatStore.isSpeaking       // boolean
chatStore.currentEmotion   // string

// Messages
chatStore.messages         // ChatMessage[]
chatStore.addMessage(text, isUser, audioUrl, emotion)
```

## Features

### ✅ Implemented

- [x] Websocket connection with authentication
- [x] OPUS audio encoding with WebCodecs API (automatic PCM fallback)
- [x] Audio recording service with format auto-detection
- [x] Audio playback service with queue management
- [x] Protocol message handling (hello, listen, TTS, LLM)
- [x] Emotion state integration with Live2D character
- [x] Automatic lip sync during TTS playback
- [x] Connection state management
- [x] Reconnection mechanism
- [x] Error handling and user notifications

### 🚧 TODO / Future Improvements

1. **Testing**
   - Browser compatibility testing for OPUS encoding
   - Unit tests for services
   - Integration tests for message flow
   - E2E tests for voice interaction

2. **Authentication Flow**
   - Current: Token from environment variable
   - TODO: Implement proper authentication service
   - Add token refresh mechanism

3. **Wake Word Detection**
   - Implement client-side wake word detection
   - Send detect message when wake word detected

4. **MCP Protocol**
   - Define MCP payload structure
   - Implement MCP message handling logic

5. **UI Components**
   - Add listen mode selector (auto/manual/realtime)
   - Add encoder status indicator (OPUS/PCM)

6. **Advanced Features**
   - Network quality monitoring
   - Audio quality metrics
   - Session persistence and recovery

## File Structure

```
src/
├── types/
│   └── websocket.ts           # TypeScript type definitions
├── config/
│   └── websocket.ts           # Configuration and settings
├── services/
│   ├── websocket.ts           # Core Websocket service
│   ├── audioRecording.ts      # Audio recording with OPUS encoding
│   ├── audioPlayback.ts       # Audio playback service
│   └── opusEncoder.ts         # WebCodecs OPUS encoder wrapper
├── stores/
│   └── chat.ts                # Updated chat store with Websocket integration
├── utils/
│   ├── lipSync.ts             # Existing lip sync service
│   ├── errorHandler.ts        # Error handling utilities
│   └── storage.ts             # Chat history storage
└── App.vue                    # Updated with emotion integration
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Websocket server

**Solutions**:
1. Check `VITE_WS_URL` in `.env.local`
2. Verify `VITE_ACCESS_TOKEN` is set (required for authentication)
3. Check browser console for connection errors
4. Verify server is running and accessible
5. **Ensure server parses Sec-WebSocket-Protocol header for authentication**

**Problem**: Connection closes immediately (code 1000 or 1002)

**Solutions**:
1. Verify access token is valid and not expired
2. Check server logs for authentication/protocol errors
3. **Ensure server implements subprotocol parsing** (see `claudedocs/websocket-header-auth-implementation.md`)
4. Verify server accepts one of the offered subprotocols
5. Check server console for subprotocol parsing errors

**Problem**: Server doesn't recognize authentication

**Solutions**:
1. Server must parse `Sec-WebSocket-Protocol` header
2. Implement subprotocol parsing on server side
3. Decode base64 token from `auth.<token>` subprotocol
4. Convert device-id hyphens back to colons (`AB-CD-EF` → `AB:CD:EF`)
5. See detailed implementation guide in `claudedocs/websocket-header-auth-implementation.md`

### Audio Issues

**Problem**: Microphone not working

**Solutions**:
1. Grant microphone permissions in browser
2. Check browser console for getUserMedia errors
3. Verify audio recording is initialized before starting

**Problem**: TTS audio not playing

**Solutions**:
1. Check browser console for audio decoding errors
2. Verify server is sending proper OPUS-encoded audio
3. Check AudioContext state (may need user interaction to resume)

### Emotion Issues

**Problem**: Live2D character not showing emotions

**Solutions**:
1. Verify model has emotion expressions defined
2. Check expression IDs match emotion map in `App.vue:189-195`
3. Verify LLM emotion messages are being received

## Performance Considerations

1. **Audio Frame Size**: 60ms frames balance latency and processing overhead
2. **Buffer Size**: ScriptProcessorNode uses power-of-2 buffer sizes
3. **Audio Queue**: Playback queue prevents audio stuttering
4. **Reconnection**: Exponential backoff prevents server overload

## Security Considerations

1. **Authentication**: Always use secure tokens
2. **WSS Protocol**: Use encrypted Websocket connections (wss://)
3. **Token Storage**: Tokens stored in localStorage (consider more secure options)
4. **CORS**: Ensure server has proper CORS configuration

## References

- Protocol Specification: `Websocket连接.md`
- Easy Live2D Documentation: https://github.com/Panzer-Jack/easy-live2d
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
