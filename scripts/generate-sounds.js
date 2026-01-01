const fs = require('fs');
const path = require('path');

// Generate a WAV file with a sine wave tone
function generateTone(frequency, duration, volume = 0.5, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2); // 16-bit mono

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Generate sine wave with envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Apply attack/release envelope
    const attackTime = 0.01;
    const releaseTime = 0.05;
    let envelope = 1;
    if (t < attackTime) {
      envelope = t / attackTime;
    } else if (t > duration - releaseTime) {
      envelope = (duration - t) / releaseTime;
    }

    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

// Generate a double beep
function generateDoubleBeep(freq1, freq2, duration = 0.1, gap = 0.05, volume = 0.5) {
  const sampleRate = 44100;
  const samples1 = Math.floor(sampleRate * duration);
  const gapSamples = Math.floor(sampleRate * gap);
  const samples2 = Math.floor(sampleRate * duration);
  const totalSamples = samples1 + gapSamples + samples2;

  const buffer = Buffer.alloc(44 + totalSamples * 2);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + totalSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(totalSamples * 2, 40);

  let offset = 44;

  // First tone
  for (let i = 0; i < samples1; i++) {
    const t = i / sampleRate;
    let envelope = 1;
    if (t < 0.01) envelope = t / 0.01;
    else if (t > duration - 0.02) envelope = (duration - t) / 0.02;
    const sample = Math.sin(2 * Math.PI * freq1 * t) * volume * envelope;
    buffer.writeInt16LE(Math.floor(sample * 32767), offset);
    offset += 2;
  }

  // Gap (silence)
  for (let i = 0; i < gapSamples; i++) {
    buffer.writeInt16LE(0, offset);
    offset += 2;
  }

  // Second tone
  for (let i = 0; i < samples2; i++) {
    const t = i / sampleRate;
    let envelope = 1;
    if (t < 0.01) envelope = t / 0.01;
    else if (t > duration - 0.02) envelope = (duration - t) / 0.02;
    const sample = Math.sin(2 * Math.PI * freq2 * t) * volume * envelope;
    buffer.writeInt16LE(Math.floor(sample * 32767), offset);
    offset += 2;
  }

  return buffer;
}

// Generate ascending arpeggio (victory sound)
function generateArpeggio(frequencies, noteDuration = 0.12, volume = 0.5) {
  const sampleRate = 44100;
  const samplesPerNote = Math.floor(sampleRate * noteDuration);
  const totalSamples = samplesPerNote * frequencies.length;

  const buffer = Buffer.alloc(44 + totalSamples * 2);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + totalSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(totalSamples * 2, 40);

  let offset = 44;

  for (const freq of frequencies) {
    for (let i = 0; i < samplesPerNote; i++) {
      const t = i / sampleRate;
      let envelope = 1;
      if (t < 0.01) envelope = t / 0.01;
      else if (t > noteDuration - 0.03) envelope = (noteDuration - t) / 0.03;
      const sample = Math.sin(2 * Math.PI * freq * t) * volume * envelope;
      buffer.writeInt16LE(Math.floor(sample * 32767), offset);
      offset += 2;
    }
  }

  return buffer;
}

const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');

// Generate all sound files
const sounds = {
  // Countdown numbers (3, 2, 1)
  'countdown-3.wav': generateTone(440, 0.15, 0.6),   // A4
  'countdown-2.wav': generateTone(554, 0.15, 0.6),   // C#5
  'countdown-1.wav': generateTone(659, 0.15, 0.6),   // E5

  // GO sound - strong double beep
  'go.wav': generateDoubleBeep(880, 1760, 0.12, 0.08, 0.7),

  // Exercise start - ascending two-tone
  'exercise-start.wav': generateDoubleBeep(523, 659, 0.12, 0.1, 0.6),

  // Rest start - calming lower tone
  'rest-start.wav': generateTone(392, 0.2, 0.5),

  // Warning - quick double beep
  'warning.wav': generateDoubleBeep(1000, 1000, 0.08, 0.1, 0.6),

  // Tick sound - short high beep
  'tick.wav': generateTone(880, 0.05, 0.4),

  // Button click - very short subtle
  'click.wav': generateTone(600, 0.03, 0.3),

  // Side switch - distinctive pattern
  'side-switch.wav': generateArpeggio([784, 523, 784], 0.08, 0.5),

  // Workout complete - victory fanfare
  'complete.wav': generateArpeggio([523, 659, 784, 1047], 0.15, 0.6),
};

// Write all files
for (const [filename, buffer] of Object.entries(sounds)) {
  const filepath = path.join(soundsDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated: ${filename}`);
}

console.log('\nAll sound files generated!');
