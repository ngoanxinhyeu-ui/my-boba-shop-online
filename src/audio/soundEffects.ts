/**
 * Web Audio API Sound Synthesizer for Boba Shop Simulation
 * Provides realistic procedural sound effects without relying on external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Bell ring when customer places order or presses the service bell
  playBell() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Brass desk service bell (Ding-ding with bright metallic resonance)
    const playDing = (time: number, freq: number, gainVal: number) => {
      // 1. Strike impact (metallic click)
      const oscClick = ctx.createOscillator();
      const clickGain = ctx.createGain();
      oscClick.type = 'triangle';
      oscClick.frequency.setValueAtTime(freq * 1.8, time);
      oscClick.frequency.exponentialRampToValueAtTime(300, time + 0.04);
      clickGain.gain.setValueAtTime(gainVal * 0.6, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      oscClick.connect(clickGain);
      clickGain.connect(ctx.destination);
      oscClick.start(time);
      oscClick.stop(time + 0.04);

      // 2. Fundamental tone (brass bell)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);
      osc1.frequency.exponentialRampToValueAtTime(freq - 5, time + 1.4);

      // Overtone chime
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.76, time);
      osc2.frequency.exponentialRampToValueAtTime(freq * 2.74, time + 1.0);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 1.4);
      osc2.stop(time + 1.4);
    };

    // Realistic double ting: Ting... Ting!
    playDing(now, 1760, 0.28);
    playDing(now + 0.12, 2093, 0.32);
  }

  // Realistic Cup Pickup sound (rút ly nhựa/giấy ra khỏi cây đựng ly)
  playCupPickup() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Friction slide / snap
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(4.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Plastic hollow cup "plonk/thud"
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.09);

    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Nhạc chuông hối / nhắc nhở nhẹ nhàng, êm tai (thay thế còi báo ré nhức đầu)
  playRushAlert() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Giai điệu nhắc nhở nhẹ nhàng, ấm áp như chuông quán cà phê cao cấp (D major triad: F#5 -> A5 -> D6)
    const notes = [
      { freq: 739.99, delay: 0.0, dur: 0.35, vol: 0.14 }, // F#5
      { freq: 880.00, delay: 0.12, dur: 0.38, vol: 0.16 }, // A5
      { freq: 1174.66, delay: 0.24, dur: 0.55, vol: 0.18 }, // D6 (tiếng ngân du dương)
    ];

    notes.forEach(({ freq, delay, dur, vol }) => {
      const t = now + delay;
      // 1. Âm cơ bản (warm sine wave, không gắt)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq - 2, t + dur);

      // Lowpass filter tạo độ ấm mượt, loại bỏ hoàn toàn tiếng chói tai
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, t);

      // Smooth envelope: êm dịu, không giật mình
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + dur);

      // 2. Âm bội thanh thoát (như tiếng chuông gió phong cách Nhật)
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, t);

      overtoneGain.gain.setValueAtTime(0.001, t);
      overtoneGain.gain.linearRampToValueAtTime(vol * 0.25, t + 0.015);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);

      overtone.connect(overtoneGain);
      overtoneGain.connect(ctx.destination);

      overtone.start(t);
      overtone.stop(t + dur * 0.6);
    });
  }

  private activeWaterSource: {
    stop: () => void;
  } | null = null;

  private activeSizzleSource: {
    stop: () => void;
  } | null = null;

  // Tiếng nước chảy chân thật khi rót trà từ vòi vào cốc (rushing water stream + bubbling resonance)
  startWaterStream() {
    this.stopWaterStream();
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tạo buffer tiếng nước chảy ào ạt (brown/pink noise blend with droplet density)
    const bufferSize = ctx.sampleRate * 2; // 2-second looping water stream
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink/brown filter for warm fluid acoustics
      lastOut = (lastOut * 0.88) + (white * 0.12);
      // Small random water gurgle splashes
      const splash = Math.random() > 0.985 ? (Math.random() * 2 - 1) * 0.8 : 0;
      data[i] = lastOut * 0.7 + splash;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter 1: Main liquid body (bandpass 700Hz)
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.setValueAtTime(680, now);
    bodyFilter.Q.setValueAtTime(2.2, now);

    // Filter 2: Low-pass filter to eliminate harsh static hiss, keep deep flowing water
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1400, now);

    // LFO to simulate turbulent swirling water flow
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3.5, now); // 3.5 Hz flow fluctuation
    lfoGain.gain.setValueAtTime(160, now); // swing +/- 160Hz
    lfo.connect(bodyFilter.frequency);
    lfo.start(now);

    // Liquid bubbling resonant tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    oscGain.gain.setValueAtTime(0.08, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.linearRampToValueAtTime(0.35, now + 0.08); // Smooth water onset

    noise.connect(bodyFilter);
    bodyFilter.connect(lowpass);
    lowpass.connect(masterGain);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    masterGain.connect(ctx.destination);
    noise.start(now);
    osc.start(now);

    this.activeWaterSource = {
      stop: () => {
        try {
          const stopTime = ctx.currentTime;
          masterGain.gain.linearRampToValueAtTime(0.001, stopTime + 0.06);
          setTimeout(() => {
            noise.stop();
            osc.stop();
            lfo.stop();
            noise.disconnect();
            bodyFilter.disconnect();
            lowpass.disconnect();
            masterGain.disconnect();
            this.playWaterDrip(); // Tiếng giọt nước cuối cùng khi khoá vòi
          }, 70);
        } catch {
          // ignore already stopped
        }
        this.activeWaterSource = null;
      },
    };
  }

  stopWaterStream() {
    if (this.activeWaterSource) {
      this.activeWaterSource.stop();
      this.activeWaterSource = null;
    }
  }

  // Tiếng giọt nước róc rách / giọt cuối cùng khi đóng vòi
  playWaterDrip() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.07);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Enhanced Tea Stream Pouring sound (tiếng nước chảy từ vòi ào ạt & dâng lên trong ly)
  playPourTea(durationSec: number = 3.5) {
    this.startWaterStream();
    setTimeout(() => {
      this.stopWaterStream();
    }, durationSec * 1000);
  }

  // Drop food into hot oil splash
  playFryDrop() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Splash burst: dầu sôi bắn tung toé khi thả đồ chiên
    const bufferSize = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  // Âm thanh chiên rán xì xèo sống động (tiếng rán ngập dầu sôi sục sục, nổ tanh tách, xì xèo 4 giây)
  playSizzle(durationSec: number = 4.0) {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, bufferSize, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Multi-layer sizzling crackle:
    // 1. High density micro-explosions (bọt dầu sôi nổ lách tách xì xèo)
    // 2. Rolling boiling oil body rumble
    for (let i = 0; i < bufferSize; i++) {
      const time = i / sampleRate;
      // Rolling wave amplitude modulation (tiếng sôi dập dờn 5Hz)
      const waveMod = 0.75 + 0.25 * Math.sin(2 * Math.PI * 5.2 * time);

      // Micro crackle pops
      const isPop = Math.random() > 0.94;
      const popStrength = isPop ? (Math.random() * 2 - 1) * 1.8 : 0;
      const hiss = (Math.random() * 2 - 1) * 0.35;

      left[i] = (hiss + popStrength) * waveMod;

      const isPopR = Math.random() > 0.94;
      const popStrengthR = isPopR ? (Math.random() * 2 - 1) * 1.8 : 0;
      right[i] = (hiss + popStrengthR) * waveMod;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter 1: Deep frying oil body (bandpass 950Hz) - tạo tiếng sôi sùng sục
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.setValueAtTime(950, now);
    bodyFilter.Q.setValueAtTime(1.8, now);

    // Filter 2: Sizzling high crackle (highpass 2200Hz) - tạo tiếng rán xì xèo giòn rụm
    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'highpass';
    sizzleFilter.frequency.setValueAtTime(2200, now);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.28, now);

    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(0.32, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.linearRampToValueAtTime(0.38, now + 0.1);
    masterGain.gain.setValueAtTime(0.38, now + durationSec - 0.4);
    masterGain.gain.linearRampToValueAtTime(0.001, now + durationSec);

    noise.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(masterGain);

    noise.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    sizzleGain.connect(masterGain);

    masterGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + durationSec);
  }

  // Vớt thức ăn chiên ra đĩa sứ (tongs click & ceramic plate clink)
  playPlateClink() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2100, now);
    osc.frequency.exponentialRampToValueAtTime(1950, now + 0.3);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Múc đá vào ly (tiếng đá va vào thành ly)
  playIceScoop() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.05 + Math.random() * 0.02;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200 + Math.random() * 800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  // Múc topping / trân châu rơi vào ly (tiếng plop của thạch & trân châu)
  playToppingPlop() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Bơm đường siro (tiếng pít-tông bơm siro đặc vào ly)
  playPump() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Cash / Coin ding sound
  playCoin() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Pop sound for mini-game catching boba
  playPop() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = 400 + Math.random() * 300;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Error buzz for burnt food or missed green zone
  playBuzz() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Success chime when order served
  playSuccess() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }
}

export const sounds = new SoundEngine();
