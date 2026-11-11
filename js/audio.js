// Web Audio로 만드는 소리: 빗소리, 장작 타는 소리, 책장 넘기는 소리, 시냇물, 새 · 풀벌레, 골골송, 야옹 + 배경 음악
import { CONFIG } from './config.js';

// 필사 연필 소리 종류 (config.js 의 pencil 로 고름)
// density: 1초에 종이 결 '톡' 수 · tau: 톡 하나가 사그라드는 시간(ms) · grit: 톡의 거칠기 · hiss: 옅은 마찰음
// stroke: 한 획 길이(ms) · shape: 속도 곡선 뾰족함 · curve: 굽은 획 비율 · per: 글자당 획 수 · gap/charGap: 쉬는 틈(ms)
// hp · lp: 낮은 · 높은 소리 자르기(Hz) · peak/peakGain: 몸통 소리 · vol: 크기 · jitter: 획마다 빠르기 흔들림
export const PENCILS = {
  hb:     { name: '연필 HB · 기본',      density: 2600, tau: 0.35, grit: 1.6, hiss: 0.10, stroke: [70, 150],  shape: 0.8, curve: 0.35, per: [2, 3], gap: [10, 30], charGap: [25, 55], hp: 700,  lp: 5200, peak: 2400, peakGain: 3, vol: 1.0,  jitter: 0.25 },
  soft4b: { name: '부드러운 4B 연필',    density: 4200, tau: 0.6,  grit: 0.9, hiss: 0.18, stroke: [100, 210], shape: 0.6, curve: 0.45, per: [2, 3], gap: [15, 35], charGap: [35, 70], hp: 380,  lp: 2900, peak: 1300, peakGain: 4, vol: 1.0,  jitter: 0.2 },
  coarse: { name: '서걱서걱 · 거친 종이', density: 900,  tau: 0.9,  grit: 3.0, hiss: 0.04, stroke: [80, 170],  shape: 0.7, curve: 0.3,  per: [2, 3], gap: [12, 30], charGap: [30, 60], hp: 550,  lp: 4200, peak: 1800, peakGain: 5, vol: 1.05, jitter: 0.3 },
  sharp:  { name: '가는 샤프',           density: 1500, tau: 0.22, grit: 1.2, hiss: 0.06, stroke: [45, 100],  shape: 1.0, curve: 0.25, per: [2, 4], gap: [8, 22],  charGap: [20, 45], hp: 1400, lp: 6500, peak: 3200, peakGain: 2, vol: 0.75, jitter: 0.3 },
  asmr:   { name: '아주 작게 · 속삭이듯', density: 3200, tau: 0.5,  grit: 1.0, hiss: 0.14, stroke: [90, 190],  shape: 0.6, curve: 0.4,  per: [2, 3], gap: [15, 35], charGap: [35, 70], hp: 300,  lp: 3600, peak: 900,  peakGain: 5, vol: 0.5,  jitter: 0.2 },
  // 녹음한 연필 소리 (audio/pencil-strokes.mp3: 연필로 쓴 녹음을 획 하나씩 잘라 0.12초 틈을 두고 이어 붙인 것). 못 불러오면 fallback 종류로
  real:   { name: '녹음 연필 · 사각사각', file: 'audio/pencil-strokes.mp3', fallback: 'fountain', two: 0.3, gap: [10, 30], charGap: [20, 50], vol: 1.2, jitter: 0.12 },
  fountain: { name: '만년필 · 사르륵',   density: 300,  tau: 0.4,  grit: 0.5, hiss: 0.55, stroke: [90, 220],  shape: 0.5, curve: 0.5,  per: [1, 2], gap: [20, 45], charGap: [40, 80], hp: 900,  lp: 3400, peak: 2000, peakGain: 6, vol: 0.7,  jitter: 0.15 },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.night = 0;
    this.outdoor = false;
    this.rain = false;
    this.focus = 0;
    this.penVol = 0.16;   // 연필 소리 크기 (배경 위로 은은하게)
    this.pencil = CONFIG.pencil || 'hb';
    this.musicOn = true;
    this.sfxOn = true;    // 효과음 · 주변 소리 (🔊)
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // 큰 소리(폭죽 · 장작)가 찢어지지 않게 마지막에 살짝 눌러 줌
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 6; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.2;
    this.master.connect(this.limiter).connect(ctx.destination);
    // 효과음(필기 · 책장 · 야옹 · 폭죽 …)은 배경 소리보다 또렷하게 한 단계 크게
    // 효과음 · 주변 소리(장작 · 비 · 새 · 물 · 골골송)는 모두 이 통로(sfx)를 지나 master 로 — 🔊 단추가 이 통로만 끄고 켬.
    // 배경 음악은 이 통로를 거치지 않아 🎵 단추로 따로
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
    this.fxOut = ctx.createGain(); this.fxOut.gain.value = 2.2; this.fxOut.connect(this.sfx);

    // 노이즈 버퍼 (핑크 · 브라운)
    const len = ctx.sampleRate * 3;
    const pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    {
      const p = pink.getChannelData(0), b = brown.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        last = (last + 0.02 * w) / 1.02; b[i] = last * 3.5;
      }
      // 끊김 없이 이어지도록 끝을 부드럽게
      for (let i = 0; i < 2000; i++) { const k = i / 2000; p[len - 1 - i] *= k; b[len - 1 - i] *= k; p[i] *= k; b[i] *= k; }
    }
    this.pinkBuf = pink;
    this.brownBuf = brown;

    // 빗소리
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0; this.rainGain.connect(this.sfx);
    this.natureGain = ctx.createGain(); this.natureGain.gain.value = 0; this.natureGain.connect(this.sfx);
    const rain = this.loop(pink);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    rain.connect(hp).connect(lp).connect(this.rainGain);
    // 장작 (낮은 웅웅 + 탁탁)
    this.fireGain = ctx.createGain(); this.fireGain.gain.value = 0.35; this.fireGain.connect(this.sfx);
    const rumble = this.loop(brown);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 320;
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(flp).connect(rg).connect(this.fireGain);

    // 바깥 모닥불 · 화로 (가까이 가면 들림, 불 세기만큼)
    this.campGain = ctx.createGain(); this.campGain.gain.value = 0; this.campGain.connect(this.sfx);
    this.campFire = 0;
    const rumble2 = this.loop(brown);
    const clp = ctx.createBiquadFilter(); clp.type = 'lowpass'; clp.frequency.value = 520;
    rumble2.connect(clp).connect(this.campGain);
    this.crackGain = ctx.createGain(); this.crackGain.gain.value = 0; this.crackGain.connect(this.sfx);

    // 시냇물 (가까이 가면 들림)
    this.waterGain = ctx.createGain(); this.waterGain.gain.value = 0; this.waterGain.connect(this.sfx);
    const water = this.loop(pink);
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 900; wbp.Q.value = 0.7;
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.35;
    const wlg = ctx.createGain(); wlg.gain.value = 300;
    wlfo.connect(wlg).connect(wbp.frequency); wlfo.start();
    water.connect(wbp).connect(this.waterGain);
    this.water = 0;
    // 파도 (바닷가 가까이)
    this.seaGain = ctx.createGain(); this.seaGain.gain.value = 0; this.seaGain.connect(this.sfx);
    const sea = this.loop(brown);
    const slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 700;
    const swell = ctx.createGain(); swell.gain.value = 0.5;
    const slfo = ctx.createOscillator(); slfo.frequency.value = 0.11;
    const slg = ctx.createGain(); slg.gain.value = 0.45;
    slfo.connect(slg).connect(swell.gain); slfo.start();
    sea.connect(slp).connect(swell).connect(this.seaGain);
    this.sea = 0;
    // 폭포 (가까이 가면 우르르)
    this.fallGain = ctx.createGain(); this.fallGain.gain.value = 0; this.fallGain.connect(this.sfx);
    const fall = this.loop(pink);
    const flp2 = ctx.createBiquadFilter(); flp2.type = 'lowpass'; flp2.frequency.value = 1800;
    fall.connect(flp2).connect(this.fallGain);
    this.fall = 0;

    this.purrGain = ctx.createGain(); this.purrGain.gain.value = 0; this.purrGain.connect(this.sfx);
    this.purrUntil = 0;
    this.tick = setInterval(() => this.schedule(), 60);
    this.setupMusic();
    this.mix();
  }

  loop(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(0, Math.random() * 2);
    return s;
  }

  // 빗방울 · 장작 탁탁 · 골골송 스케줄링
  schedule() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // 새 (낮 · 정원 · 맑은 날) / 풀벌레 (밤 · 정원)
    if (this.outdoor && !this.rain && this.night < 0.5 && Math.random() < 0.035) this.bird(now + Math.random() * 0.05);
    if (this.outdoor && this.night >= 0.5 && Math.random() < 0.12) this.cricket(now);
    // 빗방울 톡톡
    for (let i = 0; i < 2; i++) if (this.rain && Math.random() < 0.55) this.click(now + Math.random() * 0.06, 2500 + Math.random() * 3500, 0.015 + Math.random() * 0.03, 0.012, this.rainGain);
    // 장작 탁탁 (실내에서만 또렷하게)
    if (!this.outdoor && Math.random() < 0.09 + this.night * 0.08) {
      const burst = Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0; i < burst; i++) this.click(now + i * (0.02 + Math.random() * 0.05), 900 + Math.random() * 2200, 0.12 + Math.random() * 0.25, 0.02 + Math.random() * 0.03, this.fireGain);
    }
    // 바깥 불 탁탁 (가까울수록 · 불이 셀수록 자주)
    if (this.campFire > 0.03 && Math.random() < 0.05 + this.campFire * 0.22) {
      const burst = Math.random() < 0.2 + this.campFire * 0.2 ? 2 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0; i < burst; i++) this.click(now + i * (0.02 + Math.random() * 0.06), 800 + Math.random() * 2400, 0.1 + Math.random() * 0.25, 0.02 + Math.random() * 0.03, this.crackGain);
    }
    // 다른 손님이 책장 넘기는 소리 (실내, 아주 가끔)
    if (!this.outdoor && Math.random() < 0.004) this.pageTurn(0.35);
    // 골골송
    if (now < this.purrUntil) {
      if (!this.purrNext || this.purrNext < now) this.purrNext = now;
      while (this.purrNext < now + 0.2) {
        this.purrBreath(this.purrNext);
        this.purrNext += 1.25 + Math.random() * 0.2;
      }
    }
  }

  click(t, freq, gain, dur, dest) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(t, Math.random() * 2, dur + 0.02);
  }

  // 들숨 · 날숨 한 번 (25Hz 안팎으로 진동하는 낮은 소리)
  purrBreath(t) {
    const ctx = this.ctx;
    for (const [off, dur, rate, amp] of [[0, 0.55, 27, 0.5], [0.6, 0.6, 23, 0.8]]) {
      const src = ctx.createBufferSource();
      src.buffer = this.brownBuf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = rate;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(am.gain);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + off);
      env.gain.linearRampToValueAtTime(amp, t + off + dur * 0.3);
      env.gain.linearRampToValueAtTime(amp * 0.8, t + off + dur * 0.7);
      env.gain.linearRampToValueAtTime(0, t + off + dur);
      const body = ctx.createOscillator(); body.type = 'triangle'; body.frequency.value = rate * 2;
      const bodyG = ctx.createGain(); bodyG.gain.value = 0.25;
      body.connect(bodyG).connect(am);
      src.connect(lp).connect(am).connect(env).connect(this.purrGain);
      src.start(t + off, Math.random() * 2, dur + 0.05);
      lfo.start(t + off); lfo.stop(t + off + dur + 0.05);
      body.start(t + off); body.stop(t + off + dur + 0.05);
    }
  }

  // 책장 넘기는 소리: 종이가 스치는 짧은 쉬익 + 끝에 톡
  pageTurn(vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(1800, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + 0.22);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.36);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.05);
    g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    src.connect(bp).connect(g).connect(this.fxOut);
    src.start(t, Math.random() * 2, 0.45);
    this.click(t + 0.38, 2400, 0.08 * vol, 0.03, this.fxOut);
  }

  setSea(v) {
    if (!this.ctx) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - this.sea) < 0.03) return;
    this.sea = v;
    this.seaGain.gain.setTargetAtTime(v * 0.8, this.ctx.currentTime, 0.6);
  }
  setFall(v) {
    if (!this.ctx) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - this.fall) < 0.03) return;
    this.fall = v;
    this.fallGain.gain.setTargetAtTime(v * 0.7, this.ctx.currentTime, 0.5);
  }
  // 책이 떨어지는 툭 소리
  thud() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.click(t, 180, 0.5, 0.09, this.fxOut);
    this.click(t + 0.02, 600, 0.2, 0.05, this.fxOut);
  }

  // 바깥 불 소리 크기 (0~1): 가까운 불 · 불 세기 · 불멍 중이면 더 크게
  setCampFire(v) {
    if (!this.ctx) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - this.campFire) < 0.02) return;
    this.campFire = v;
    const now = this.ctx.currentTime;
    this.campGain.gain.setTargetAtTime(v * 0.55, now, 0.5);
    this.crackGain.gain.setTargetAtTime(v * 0.9, now, 0.3);
  }
  // 장작이 날아가는 휙
  whoosh() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource(); src.buffer = this.pinkBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.35); bp.frequency.exponentialRampToValueAtTime(600, t + 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 0.65);
    src.connect(bp).connect(g).connect(this.fxOut);
    src.start(t, Math.random() * 2); src.stop(t + 0.7);
  }
  // 장작이 불에 툭 + 불길이 화르르 + 타닥타닥
  logIn(vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.click(t, 130, 0.6 * vol, 0.12, this.fxOut);
    this.click(t + 0.015, 420, 0.25 * vol, 0.06, this.fxOut);
    const src = ctx.createBufferSource(); src.buffer = this.brownBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1600, t + 0.25); lp.frequency.linearRampToValueAtTime(500, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1.5);
    src.connect(lp).connect(g).connect(this.fxOut);
    src.start(t, Math.random()); src.stop(t + 1.6);
    for (let i = 0; i < 9; i++) this.click(t + 0.15 + i * (0.06 + Math.random() * 0.1), 900 + Math.random() * 2600, (0.15 + Math.random() * 0.3) * vol, 0.02 + Math.random() * 0.03, this.fxOut);
  }

  setWater(v) {
    if (!this.ctx) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - this.water) < 0.03) return;
    this.water = v;
    this.waterGain.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.5);
  }

  purr(sec = 4) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.purrUntil = Math.max(this.purrUntil, now + sec);
    this.purrGain.gain.cancelScheduledValues(now);
    this.purrGain.gain.setTargetAtTime(0.9, now, 0.2);
    this.purrGain.gain.setTargetAtTime(0, now + sec, 0.4);
  }

  meow() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.18);
    o.frequency.linearRampToValueAtTime(600, t + 0.45);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
    f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1500, t + 0.2); f1.frequency.linearRampToValueAtTime(900, t + 0.45);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.06);
    g.gain.linearRampToValueAtTime(0.25, t + 0.3);
    g.gain.linearRampToValueAtTime(0, t + 0.5);
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o.connect(f1).connect(g);
    o.connect(f2).connect(g2).connect(g);
    g.connect(this.fxOut);
    o.start(t); o.stop(t + 0.55);
  }

  // 강아지 왈! (짧고 높게, n번)
  yip(n = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + 0.02 + i * 0.2 + Math.random() * 0.03;
      const f0 = 640 + Math.random() * 120;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.7, t + 0.04);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.13);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(1400, t); f.frequency.linearRampToValueAtTime(2100, t + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.32 * (this.outdoor ? 1 : 0.45), t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(f).connect(g).connect(this.fxOut);
      o.start(t); o.stop(t + 0.17);
    }
  }

  // 연필 획 소리 재료 (처음 한 번, 고른 종류로 열 가지 획을 만들어 둠)
  // 진짜 연필 소리 = 종이 결에 흑연이 걸리는 아주 작은 '톡'들이 촘촘히 이어진 것(알갱이) + 옅은 마찰 쉬익.
  // 한 획 안에서 손이 빨라졌다 느려지는 만큼 소리도 커졌다 작아짐 (속도 곡선, 굽은 획은 두 번 부풂)
  pencilBufs() {
    const P0 = PENCILS[this.pencil] || PENCILS.hb;
    const key = P0.file ? P0.fallback : this.pencil;   // 녹음 연필은 받는 동안 · 실패했을 때 이 합성 소리로
    const P = PENCILS[key];
    if (this._pencil && this._pencilKey === key) return this._pencil;
    const ctx = this.ctx, sr = ctx.sampleRate, out = [];
    for (let v = 0; v < 10; v++) {
      const dur = (P.stroke[0] + Math.random() * (P.stroke[1] - P.stroke[0])) / 1000;
      const n = Math.floor(sr * dur);
      const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
      const decay = Math.exp(-1 / (sr * P.tau / 1000));
      const hump2 = Math.random() < P.curve;
      let g = 0, rms = 0, smooth = 0;
      const sk = 1 - Math.exp(-2 * Math.PI * 9000 / sr);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // 손 속도: 들어가며 빨라지고 끝에서 느려짐 (굽은 획은 가운데서 한 번 느려짐)
        let vel = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** P.shape;
        if (hump2) vel *= 0.55 + 0.45 * Math.abs(Math.cos(Math.PI * t * 1.6));
        // 알갱이: 속도가 빠를수록 촘촘
        if (Math.random() < (P.density * (0.3 + vel)) / sr) g += 0.4 + Math.random() ** 2 * P.grit;
        g *= decay;
        const w = Math.random() * 2 - 1;
        smooth += (w - smooth) * sk;
        d[i] = smooth * (P.hiss + g) * vel;
        rms += d[i] * d[i];
      }
      rms = Math.sqrt(rms / n) || 1;
      for (let i = 0; i < n; i++) d[i] *= 0.12 / rms;
      out.push(b);
    }
    this._pencilKey = key;
    return (this._pencil = out);
  }

  // 연필 소리: 글자 하나에 두세 획. 빨리 써도 소리가 겹쳐 쌓이지 않게 차례로 이어 붙임
  pen(n = 1) {
    if (!this.enabled || !this.ctx) return;
    const P0 = PENCILS[this.pencil] || PENCILS.hb;
    if (P0.file && this.realPencil(P0)) { this.penReal(n, P0); return; }
    const P = P0.file ? PENCILS[P0.fallback] : P0;
    const ctx = this.ctx, bufs = this.pencilBufs();
    const now = ctx.currentTime;
    let t = Math.max(now + 0.005, this.penUntil || 0);
    if (t > now + 0.5) return;   // 너무 밀리면 건너뜀
    for (let c = 0; c < n; c++) {
      const strokes = P.per[0] + Math.floor(Math.random() * (P.per[1] - P.per[0] + 1));
      for (let k = 0; k < strokes; k++) {
        const b = bufs[Math.floor(Math.random() * bufs.length)];
        const src = ctx.createBufferSource(); src.buffer = b;
        src.playbackRate.value = 1 + (Math.random() - 0.5) * P.jitter;
        const low = ctx.createBiquadFilter(); low.type = 'highpass'; low.frequency.value = P.hp; low.Q.value = 0.6;
        const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = P.peak * (0.85 + Math.random() * 0.3); body.Q.value = 0.8; body.gain.value = P.peakGain;
        const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = P.lp; soft.Q.value = 0.55;
        const g = ctx.createGain(); g.gain.value = (0.8 + Math.random() * 0.35) * P.vol * this.penVol;
        src.connect(low).connect(body).connect(soft).connect(g).connect(this.fxOut);
        src.start(t);
        t += b.duration / src.playbackRate.value + (P.gap[0] + Math.random() * (P.gap[1] - P.gap[0])) / 1000;
      }
      t += (P.charGap[0] + Math.random() * (P.charGap[1] - P.charGap[0])) / 1000;
    }
    this.penUntil = t;
  }
  // 녹음 연필: 처음 한 번 받아 조용한 틈(0.06초 넘게)을 기준으로 획 하나씩 나눠 둠. 받는 동안 · 실패하면 null (합성 소리로)
  realPencil(P) {
    if (this._real) return this._real;
    if (this._realLoading || this._realFailed) return null;
    this._realLoading = true;
    fetch(P.file).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((ok, no) => this.ctx.decodeAudioData(ab, ok, no)))
      .then((buf) => {
        const d = buf.getChannelData(0), sr = buf.sampleRate, gap = Math.floor(sr * 0.06), out = [];
        let start = -1, last = -1;
        const cut = (a, b) => {
          const pad = Math.floor(sr * 0.004), s0 = Math.max(0, a - pad), e0 = Math.min(d.length, b + pad);
          if (e0 - s0 < sr * 0.04) return;
          const nb = this.ctx.createBuffer(1, e0 - s0, sr); nb.copyToChannel(d.slice(s0, e0), 0); out.push(nb);
        };
        for (let i = 0; i < d.length; i++) {
          if (Math.abs(d[i]) > 0.004) { if (start < 0) start = i; last = i; }
          else if (start >= 0 && i - last > gap) { cut(start, last); start = -1; }
        }
        if (start >= 0) cut(start, last);
        if (out.length) this._real = out; else this._realFailed = true;
      })
      .catch((e) => { console.warn('연필 녹음을 못 불러와 합성 소리로 써요', e); this._realFailed = true; })
      .finally(() => { this._realLoading = false; });
    return null;
  }
  // 녹음 연필 소리: 글자 하나에 획 하나(가끔 둘). 빨리 써도 겹쳐 쌓이지 않게 차례로
  penReal(n, P) {
    const ctx = this.ctx, bufs = this._real, now = ctx.currentTime;
    let t = Math.max(now + 0.005, this.penUntil || 0);
    if (t > now + 0.5) return;
    for (let c = 0; c < n; c++) {
      const strokes = Math.random() < P.two ? 2 : 1;
      for (let k = 0; k < strokes; k++) {
        let i = Math.floor(Math.random() * bufs.length);
        if (i === this._lastStroke) i = (i + 1) % bufs.length;   // 같은 획이 연달아 나오지 않게
        this._lastStroke = i;
        const src = ctx.createBufferSource(); src.buffer = bufs[i];
        src.playbackRate.value = 1 + (Math.random() - 0.5) * P.jitter;
        const low = ctx.createBiquadFilter(); low.type = 'highpass'; low.frequency.value = 160; low.Q.value = 0.6;
        const g = ctx.createGain(); g.gain.value = (0.8 + Math.random() * 0.35) * P.vol * this.penVol;
        src.connect(low).connect(g).connect(this.fxOut);
        src.start(t);
        t += bufs[i].duration / src.playbackRate.value + (P.gap[0] + Math.random() * (P.gap[1] - P.gap[0])) / 1000;
      }
      t += (P.charGap[0] + Math.random() * (P.charGap[1] - P.charGap[0])) / 1000;
    }
    this.penUntil = t;
  }
  // 마침표 · 쉼표: 연필 끝을 종이에 콕
  penDot() {
    if (!this.enabled || !this.ctx) return;
    const P0 = PENCILS[this.pencil] || PENCILS.hb;
    const real = P0.file ? this.realPencil(P0) : null;
    const P = P0.file ? { ...PENCILS[P0.fallback], vol: real ? P0.vol : PENCILS[P0.fallback].vol } : P0;
    const ctx = this.ctx, b = real ? real[0] : this.pencilBufs()[0];
    const t = Math.max(ctx.currentTime + 0.005, this.penUntil || 0);
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = 1.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(P.lp, 2600);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(2.2 * P.vol * this.penVol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(lp).connect(g).connect(this.fxOut);
    src.start(t); src.stop(t + 0.06);
    this.penUntil = t + 0.08;
  }
  // 필사 · 불멍 · 별멍처럼 한곳에 마음 두는 동안 배경 소리를 낮춤 (0 = 평소, 1 = 많이 낮춤)
  setFocus(k) {
    this.focus = k; this.mix();
    const P = PENCILS[this.pencil];
    if (k && P?.file && this.ctx) this.realPencil(P);   // 필사를 시작할 때 녹음 연필을 미리 받아 둠
  }

  // 목공방 소리 (임시 — 나중에 후보를 들려 드리고 고름). kind: plane 대패 · saw 톱 · sand 사포 · chisel 끌
  wood(kind, vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const noise = (dur, f0, f1, q, peak, type = 'bandpass', buf = this.pinkBuf, a = 0.04) => {
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f1, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak * vol, t + a); g.gain.setValueAtTime(peak * vol * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(f).connect(lp).connect(g).connect(this.fxOut);
      src.start(t, Math.random() * 2, dur + 0.05);
    };
    if (kind === 'plane') { noise(0.85, 1800, 1300, 0.9, 0.28, 'bandpass', this.pinkBuf, 0.12); this.click(t + 0.86, 700, 0.12 * vol, 0.05, this.fxOut); }
    else if (kind === 'saw') { const up = Math.random() < 0.5; noise(0.42, up ? 2200 : 1700, up ? 2600 : 1500, 1.6, 0.22, 'bandpass', this.pinkBuf, 0.05); }
    else if (kind === 'sand') noise(0.42, 2600, 2300, 0.6, 0.12, 'bandpass', this.pinkBuf, 0.1);
    else if (kind === 'nail') { this.click(t, 1900, 0.5 * vol, 0.05, this.fxOut); this.click(t + 0.004, 420, 0.55 * vol, 0.1, this.fxOut); noise(0.08, 3200, 2600, 2.5, 0.06, 'bandpass', this.pinkBuf, 0.005); }   // 망치로 못 — 임시 (목공 소리 고를 때 같이)
    else if (kind === 'chisel') { this.click(t, 260, 0.6 * vol, 0.09, this.fxOut); this.click(t + 0.01, 1400, 0.25 * vol, 0.04, this.fxOut); noise(0.12, 2400, 1800, 1.2, 0.08, 'bandpass', this.pinkBuf, 0.01); }
  }

  // 아기 고양이 야옹 (작고 높게)
  mew() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1350, t + 0.12); o.frequency.linearRampToValueAtTime(1000, t + 0.3);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.04); g.gain.linearRampToValueAtTime(0, t + 0.34);
    o.connect(f).connect(g).connect(this.fxOut);
    o.start(t); o.stop(t + 0.36);
  }
  // 폭죽: 휘이익 올라가는 소리
  fwLaunch(vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(2400, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 1.5);
    o.connect(g).connect(this.fxOut); o.start(t); o.stop(t + 1.55);
    const src = ctx.createBufferSource(); src.buffer = this.pinkBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.08 * vol, t); g2.gain.linearRampToValueAtTime(0, t + 1.2);
    src.connect(hp).connect(g2).connect(this.fxOut); src.start(t, Math.random()); src.stop(t + 1.3);
  }
  // 폭죽: 펑 (낮고 길게 울림)
  fwBoom(vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.brownBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.1 * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    src.connect(lp).connect(g).connect(this.fxOut); src.start(t, Math.random()); src.stop(t + 2.1);
    this.click(t, 90, 0.9 * vol, 0.25, this.fxOut);
  }
  // 폭죽: 타다다닥 (버드나무 · 별)
  fwCrackle(vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 26; i++) this.click(t + Math.random() * 1.4, 1800 + Math.random() * 3500, (0.06 + Math.random() * 0.12) * vol, 0.015, this.fxOut);
  }
  // 불꽃막대 지글지글
  sizzle(sec = 40) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.pinkBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.3); g.gain.setValueAtTime(0.07, t + sec - 1); g.gain.linearRampToValueAtTime(0, t + sec);
    src.connect(hp).connect(g).connect(this.fxOut); src.start(t); src.stop(t + sec + 0.1);
  }

  crunch() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.click(t + i * 0.16 + Math.random() * 0.04, 1800 + Math.random() * 1500, 0.25, 0.05, this.fxOut);
  }

  // 새 지저귐: 짧게 위아래로 미끄러지는 높은 음 몇 개
  bird(t) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const g = ctx.createGain();
      const st = t + i * (0.09 + Math.random() * 0.05), d = 0.06 + Math.random() * 0.05;
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), st);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), st + d * 0.5);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, st + d);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.05, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + d);
      o.connect(g).connect(this.natureGain);
      o.start(st); o.stop(st + d + 0.02);
    }
  }

  // 풀벌레: 높은 음을 빠르게 끊어서
  cricket(t) {
    const ctx = this.ctx;
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.045;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.018, st + 0.008);
      g.gain.linearRampToValueAtTime(0, st + 0.03);
      o.connect(g).connect(this.natureGain);
      o.start(st); o.stop(st + 0.035);
    }
  }

  // ---------- 배경 음악 (낮 · 밤 두 곡을 엇갈려 켜기) ----------
  setupMusic() {
    const m = CONFIG.music;
    if (!m) return;
    this.music = {};
    for (const k of ['day', 'night']) {
      if (!m[k]) continue;
      const el = new Audio();
      el.src = m[k];
      el.loop = true;
      el.preload = 'none';
      el.crossOrigin = 'anonymous';
      el.addEventListener('error', () => { this.music[k] = null; });
      const g = this.ctx.createGain();
      g.gain.value = 0;
      try { this.ctx.createMediaElementSource(el).connect(g).connect(this.master); } catch { continue; }
      this.music[k] = { el, g, playing: false };
    }
  }

  mix() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const n = this.night;
    const duck = 1 - (this.focus || 0) * 0.7;
    this.fireGain.gain.setTargetAtTime((this.outdoor ? 0.05 : 0.3 + n * 0.45) * duck, now, 0.6);
    this.rainGain.gain.setTargetAtTime((this.rain ? (this.outdoor ? 0.75 : 0.4) : 0) * duck, now, 0.8);
    this.natureGain.gain.setTargetAtTime((this.outdoor ? 1 : 0.15) * duck, now, 0.8);
    const vol = (CONFIG.music?.volume ?? 0.35) * duck;
    for (const [k, w] of [['day', 1 - n], ['night', n]]) {
      const mu = this.music?.[k];
      if (!mu) continue;
      const v = this.enabled && this.musicOn ? vol * w : 0;
      mu.g.gain.setTargetAtTime(v, now, 1.2);
      if (v > 0.001 && !mu.playing) { mu.playing = true; mu.el.play().catch(() => { mu.playing = false; }); }
      if (v <= 0.001 && mu.playing) {
        clearTimeout(mu.stopT);
        mu.stopT = setTimeout(() => { if (mu.g.gain.value < 0.01) { mu.el.pause(); mu.playing = false; } }, 5000);
      }
    }
  }

  setNight(n) { this.night = n; this.mix(); }
  // 배경 음악만 켜고 끄기 (다른 소리는 그대로)
  setMusic(on) { this.musicOn = !!on; this.mix(); }
  // 효과음 · 주변 소리만 켜고 끄기 (배경 음악은 그대로)
  setSfx(on) {
    this.sfxOn = !!on;
    if (this.ctx) { const now = this.ctx.currentTime; this.sfx.gain.cancelScheduledValues(now); this.sfx.gain.setTargetAtTime(on ? 1 : 0, now, 0.25); }
  }
  setOutdoor(o) { if (o === this.outdoor) return; this.outdoor = o; this.mix(); }
  setRain(on) { this.rain = on; this.mix(); }

  // 아이폰에서 소리를 살리는 일 — 화면을 누를 때마다 부름 (가벼움)
  // 1) 무음(진동) 스위치: 웹 오디오는 무음 모드면 소리가 안 남 → 「재생」 오디오로 바꿔 무음 스위치와 상관없이 들리게
  //    (iOS 17 이상은 navigator.audioSession, 그 아래는 소리 없는 audio 를 같이 틀어 두는 방법)
  // 2) 잠금 화면 · 다른 앱 · 전화로 멈춘(suspended · interrupted) 소리를 다시 켬
  unlock() {
    if (!this.enabled || !this.ctx) return;
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* 무시 */ }
    if (!this.silentEl) {
      const rate = 8000, n = rate / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      el.loop = true; el.setAttribute('playsinline', ''); el.preload = 'auto';
      this.silentEl = el;
    }
    if (this.silentEl.paused) this.silentEl.play().catch(() => {});
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.ensure();
    if (!this.ctx) return false;
    this.enabled = on;
    if (on) this.unlock();
    else this.silentEl?.pause();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, now, 0.4);
    this.mix();
    return true;
  }
}
