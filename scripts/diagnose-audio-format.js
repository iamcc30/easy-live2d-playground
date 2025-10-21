// Audio Format Diagnostic Script
// Run this in browser console to capture and analyze audio data format

console.clear()
console.log('🔍 Audio Format Diagnostic Tool')
console.log('='.repeat(70))
console.log('')

let capturedChunks = []
const maxCapture = 3 // Capture first 3 chunks

// Intercept WebSocket audio data
const originalConnect = websocketService.connect.bind(websocketService)
websocketService.connect = function(callbacks = {}) {
  const originalOnAudioData = callbacks.onAudioData

  callbacks.onAudioData = function(audioData) {
    // Capture first few chunks for analysis
    if (capturedChunks.length < maxCapture) {
      capturedChunks.push(audioData.slice(0))

      console.log(`📦 Captured chunk #${capturedChunks.length}:`)
      console.log('   Size:', audioData.byteLength, 'bytes')

      // Analyze header
      const view = new Uint8Array(audioData)
      const header16 = Array.from(view.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ')

      console.log('   First 16 bytes:', header16)
      console.log('')

      // Check common audio formats
      const formatAnalysis = analyzeAudioFormat(view)
      console.log('   🔎 Format Analysis:')
      Object.entries(formatAnalysis).forEach(([format, result]) => {
        const icon = result.match ? '✅' : '❌'
        console.log(`      ${icon} ${format}: ${result.confidence}% - ${result.reason}`)
      })
      console.log('')

      if (capturedChunks.length === maxCapture) {
        console.log('✅ Capture complete. Analyzing...')
        console.log('')
        performDetailedAnalysis()
      }
    }

    // Call original handler
    if (originalOnAudioData) {
      originalOnAudioData(audioData)
    }
  }

  return originalConnect(callbacks)
}

// Format detection function
function analyzeAudioFormat(uint8Array) {
  const results = {}

  // OGG Container (OggS magic number)
  const isOgg = uint8Array[0] === 0x4f &&
                uint8Array[1] === 0x67 &&
                uint8Array[2] === 0x67 &&
                uint8Array[3] === 0x53
  results['OGG Container'] = {
    match: isOgg,
    confidence: isOgg ? 100 : 0,
    reason: isOgg ? 'Valid OggS header found' : 'No OggS magic number'
  }

  // WebM Container (EBML header)
  const isWebM = uint8Array[0] === 0x1a &&
                 uint8Array[1] === 0x45 &&
                 uint8Array[2] === 0xdf &&
                 uint8Array[3] === 0xa3
  results['WebM Container'] = {
    match: isWebM,
    confidence: isWebM ? 100 : 0,
    reason: isWebM ? 'Valid EBML header found' : 'No EBML magic number'
  }

  // Raw OPUS Frame (TOC byte analysis)
  // OPUS TOC byte structure: CCCCCSSS where C=config, S=stereo/frame count
  const tocByte = uint8Array[0]
  const config = (tocByte >> 3) & 0x1f // 5 bits
  const stereo = (tocByte >> 2) & 0x01 // 1 bit
  const frameCount = tocByte & 0x03 // 2 bits

  // Valid OPUS configs: 0-31, most common: 16-19 (SILK/Hybrid)
  const likelyOpus = config >= 0 && config <= 31 && uint8Array.length > 2
  const confidence = likelyOpus ? 60 : 10 // Lower confidence without container

  results['Raw OPUS Frame'] = {
    match: likelyOpus && !isOgg && !isWebM,
    confidence: confidence,
    reason: likelyOpus
      ? `TOC byte suggests OPUS (config=${config}, stereo=${stereo}, frames=${frameCount})`
      : 'TOC byte pattern unlikely for OPUS'
  }

  // WAV format (RIFF header)
  const isWav = uint8Array[0] === 0x52 && // R
                uint8Array[1] === 0x49 && // I
                uint8Array[2] === 0x46 && // F
                uint8Array[3] === 0x46    // F
  results['WAV Container'] = {
    match: isWav,
    confidence: isWav ? 100 : 0,
    reason: isWav ? 'Valid RIFF header found' : 'No RIFF header'
  }

  // MP3 format (ID3 or sync word)
  const isMP3 = (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33) || // ID3
                (uint8Array[0] === 0xff && (uint8Array[1] & 0xe0) === 0xe0) // Sync word
  results['MP3'] = {
    match: isMP3,
    confidence: isMP3 ? 100 : 0,
    reason: isMP3 ? 'Valid MP3 header found' : 'No MP3 header'
  }

  return results
}

// Detailed analysis after capturing chunks
function performDetailedAnalysis() {
  console.log('📊 Detailed Analysis Report')
  console.log('='.repeat(70))
  console.log('')

  // Determine most likely format
  let detectedFormat = 'Unknown'
  let formatConfidence = 0

  capturedChunks.forEach((chunk, idx) => {
    const view = new Uint8Array(chunk)
    const analysis = analyzeAudioFormat(view)

    Object.entries(analysis).forEach(([format, result]) => {
      if (result.confidence > formatConfidence) {
        formatConfidence = result.confidence
        detectedFormat = format
      }
    })
  })

  console.log('🎯 Detected Format:', detectedFormat)
  console.log('   Confidence:', formatConfidence + '%')
  console.log('')

  // Provide recommendations
  console.log('💡 Recommendations:')
  console.log('')

  if (detectedFormat === 'Raw OPUS Frame') {
    console.log('⚠️  Server is sending Raw OPUS frames (NOT OGG container)')
    console.log('')
    console.log('   Problem: Browser AudioContext.decodeAudioData() requires container format')
    console.log('   Solution Options:')
    console.log('')
    console.log('   Option 1 (RECOMMENDED): Server-side fix')
    console.log('   └─ Change server to send OGG/Opus or WebM/Opus container')
    console.log('   └─ Browser can natively decode these formats')
    console.log('')
    console.log('   Option 2: Client-side OPUS decoder')
    console.log('   └─ Install: pnpm add opus-decoder')
    console.log('   └─ Use WASM decoder to handle Raw OPUS frames')
    console.log('   └─ Trade-offs: +300KB bundle, ~10x slower than native')
    console.log('')
    console.log('   Option 3: Wrap OPUS in OGG container client-side')
    console.log('   └─ Install: pnpm add ogg-opus-encoder')
    console.log('   └─ Wrap each frame before sending to AudioContext')
    console.log('   └─ Trade-offs: Complex, adds overhead')
    console.log('')
  } else if (detectedFormat === 'OGG Container' || detectedFormat === 'WebM Container') {
    console.log('✅ Server is sending proper container format')
    console.log('')
    console.log('   The format is correct for browser native decoding.')
    console.log('')
    console.log('   If decoding still fails, possible issues:')
    console.log('   1. Corrupted/incomplete audio data')
    console.log('   2. Unsupported codec inside container')
    console.log('   3. Browser compatibility issue')
    console.log('')
    console.log('   Debug steps:')
    console.log('   - Check server TTS output format settings')
    console.log('   - Verify complete frames (not truncated)')
    console.log('   - Test in different browsers (Chrome/Firefox/Safari)')
    console.log('')
  } else if (detectedFormat === 'Unknown') {
    console.log('❓ Format could not be determined')
    console.log('')
    console.log('   Possible causes:')
    console.log('   1. Custom/proprietary format')
    console.log('   2. Encrypted/compressed data')
    console.log('   3. Corrupted transmission')
    console.log('')
    console.log('   Next steps:')
    console.log('   - Check server audio output configuration')
    console.log('   - Verify WebSocket binary transmission')
    console.log('   - Consult server TTS documentation')
    console.log('')
  }

  console.log('='.repeat(70))
  console.log('')
  console.log('📋 Raw Data for Manual Analysis:')
  console.log('')

  capturedChunks.forEach((chunk, idx) => {
    const view = new Uint8Array(chunk)
    const header32 = Array.from(view.slice(0, 32))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    console.log(`Chunk ${idx + 1} (${chunk.byteLength} bytes):`)
    console.log(`  ${header32}...`)
    console.log('')
  })

  console.log('='.repeat(70))
  console.log('✅ Diagnostic complete')
  console.log('')
  console.log('💾 Captured chunks saved in: capturedChunks variable')
  console.log('   Access with: console.log(capturedChunks[0])')
}

// Make captured chunks available globally
window.capturedChunks = capturedChunks

console.log('✅ Diagnostic tool installed')
console.log('')
console.log('📝 Next steps:')
console.log('   1. Send voice input to trigger TTS')
console.log('   2. Wait for diagnostic analysis to complete')
console.log('   3. Review recommendations')
console.log('')
console.log('💡 The tool will automatically capture and analyze the first 3 audio chunks')
console.log('')
