/**
 * Audio Transmission Diagnostic Script
 *
 * Run this in browser console to diagnose audio sending issues
 *
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 4. Click microphone button and start speaking
 * 5. Check the diagnostic output
 */

(function() {
  console.log('🔧 Audio Transmission Diagnostic Tool Started');
  console.log('═'.repeat(60));

  // Check 1: WebSocket State
  console.log('\n📡 WEBSOCKET STATE CHECK');
  console.log('─'.repeat(60));

  const checkWebSocket = () => {
    try {
      // Try to access Vue app instance
      const vueApp = document.querySelector('#app').__vueParentComponent?.appContext?.app;
      if (!vueApp) {
        console.error('❌ Cannot access Vue app instance');
        return false;
      }

      // Check Pinia store
      const store = vueApp.config.globalProperties.$pinia;
      if (!store) {
        console.error('❌ Cannot access Pinia store');
        return false;
      }

      console.log('✅ Vue app accessible');
      return true;
    }
    catch (error) {
      console.error('❌ Error accessing app:', error);
      return false;
    }
  };

  // Check 2: Audio Context
  console.log('\n🎵 AUDIO CONTEXT CHECK');
  console.log('─'.repeat(60));

  const checkAudioContext = () => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.error('❌ AudioContext not supported in this browser');
        return false;
      }
      console.log('✅ AudioContext API available');

      // Check WebCodecs support
      if (typeof AudioEncoder === 'undefined') {
        console.warn('⚠️ WebCodecs API not supported - will use PCM fallback');
      }
      else {
        console.log('✅ WebCodecs API available (OPUS encoding supported)');
      }

      return true;
    }
    catch (error) {
      console.error('❌ Error checking audio APIs:', error);
      return false;
    }
  };

  // Check 3: Microphone Permission
  console.log('\n🎤 MICROPHONE PERMISSION CHECK');
  console.log('─'.repeat(60));

  const checkMicrophonePermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      console.log(`Permission state: ${result.state}`);

      if (result.state === 'granted') {
        console.log('✅ Microphone permission granted');
        return true;
      }
      else if (result.state === 'prompt') {
        console.warn('⚠️ Microphone permission not yet requested');
        return false;
      }
      else {
        console.error('❌ Microphone permission denied');
        return false;
      }
    }
    catch (error) {
      console.warn('⚠️ Cannot check microphone permission (may need to request first)');
      return null;
    }
  };

  // Check 4: Network Monitoring
  console.log('\n📊 NETWORK MONITORING SETUP');
  console.log('─'.repeat(60));

  const setupNetworkMonitoring = () => {
    let wsFound = false;
    let audioBytesSent = 0;
    let audioPacketsSent = 0;
    let lastPacketTime = 0;

    // Try to find WebSocket connections
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('ws://') || entry.name.includes('wss://')) {
          console.log('🔍 Found WebSocket connection:', entry.name);
          wsFound = true;
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    }
    catch (error) {
      console.warn('⚠️ Cannot observe network resources');
    }

    // Monitor console for audio sending logs
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);

      const message = args.join(' ');

      // Detect audio data sending
      if (message.includes('📤 Sent audio data:')) {
        audioPacketsSent++;
        const match = message.match(/(\d+) bytes/);
        if (match) {
          audioBytesSent += parseInt(match[1]);
          const now = Date.now();
          const interval = lastPacketTime ? now - lastPacketTime : 0;
          lastPacketTime = now;

          console.log(`📈 Stats: ${audioPacketsSent} packets, ${audioBytesSent} bytes total, ${interval}ms since last`);
        }
      }

      // Detect errors
      if (message.includes('❌ Cannot send audio')) {
        console.error('🚨 CRITICAL: Audio sending blocked - WebSocket not connected!');
      }

      if (message.includes('⚠️ No data callback set')) {
        console.error('🚨 CRITICAL: Audio callback not set - recording not started properly!');
      }
    };

    console.log('✅ Network monitoring active');
    console.log('📝 Watching for audio transmission logs...');
  };

  // Check 5: WebSocket Inspector
  console.log('\n🔌 WEBSOCKET INSPECTION GUIDE');
  console.log('─'.repeat(60));
  console.log('To verify WebSocket data transmission:');
  console.log('1. Open DevTools Network tab');
  console.log('2. Filter by "WS" (WebSocket)');
  console.log('3. Click on the WebSocket connection');
  console.log('4. Go to "Messages" tab');
  console.log('5. Look for binary messages (↑ green arrows) every ~64ms');
  console.log('');

  // Run checks
  const runDiagnostics = async () => {
    console.log('\n🏃 Running diagnostics...\n');

    const wsOk = checkWebSocket();
    const audioOk = checkAudioContext();
    const micOk = await checkMicrophonePermission();

    setupNetworkMonitoring();

    console.log('\n📋 DIAGNOSTIC SUMMARY');
    console.log('═'.repeat(60));
    console.log(`WebSocket Access: ${wsOk ? '✅ OK' : '❌ FAILED'}`);
    console.log(`Audio APIs: ${audioOk ? '✅ OK' : '❌ FAILED'}`);
    console.log(`Microphone Permission: ${micOk === true ? '✅ OK' : micOk === false ? '❌ DENIED' : '⚠️ UNKNOWN'}`);
    console.log('═'.repeat(60));

    console.log('\n💡 NEXT STEPS:');
    if (!wsOk || !audioOk) {
      console.log('❌ Critical issues detected - fix these first');
    }
    else if (micOk === false) {
      console.log('❌ Microphone permission denied - grant permission in browser settings');
    }
    else {
      console.log('✅ Basic checks passed');
      console.log('📝 Now:');
      console.log('   1. Click the microphone button');
      console.log('   2. Start speaking');
      console.log('   3. Watch for audio transmission logs above');
      console.log('   4. Check Network > WS > Messages tab');
    }
  };

  runDiagnostics();

  console.log('\n🔍 Diagnostic tool is now monitoring...');
  console.log('Speak into microphone and watch for transmission logs.\n');
})();
