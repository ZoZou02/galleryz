/**
 * 外星人模式管理
 * level0 头像右上角聊天气泡 → 每隔30s弹出👽气泡(5s后消失)
 * 点击👽进入外星人模式(配色变alien绿，排行榜独立)
 * 外星人模式下常驻🌍气泡，点击返回主模式
 */

// ========== 可调节参数 ==========
const ALIEN_BUBBLE_INTERVAL = 30000;   // 👽气泡弹出间隔(ms)
const ALIEN_BUBBLE_DURATION = 5000;    // 👽气泡显示时长(ms)
const ALIEN_BUBBLE_SIZE = 44;          // 气泡大小(px)

const ALIEN_RECORDS_KEY = 'gb_merge_records_alien';

export class AlienMode {
    constructor() {
        this._enabled = false;
        this._alienBubble = null;
        this._earthBubble = null;
        this._timerId = null;
        this._updatePosTimer = null;
    }

    init() {
        this._createBubbles();
        this._startAlienBubbleTimer();
        this._startPositionUpdater();
    }

    /** 创建👽和🌍两个聊天气泡（🌍初始隐藏） */
    _createBubbles() {
        const lv0 = this._findLevel0Avatar();
        if (!lv0) return;

        const parent = document.body;

        // 👽 外星人气泡（初始隐藏）
        this._alienBubble = this._makeBubble('👽', 'alien-bubble');
        this._alienBubble.style.display = 'none';
        this._alienBubble.addEventListener('click', (e) => {
            e.stopPropagation();
            this._enterAlienMode();
        });
        parent.appendChild(this._alienBubble);

        // 🌍 地球气泡（初始隐藏）
        this._earthBubble = this._makeBubble('🌍', 'earth-bubble');
        this._earthBubble.style.display = 'none';
        this._earthBubble.addEventListener('click', (e) => {
            e.stopPropagation();
            this._exitAlienMode();
        });
        parent.appendChild(this._earthBubble);

        this._updateBubblePositions();
    }

    /** 查找 level0 头像 DOM 元素 */
    _findLevel0Avatar() {
        const avatars = document.querySelectorAll('.entrance-avatar');
        for (const el of avatars) {
            if (el.dataset.level === '0') return el;
        }
        return null;
    }

    /** 创建一个聊天气泡元素 */
    _makeBubble(emoji, className) {
        const el = document.createElement('div');
        el.className = `alien-chat-bubble ${className}`;
        el.innerHTML = `
            <svg class="alien-bubble-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path d="M512 240c0 132.5-114.6 240-256 240-37.1 0-72.3-7.4-104.1-20.7L33.5 510.1c-9.4 4-20.2 1.7-27.1-5.8S-2 485.8 2.8 476.8l48.8-92.2C19.2 344.3 0 294.3 0 240 0 107.5 114.6 0 256 0S512 107.5 512 240z"/>
            </svg>
            <span class="alien-bubble-emoji">${emoji}</span>
        `;
        return el;
    }

    /** 更新气泡位置到 level0 头像右上角 */
    _updateBubblePositions() {
        const lv0 = this._findLevel0Avatar();
        if (!lv0) return;

        const rect = lv0.getBoundingClientRect();
        const size = ALIEN_BUBBLE_SIZE;
        const x = rect.right - size * 0.3;
        const y = rect.top - size * 0.7;

        const bubbles = [this._alienBubble, this._earthBubble];
        for (const b of bubbles) {
            if (!b) continue;
            b.style.left = `${x}px`;
            b.style.top = `${y}px`;
            b.style.width = `${size}px`;
            b.style.height = `${size}px`;
        }
    }

    /** 启动👽气泡定时器：每30s弹出一次，显示5s */
    _startAlienBubbleTimer() {
        this._stopAlienBubbleTimer();
        this._scheduleAlienBubble();
    }

    _scheduleAlienBubble() {
        this._timerId = setTimeout(() => {
            if (this._enabled) {
                this._scheduleAlienBubble();
                return;
            }
            this._showAlienBubble();
        }, ALIEN_BUBBLE_INTERVAL);
    }

