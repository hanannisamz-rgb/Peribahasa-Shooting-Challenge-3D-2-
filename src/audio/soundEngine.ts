class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicMuted = false;

  // Background music scheduler state
  private musicGain: GainNode | null = null;
  private musicPlaying = false;
  private musicTimerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;

  private ensureContext(ignoreMute = false): AudioContext | null {
    if (!ignoreMute && this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.musicGain && this.ctx) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.muted || this.musicMuted ? 0 : 0.085;
      this.musicGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public unlock() {
    const ctx = this.ensureContext(true);
    if (ctx && !this.musicPlaying) {
      this.startBackgroundMusic();
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.syncMusicVolume();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    this.syncMusicVolume();
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  private syncMusicVolume() {
    if (!this.ctx || !this.musicGain) return;
    const target = this.muted || this.musicMuted ? 0 : 0.085;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
  }

  public startBackgroundMusic() {
    const ctx = this.ensureContext(true);
    if (!ctx || this.musicPlaying) return;

    this.musicPlaying = true;
    this.nextStepTime = ctx.currentTime + 0.05;
    this.syncMusicVolume();

    // 32-step upbeat futuristic arcade progression (120 BPM -> 0.25s per eighth-note step)
    const stepDuration = 0.23;

    // Chords: Cmaj7 -> Am7 -> Fmaj7 -> G6
    const bassPattern = [
      130.81, 0, 130.81, 196.0, 130.81, 0, 164.81, 196.0, // C3
      110.0, 0, 110.0, 164.81, 110.0, 0, 130.81, 164.81, // A2
      87.31, 0, 87.31, 130.81, 87.31, 0, 110.0, 130.81, // F2
      98.0, 0, 98.0, 146.83, 98.0, 0, 123.47, 146.83, // G2
    ];

    const leadArp = [
      523.25, 659.25, 783.99, 659.25, 987.77, 783.99, 659.25, 523.25,
      440.0, 523.25, 659.25, 523.25, 783.99, 659.25, 523.25, 440.0,
      349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 523.25, 659.25,
      392.0, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 493.88,
    ];

    const padRoots = [261.63, 220.0, 174.61, 196.0];

    const scheduleStep = (step: number, time: number) => {
      if (!this.ctx || !this.musicGain) return;
      if (this.muted || this.musicMuted) return;

      const idx = step % 32;

      // Soft warm bass pulse
      const bassFreq = bassPattern[idx];
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassFreq, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, time);

        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(0.45, time + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.88);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + stepDuration * 0.92);
      }

      // Cheerful synth bell arpeggio
      const leadFreq = leadArp[idx];
      if (leadFreq > 0 && idx % 2 === 0 || idx % 4 === 3) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(leadFreq, time);

        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(0.26, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 1.15);

        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + stepDuration * 1.2);
      }

      // Gentle chord pad every 8 steps (1 bar)
      if (idx % 8 === 0) {
        const root = padRoots[Math.floor(idx / 8)];
        [root, root * 1.25, root * 1.5].forEach((freq) => {
          if (!this.ctx || !this.musicGain) return;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);

          g.gain.setValueAtTime(0.001, time);
          g.gain.linearRampToValueAtTime(0.09, time + 0.25);
          g.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 7.8);

          osc.connect(g);
          g.connect(this.musicGain);
          osc.start(time);
          osc.stop(time + stepDuration * 7.9);
        });
      }
    };

    this.musicTimerId = window.setInterval(() => {
      if (!this.ctx || !this.musicPlaying) return;
      if (this.ctx.state === 'suspended') return;
      while (this.nextStepTime < this.ctx.currentTime + 0.28) {
        scheduleStep(this.currentStep, this.nextStepTime);
        this.nextStepTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 32;
      }
    }, 100);
  }

  public stopBackgroundMusic() {
    this.musicPlaying = false;
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  public playLaserShot() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.14);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1450, now);
    osc2.frequency.exponentialRampToValueAtTime(320, now + 0.11);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.15);
    osc2.stop(now + 0.15);
  }

  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.16);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playCorrectHit() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.065;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  public playWrongHit() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(145, now + 0.24);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playStageUnlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.29);
    });
  }

  public playVictoryFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0, d: 0.16 },
      { f: 659.25, t: 0.14, d: 0.16 },
      { f: 783.99, t: 0.28, d: 0.16 },
      { f: 1046.5, t: 0.44, d: 0.36 },
      { f: 783.99, t: 0.72, d: 0.16 },
      { f: 1046.5, t: 0.88, d: 0.55 },
    ];
    melody.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + n.t;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
    });
  }

  public playFireworkPop() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}

export const soundEngine = new SoundEngine();
