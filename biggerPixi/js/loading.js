/**
 * 加载页面管理器
 * Windows 风格旋转圆环 + 圆点间距波浪
 */
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
        this._total = 0;
        this._current = 0;
        this._hidden = false;
        this._startTime = 0;
    }

    init() {
        this._screen = document.getElementById('loading-screen');
        this._ring = this._screen.querySelector('.loading-ring');
        this._dotWraps = Array.from(this._screen.querySelectorAll('.loading-dot-wrap'));
        this._dots = Array.from(this._screen.querySelectorAll('.loading-dot'));
        this._progressFill = this._screen.querySelector('.loading-progress-fill');
        this._itemNameEl = this._screen.querySelector('.loading-item-name');
        this._counterEl = this._screen.querySelector('.loading-counter');

        this._startAnimation();
        this._startTime = performance.now();
    }

    _startAnimation() {
        if (this._rotTL) this._rotTL.kill();
        if (this._spacingTween) this._spacingTween.kill();

        // 旋转圆环
        this._rotTL = gsap.to(this._ring, {
            rotation: '+=360',
            duration: 2.0,
            repeat: -1,
            ease: 'none'
        });

        const CYCLE_DEG = 180;           // 每轮冲刺角度（度）
        const PAUSE_SEC = 0.8;           // 冲刺后停顿时间（秒）
        const SPRINTS = [0.4, 0.5, 0.6, 0.7, 0.8];  // 每个点的冲刺时间（秒），从前到后逐点变慢
        const PERIOD_SEC = SPRINTS[SPRINTS.length - 1] + PAUSE_SEC;  // 以最慢的点定周期
        const STAGGER_SEC = 0.1;         // 相邻圆点的出发间隔（秒）
        const STEPS = 300;               // 总冲刺轮数，足够覆盖加载过程

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
            { scale: 1, duration: 0.25, ease: 'back.out(2)', overwrite: 'auto' }
        );
    }

    _updateCounter() {
        this._counterEl.textContent = `${this._current}/${this._total}`;
    }

    _updateProgressBar() {
        const pct = this._total > 0 ? (this._current / this._total) * 100 : 0;
        gsap.to(this._progressFill, {
            width: `${pct}%`,
            duration: 0.35,
            ease: 'power2.out',
            overwrite: 'auto'
        });
    }

    hide() {
        if (this._hidden) return;
        this._hidden = true;

        const MIN_LOAD_TIME = 5000;
        const elapsed = performance.now() - this._startTime;
        const remaining = Math.max(0, MIN_LOAD_TIME - elapsed);

        const doHide = () => {
            if (this._rotTL) { this._rotTL.kill(); this._rotTL = null; }
            if (this._spacingTween) { this._spacingTween.kill(); this._spacingTween = null; }

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
        };

        if (remaining > 0) {
            setTimeout(doHide, remaining);
        } else {
            doHide();
        }
    }
}

export const loadingManager = new LoadingManager();