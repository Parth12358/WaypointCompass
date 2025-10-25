const say = require('say');
const gtts = require('node-gtts')('en');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class TTSService {
  constructor() {
    this.isEnabled = true;
    this.audioDir = path.join(__dirname, '../../audio');
    this.ensureAudioDirectory();
  }

  ensureAudioDirectory() {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  // Use system TTS (Windows SAPI, macOS say, Linux espeak)
  async speakSystem(text, options = {}) {
    if (!this.isEnabled) return;
    
    return new Promise((resolve, reject) => {
      const voice = options.voice || null; // null uses default system voice
      const speed = options.speed || 1.0;
      
      console.log(`🔊 TTS Speaking: "${text}"`);
      
      say.speak(text, voice, speed, (err) => {
        if (err) {
          console.error('TTS Error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Generate audio file using Google TTS
  async generateAudioFile(text, filename) {
    if (!this.isEnabled) return null;
    
    return new Promise((resolve, reject) => {
      const filepath = path.join(this.audioDir, `${filename}.mp3`);
      
      gtts.stream(text).pipe(fs.createWriteStream(filepath))
        .on('finish', () => {
          console.log(`🎵 Audio file generated: ${filename}.mp3`);
          resolve(filepath);
        })
        .on('error', (err) => {
          console.error('GTTS Error:', err);
          reject(err);
        });
    });
  }

  // Play pre-generated audio file
  async playAudioFile(filepath) {
    if (!this.isEnabled || !fs.existsSync(filepath)) return;
    
    return new Promise((resolve, reject) => {
      // Use appropriate audio player based on OS
      let command;
      if (process.platform === 'win32') {
        // Use Windows Media Player for MP3 files
        command = `powershell -c "Add-Type -AssemblyName presentationCore; $mediaPlayer = New-Object system.windows.media.mediaplayer; $mediaPlayer.open('${filepath}'); $mediaPlayer.Play(); Start-Sleep -Seconds 3"`;
      } else if (process.platform === 'darwin') {
        command = `afplay "${filepath}"`;
      } else {
        command = `mpg123 "${filepath}" || aplay "${filepath}"`;
      }

      exec(command, (error) => {
        if (error) {
          console.error('Audio playback error:', error);
          // Don't reject, just log the error and continue
          resolve();
        } else {
          resolve();
        }
      });
    });
  }

  // Main speak method with fallback options
  async speak(text, options = {}) {
    if (!this.isEnabled) return;
    
    try {
      // Try system TTS first (faster)
      await this.speakSystem(text, options);
    } catch (error) {
      console.warn('System TTS failed, trying backup method:', error.message);
      try {
        // Fallback to generated audio file
        const filename = `tts_${Date.now()}`;
        const filepath = await this.generateAudioFile(text, filename);
        await this.playAudioFile(filepath);
        
        // Clean up temporary file after a delay
        setTimeout(() => {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        }, 5000);
      } catch (fallbackError) {
        console.error('All TTS methods failed:', fallbackError);
      }
    }
  }

  // Navigation-specific messages
  async announceNavigation(message, type = 'info') {
    const prefix = {
      'success': '🎉 Congratulations! ',
      'warning': '⚠️ Attention: ',
      'info': '🧭 Navigation: ',
      'progress': '📍 Update: '
    }[type] || '';

    await this.speak(prefix + message);
  }

  // Pre-generate common navigation phrases for faster playback
  async preGenerateCommonPhrases() {
    const phrases = [
      { text: "Congratulations! You have reached your destination!", filename: "destination_reached" },
      { text: "You are getting closer to your destination", filename: "getting_closer" },
      { text: "You are moving away from your destination", filename: "getting_further" },
      { text: "GPS signal acquired", filename: "gps_acquired" },
      { text: "Warning: High risk area detected", filename: "high_risk_warning" },
      { text: "Navigation started", filename: "navigation_started" },
      { text: "Sidequest available nearby", filename: "sidequest_available" },
      { text: "Safety check complete", filename: "safety_complete" }
    ];

    console.log('🎵 Pre-generating common TTS phrases...');
    
    for (const phrase of phrases) {
      try {
        const filepath = path.join(this.audioDir, `${phrase.filename}.mp3`);
        if (!fs.existsSync(filepath)) {
          await this.generateAudioFile(phrase.text, phrase.filename);
        }
      } catch (error) {
        console.warn(`Failed to generate phrase: ${phrase.filename}`, error.message);
      }
    }
    
    console.log('✅ Common TTS phrases ready');
  }

  // Quick play common phrases
  async playCommonPhrase(phraseName) {
    const filepath = path.join(this.audioDir, `${phraseName}.mp3`);
    if (fs.existsSync(filepath)) {
      await this.playAudioFile(filepath);
    } else {
      // Fallback to system TTS (faster and more reliable)
      const phraseMap = {
        'destination_reached': 'Congratulations! You have reached your destination!',
        'getting_closer': 'You are getting closer to your destination',
        'getting_further': 'You are moving away from your destination',
        'gps_acquired': 'GPS signal acquired',
        'high_risk_warning': 'Warning: High risk area detected',
        'navigation_started': 'Navigation started',
        'sidequest_available': 'Sidequest available nearby',
        'safety_complete': 'Safety check complete'
      };
      
      if (phraseMap[phraseName]) {
        await this.speakSystem(phraseMap[phraseName]);
      }
    }
  }

  // Enable/disable TTS
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`🔊 TTS ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Get TTS status
  getStatus() {
    return {
      enabled: this.isEnabled,
      audioDirectory: this.audioDir,
      availablePhrases: fs.existsSync(this.audioDir) 
        ? fs.readdirSync(this.audioDir).filter(f => f.endsWith('.mp3'))
        : []
    };
  }
}

module.exports = new TTSService();