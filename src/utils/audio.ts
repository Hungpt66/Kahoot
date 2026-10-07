/**
 * Audio Engine for BIDV EduPlay
 * Built with HTML5 Web Audio API for zero-latency, cross-platform synthesized sound effects and rhythms.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.5;
  private loopInterval: number | null = null;

  constructor() {
    // Read user preference from localStorage if available
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('bidv_sound_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
      const savedVol = localStorage.getItem('bidv_sound_volume');
      if (savedVol !== null) {
        this.masterVolume = parseFloat(savedVol) || 0.5;
      }
      // Mobile user gesture unlock
      const unlockAudio = () => {
        this.initCtx();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bidv_sound_muted', String(muted));
    }
    if (muted) {
      this.stopLobbyMusic();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('bidv_sound_volume', String(this.masterVolume));
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  // Play a single synthesized tone with ADSR envelope
  private playTone(freq: number, type: OscillatorType, duration: number, gainVal: number = 0.2, delay: number = 0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    const targetGain = gainVal * this.masterVolume;
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // Lobby Groovy Ambient Loop
  public startLobbyMusic() {
    if (this.isMuted || this.loopInterval) return;
    this.initCtx();

    const chords = [
      [261.63, 329.63, 392.00], // C
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [196.00, 246.94, 293.66], // G
    ];
    let chordIdx = 0;

    this.loopInterval = window.setInterval(() => {
      if (this.isMuted) return;
      const chord = chords[chordIdx % chords.length];
      chord.forEach((freq, idx) => {
        this.playTone(freq, 'triangle', 0.8, 0.08, idx * 0.12);
      });
      // soft bass pulse
      this.playTone(chord[0] / 2, 'sine', 0.4, 0.12);
      chordIdx++;
    }, 1200);
  }

  public stopLobbyMusic() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  // Question Tick (Metronome with acceleration)
  public playTick(isLastFiveSecs: boolean = false) {
    if (this.isMuted) return;
    if (isLastFiveSecs) {
      // High urgent double ping
      this.playTone(880, 'sine', 0.08, 0.25);
      this.playTone(1174, 'sine', 0.08, 0.25, 0.1);
    } else {
      // Crisp subtle woodblock tick
      this.playTone(440, 'triangle', 0.06, 0.15);
    }
  }

  // Correct answer chime (Positive sparkling major chord)
  public playCorrect() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      this.playTone(freq, 'sine', 0.35, 0.2, index * 0.08);
    });
  }

  // Wrong answer tone (gentle buzzer)
  public playWrong() {
    if (this.isMuted) return;
    this.playTone(220, 'sawtooth', 0.3, 0.2);
    this.playTone(207.65, 'sawtooth', 0.4, 0.22, 0.12);
  }

  // Streak combo sound
  public playStreak() {
    if (this.isMuted) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.25, 0.25, idx * 0.06);
    });
  }

  // Final Podium Victory Fanfare
  public playPodiumFanfare() {
    if (this.isMuted) return;
    const fanfareNotes = [
      { f: 523.25, d: 0.15, t: 0 },
      { f: 523.25, d: 0.15, t: 0.15 },
      { f: 523.25, d: 0.15, t: 0.3 },
      { f: 659.25, d: 0.4, t: 0.45 },
      { f: 587.33, d: 0.2, t: 0.85 },
      { f: 659.25, d: 0.2, t: 1.05 },
      { f: 783.99, d: 0.7, t: 1.25 },
      { f: 1046.50, d: 1.0, t: 1.95 },
    ];
    fanfareNotes.forEach((note) => {
      this.playTone(note.f, 'triangle', note.d, 0.3, note.t);
      this.playTone(note.f * 1.5, 'sine', note.d, 0.15, note.t);
    });
  }
}

export const sound = new SoundEngine();
