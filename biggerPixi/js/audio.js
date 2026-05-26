/**
 * 音频管理
 * Web Audio API 封装，音效播放和人声管理
 */

import { MERGE_AUDIO_CFG, VOICE_CFG } from './config.js';

class SoundManager {
    constructor() {
        this.ctx = null;
        this.buffers = {};
        this._voiceBufs = [];
        this._voiceDelay = 350;
        this._mergeVoiceTimerId = null;
        this._mergeMaxLevel = -1;
        this._mergeMaxBuf = null;

        this.sfxGain = null;
        this.musicGain = null;
        this.musicSource = null;
        this.musicBuffer = null;
        this._sfxVolume = 0.5;
        this._musicVolume = 0.5;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not available');
            return;
        }
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.ctx.destination);
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.gain.value = this._sfxVolume;
        this.musicGain.gain.value = this._musicVolume;
    }

    async load(name, url) {
        if (!this.ctx) return;
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(buf);
            this.buffers[name] = audioBuf;
        } catch (e) {
            console.warn('Failed to load audio:', name, url);
        }
    }

    play(name, opts = {}) {
        if (!this.ctx || !this.buffers[name]) return;
        this._playBuf(this.buffers[name], opts);
    }

    _playBuf(buf, opts = {}) {
        if (!this.ctx || !buf) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => this._startSource(buf, opts));
            return;
        }
        if (this.ctx.state !== 'running') return;
        this._startSource(buf, opts);
    }

    _startSource(buf, opts) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        const gain = this.ctx.createGain();
        source.connect(gain);
        gain.connect(this.sfxGain);

        const now = this.ctx.currentTime;
        const dur = opts.duration != null ? opts.duration : buf.duration;

        if (opts.pitchRamp) {
            source.playbackRate.setValueAtTime(opts.pitchRamp.from, now);
            source.playbackRate.linearRampToValueAtTime(opts.pitchRamp.to, now + dur);
        } else {
            source.playbackRate.value = opts.rate || 1;
        }

        if (opts.volumeRamp) {
            gain.gain.setValueAtTime(opts.volumeRamp.from, now);
            gain.gain.linearRampToValueAtTime(opts.volumeRamp.to, now + dur);
        } else {
            gain.gain.value = opts.volume != null ? opts.volume : 1;
        }

        source.start(now, 0, dur);
    }

    async _loadVoiceLevel(level) {
        if (!this._voiceBufs[level]) this._voiceBufs[level] = [];
        const count = VOICE_CFG.voiceVariants[level] || 0;
        const promises = [];
        for (let v = 0; v < count; v++) {
            const url = 'sound/level' + level + '/level' + level + '-' + v + '.mp3';
            promises.push(
                fetch(url)
                    .then(res => res.arrayBuffer())
                    .then(buf => this.ctx.decodeAudioData(buf))
                    .then(audioBuf => { this._voiceBufs[level][v] = audioBuf; })
                    .catch(() => {})
            );
        }
        await Promise.all(promises);
    }

    async loadVoiceConfig(config, onProgress) {
        VOICE_CFG.voiceVariants = config;
        if (!this.ctx) return;
        const promises = [];
        for (let i = 0; i < Object.keys(config).length; i++) {
            const count = config[i] || 0;
            if (count > 0) { 
                if (onProgress) onProgress(i);
                promises.push(this._loadVoiceLevel(i));
            }
        }
        await Promise.all(promises);
    }

    _pickVoice(level) {
        const bufs = this._voiceBufs[level];
        if (!bufs || bufs.length === 0) return null;
        const valid = bufs.filter(b => !!b);
        if (valid.length === 0) return null;
        return valid[Math.floor(Math.random() * valid.length)];
    }

    playDrop(level) {
        this.play('falling', { duration: 1 });
        if (Math.random() < VOICE_CFG.voiceChance) {
            setTimeout(() => {
                const buf = this._pickVoice(level);
                if (buf) this._playBuf(buf, { duration: 2.5 });
            }, this._voiceDelay);
        }
    }

    playMerge(newLevel) {
        const rate = MERGE_AUDIO_CFG.base_pitch + newLevel * MERGE_AUDIO_CFG.pitch_per_level;
        this.play('merge', { rate });

        if (newLevel >= 5 && newLevel > this._mergeMaxLevel) {
            const buf = this._pickVoice(newLevel);
            if (buf) {
                this._mergeMaxLevel = newLevel;
                this._mergeMaxBuf = buf;
            }
        }

        if (this._mergeVoiceTimerId) clearTimeout(this._mergeVoiceTimerId);
        this._mergeVoiceTimerId = setTimeout(() => {
            if (this._mergeMaxBuf) {
                this._playBuf(this._mergeMaxBuf, { rate: 1, duration: 3 });
            }
            this._mergeVoiceTimerId = null;
            this._mergeMaxLevel = -1;
            this._mergeMaxBuf = null;
        }, this._voiceDelay + 100);
    }

    playVoice(level) {
        const buf = this._pickVoice(level);
        if (buf) this._playBuf(buf, { duration: 2.5 });
    }

    playAlienVoice() {
        const bufs = this._voiceBufs[0];
        if (!bufs || bufs.length === 0) return;
        const buf = bufs[0];
        if (buf) this._playBuf(buf, { duration: 2.5 });
    }

    playButton() {
        this.play('button', { duration: 0.3 });
    }

    async loadBGM(url) {
        if (!this.ctx) return;
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            this.musicBuffer = await this.ctx.decodeAudioData(buf);
        } catch (e) {
            console.warn('Failed to load BGM:', url);
        }
    }

    startBGM() {
        if (!this.ctx || !this.musicBuffer) return;
        this.stopBGM();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => this._startBGMSource());
            return;
        }
        this._startBGMSource();
    }

    _startBGMSource() {
        if (!this.ctx || !this.musicBuffer || this.ctx.state !== 'running') return;
        this.musicSource = this.ctx.createBufferSource();
        this.musicSource.buffer = this.musicBuffer;
        this.musicSource.loop = true;
        this.musicSource.connect(this.musicGain);
        this.musicSource.start();
    }

    stopBGM() {
        if (this.musicSource) {
            try { this.musicSource.stop(); } catch (e) {}
            this.musicSource = null;
        }
    }

    setSfxVolume(v) {
        this._sfxVolume = v;
        if (this.sfxGain) this.sfxGain.gain.value = v;
    }

    setMusicVolume(v) {
        this._musicVolume = v;
        if (this.musicGain) this.musicGain.gain.value = v;
    }

    getSfxVolume() {
        return this._sfxVolume;
    }

    getMusicVolume() {
        return this._musicVolume;
    }

    reset() {
        if (this._mergeVoiceTimerId) clearTimeout(this._mergeVoiceTimerId);
        this._mergeVoiceTimerId = null;
        this._mergeMaxLevel = -1;
        this._mergeMaxBuf = null;
    }
}

export const soundManager = new SoundManager();