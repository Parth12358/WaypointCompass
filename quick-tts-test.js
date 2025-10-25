// Simple TTS test that uses system speech
const ttsService = require('./src/services/ttsService');

async function quickTest() {
  console.log('🔊 Quick TTS Test...');
  
  try {
    // Test system speech (most reliable)
    await ttsService.speakSystem('Hello! TTS system is working perfectly.');
    console.log('✅ System TTS test successful');
    
    // Test navigation announcement
    await ttsService.announceNavigation('Navigation test successful', 'success');
    console.log('✅ Navigation announcement test successful');
    
    // Test common phrase (fallback to system TTS)
    await ttsService.playCommonPhrase('getting_closer');
    console.log('✅ Common phrase test successful');
    
    console.log('🎉 All TTS tests passed!');
    
  } catch (error) {
    console.error('❌ TTS test failed:', error.message);
  }
}

quickTest();