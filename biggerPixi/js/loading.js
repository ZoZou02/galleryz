/**
 * 加载页面管理器
 * 两阶段：进度加载 → 点击显示主菜单
 */
import { loadingBg } from './loadingBg.js';
import { soundManager } from './audio.js';

// ========== 可调节参数 ==========
const ANIM = {
    MIN_LOAD_TIME: 5000,
    RING_ROTATION_DURATION: 2.0,
    RING_CYCLE_DEG: 180,
    RING_PAUSE_SEC: 0.8,
    RING_SPRINTS: [0.4, 0.5, 0.6, 0.7, 0.8],
    RING_STAGGER_SEC: 0.1,
    RING_STEPS: 300,
    PROGRESS_DURATION: 0.35,
    DOT_SCALE_DURATION: 0.25,
    DOT_SCALE_EASE: 'back.out(2)',
    FADE_OUT_DURATION: 0.5,
    FADE_OUT_EASE: 'power2.in',
    FADE_OUT_STAGGER: 0.08,
    OVERLAY_FADE_DURATION: 0.6,
    TAP_HINT_DURATION: 0.5,
    TAP_HINT_INTERVAL: 1.5,
};

export class LoadingManager {
    constructor() {
        this._ring = null;
        this._dotWraps = [];
        this._dots = [];
        this._rotTL = null;
        this._spacingTween = null;
        this._progressFill = null;
        this._itemNameEl = null;
        this._counterEl = null;
        this._screen = null;
        this._container = null;
        this._tapHintEl = null;
        this._total = 0;
        this._current = 0;
        this._hidden = false;
        this._ready = false;
        this._startTime = 0;
        this._onReadyCallback = null;
        this._clickHandler = null;
    }

    init() {
        this._screen = document.getElementById('loading-screen');
        this._container = this._screen.querySelector('.loading-container');
        this._ring = this._screen.querySelector('.loading-ring');
        this._dotWraps = Array.from(this._screen.querySelectorAll('.loading-dot-wrap'));
        this._dots = Array.from(this._screen.querySelectorAll('.loading-dot'));
        this._progressFill = this._screen.querySelector('.loading-progress-fill');
        this._itemNameEl = this._screen.querySelector('.loading-item-name');
        this._counterEl = this._screen.querySelector('.loading-counter');

        this._startAnimation();
        this._startTime = performance.now();
    }

    onReady(callback) {
        this._onReadyCallback = callback;
    }

    _startAnimation() {
        if (this._rotTL) this._rotTL.kill();
        if (this._spacingTween) this._spacingTween.kill();

        this._rotTL = gsap.to(this._ring, {
            rotation: '+=360',
            duration: ANIM.RING_ROTATION_DURATION,
            repeat: -1,
            ease: 'none'
        });

        const CYCLE_DEG = ANIM.RING_CYCLE_DEG;
        const PAUSE_SEC = ANIM.RING_PAUSE_SEC;
        const SPRINTS = ANIM.RING_SPRINTS;
        const PERIOD_SEC = SPRINTS[SPRINTS.length - 1] + PAUSE_SEC;
        const STAGGER_SEC = ANIM.RING_STAGGER_SEC;
        const STEPS = ANIM.RING_STEPS;

        const tl = gsap.timeline();
        this._dotWraps.forEach((wrap, i) => {
            const baseDeg = [180, 144, 108, 72, 36][i];
            const sprint = SPRINTS[i];
            for (let s = 0; s < STEPS; s++) {
                const tSprint = s * PERIOD_SEC + i * STAGGER_SEC;
                tl.to(wrap, {
                    rotation: baseDeg + s * CYCLE_DEG,
                    duration: sprint,
                    ease: 'power2.in'
                }, tSprint);

                if (s < STEPS - 1) {
                    const tHold = tSprint + sprint;
                    tl.to(wrap, {
                        rotation: baseDeg + (s + 1) * CYCLE_DEG,
                        duration: PERIOD_SEC - sprint,
                        ease: 'none'
                    }, tHold);
                }
            }
        });
        this._spacingTween = tl;
    }

    setTotal(total) {
        this._total = total;
        this._current = 0;
        this._updateCounter();
    }

    tick(itemName) {
        if (this._hidden) return;
        this._current = Math.min(this._current + 1, this._total);
        this._itemNameEl.textContent = itemName;
        this._updateCounter();
        this._updateProgressBar();

        const dotIndex = (this._current - 1) % this._dots.length;
        const dot = this._dots[dotIndex];
        gsap.fromTo(dot,
            { scale: 1.5 },
            { scale: 1, duration: ANIM.DOT_SCALE_DURATION, ease: ANIM.DOT_SCALE_EASE, overwrite: 'auto' }
        );
    }

    _updateCounter() {
        this._counterEl.textContent = `${this._current}/${this._total}`;
    }

    _updateProgressBar() {
        const pct = this._total > 0 ? (this._current / this._total) * 100 : 0;
        gsap.to(this._progressFill, {
            width: `${pct}%`,
            duration: ANIM.PROGRESS_DURATION,
            ease: 'power2.out',
            overwrite: 'auto'
        });
    }

    showReady() {
        if (this._ready) return;
        this._ready = true;

        const elapsed = performance.now() - this._startTime;
        const remaining = Math.max(0, ANIM.MIN_LOAD_TIME - elapsed);

        const doShowReady = () => {
            if (this._rotTL) { this._rotTL.kill(); this._rotTL = null; }
            if (this._spacingTween) { this._spacingTween.kill(); this._spacingTween = null; }

            // 背景头像网格淡入 + 遮罩调低透明度
            loadingBg.fadeIn();
            loadingBg.fadeOverlay(0.8, ANIM.OVERLAY_FADE_DURATION);
            soundManager.startBGM();
            loadingBg.showContinueTextAndBg();

            // 加载内容逐个淡出
            const elements = [
                this._ring,
                this._screen.querySelector('.loading-progress-wrap'),
                this._screen.querySelector('.loading-info')
            ];
            gsap.to(elements, {
                autoAlpha: 0,
                duration: ANIM.FADE_OUT_DURATION,
                ease: ANIM.FADE_OUT_EASE,
                stagger: ANIM.FADE_OUT_STAGGER,
                onComplete: () => {
                    // 淡出完成后，点击页面触发主菜单显示
                    this._setupClickToReveal();
                }
            });
        };

        if (remaining > 0) {
            setTimeout(doShowReady, remaining);
        } else {
            doShowReady();
        }
    }

    /**
     * 点击后显示主菜单按钮
     * 为屏幕添加一次性点击监听，点击后触发 onReady 回调（由 main.js 处理显示主菜单）
     */
    _setupClickToReveal() {
        this._clickHandler = () => {
            this._screen.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
            if (this._onReadyCallback) {
                this._onReadyCallback();
            }
        };
        this._screen.addEventListener('click', this._clickHandler);
    }

    /**
     * 隐藏加载页面（过渡到游戏时调用）
     */
    hide() {
        if (this._hidden) return;
        this._hidden = true;

        if (this._rotTL) { this._rotTL.kill(); this._rotTL = null; }
        if (this._spacingTween) { this._spacingTween.kill(); this._spacingTween = null; }
        if (this._clickHandler) {
            this._screen.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }

        gsap.to(this._screen, {
            autoAlpha: 0,
            duration: 0.4,
            ease: 'power2.in',
            onComplete: () => {
                if (this._screen.parentNode) {
                    this._screen.parentNode.removeChild(this._screen);
                }
            }
        });
        loadingBg.hideContinueTextAndBg();
        soundManager.playButton();
    }
}

export const loadingManager = new LoadingManager();