    _stopAlienBubbleTimer() {
        if (this._timerId) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    }

    /** 显示👽气泡，5s后自动隐藏 */
    _showAlienBubble() {
        if (!this._alienBubble || this._enabled) return;
        this._updateBubblePositions();
        this._alienBubble.style.display = 'block';
        gsap.fromTo(this._alienBubble, { autoAlpha: 0, scale: 0.5 }, {
            autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(1.7)'
        });

        setTimeout(() => {
            if (this._alienBubble && this._alienBubble.style.display !== 'none') {
                gsap.to(this._alienBubble, {
                    autoAlpha: 0, scale: 0.5, duration: 0.3, ease: 'power2.in',
                    onComplete: () => {
                        if (this._alienBubble) this._alienBubble.style.display = 'none';
                    }
                });
            }
            if (!this._enabled) this._scheduleAlienBubble();
        }, ALIEN_BUBBLE_DURATION);
    }

    /** 进入外星人模式 */
    _enterAlienMode() {
        this._enabled = true;
        document.body.classList.add('alien-mode');

        // 播放 level0-1 音效
        import('./audio.js').then(({ soundManager }) => {
            soundManager.playVoice(0);
        });

        // 隐藏👽气泡
        if (this._alienBubble) {
            gsap.killTweensOf(this._alienBubble);
            this._alienBubble.style.display = 'none';
        }
        this._stopAlienBubbleTimer();

        // 显示🌍气泡
        if (this._earthBubble) {
            this._updateBubblePositions();
            this._earthBubble.style.display = 'block';
            gsap.fromTo(this._earthBubble, { autoAlpha: 0, scale: 0.5 }, {
                autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(1.7)'
            });
        }
    }

    /** 退出外星人模式，回到主模式 */
    _exitAlienMode() {
        this._enabled = false;
        document.body.classList.remove('alien-mode');

        // 隐藏🌍气泡
        if (this._earthBubble) {
            gsap.to(this._earthBubble, {
                autoAlpha: 0, scale: 0.5, duration: 0.3, ease: 'power2.in',
                onComplete: () => {
                    if (this._earthBubble) this._earthBubble.style.display = 'none';
                }
            });
        }

        // 重新启动👽气泡定时器
        this._startAlienBubbleTimer();
    }

    /** 启动位置更新轮询（监听窗口大小变化等） */
    _startPositionUpdater() {
        this._stopPositionUpdater();
        this._updatePosTimer = setInterval(() => this._updateBubblePositions(), 1000);
    }

    _stopPositionUpdater() {
        if (this._updatePosTimer) {
            clearInterval(this._updatePosTimer);
            this._updatePosTimer = null;
        }
    }

    /** 是否处于外星人模式 */
    isAlienMode() {
        return this._enabled;
    }

    /** 隐藏所有气泡（进入游戏时调用） */
    hideBubbles() {
        if (this._alienBubble) {
            gsap.killTweensOf(this._alienBubble);
            this._alienBubble.style.display = 'none';
        }
        if (this._earthBubble) {
            gsap.killTweensOf(this._earthBubble);
            this._earthBubble.style.display = 'none';
        }
        this._stopAlienBubbleTimer();
    }

    /** 显示当前模式对应的气泡（回到主页时调用） */
    showBubbles() {
        if (this._enabled) {
            if (this._earthBubble) {
                this._updateBubblePositions();
                this._earthBubble.style.display = 'block';
                gsap.set(this._earthBubble, { autoAlpha: 1, scale: 1 });
            }
        } else {
            this._startAlienBubbleTimer();
        }
    }

    /** 获取当前模式对应的记录存储键 */
    getRecordsKey() {
        return this._enabled ? ALIEN_RECORDS_KEY : null;
    }

    destroy() {
        this._stopAlienBubbleTimer();
        this._stopPositionUpdater();
        document.body.classList.remove('alien-mode');
        const bubbles = [this._alienBubble, this._earthBubble];
        for (const b of bubbles) {
            if (b && b.parentNode) b.remove();
        }
        this._alienBubble = null;
        this._earthBubble = null;
    }
}

export const alienMode = new AlienMode();