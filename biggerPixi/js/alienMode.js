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

// 外星人模式文本映射：selector -> { normal: 原文, alien: 外星人模式文本 }
const ALIEN_TEXT_MAP = [
    { selector: '#start-btn', normal: '开始游戏', alien: '閞ㄝ蝣戱' },
    { selector: '#records-btn', normal: '本地排行', alien: '夲哋棑洐' },
    { selector: '#about-btn', normal: '关于游戏', alien: '関チ遊戲' },
    { selector: '#game-over-modal h1', normal: '游戏结束', alien: '蝣戲糹吉娕' },
    { selector: '#pause-screen h1', normal: '游戏暂停', alien: '蝣戲暫諪' },
    { selector: '#records-screen h1', normal: '本地排行', alien: '夲哋棑洐' },
    { selector: '#about-screen h1', normal: '关于游戏', alien: '関チ遊戲' },
    { selector: '#settings-screen h1', normal: '设置', alien: '蔎寘' },
    { selector: '#sponsor-screen h1', normal: '支持', alien: '偅踺镓園' },
    { selector: '#restart-btn', normal: '再来一局', alien: '侢麳嬄梮' },
    { selector: '#resume-btn', normal: '继续游戏', alien: '繼續氵斿戲' },
    { selector: '#pause-restart-btn', normal: '重新开始', alien: '褈噺鬦ㄝ台' },
    { selector: '#quit-btn-1', normal: '结束游戏', alien: '詰涑氵斿戲' },
    { selector: '#quit-btn-2', normal: '返回主页', alien: '仮囘宔頁' },
    { selector: '#close-records-btn', normal: '返回', alien: '仮囘' },
    { selector: '#close-about-btn', normal: '返回', alien: '仮冋' },
    { selector: '#close-settings-btn', normal: '返回', alien: '仮迴' },
    { selector: '#close-sponsor-btn', normal: '返回', alien: '仮囙' },
    { selector: '.records-footer', normal: '*分数仅保存在本地', alien: '*忿數僅ィ呆洊菑夲土也' },
    // 游戏结束弹窗统计标签
    { selector: '#game-stats .stat-row:nth-child(1) .stat-label', normal: '游戏时间', alien: '蝣戲蒔簡' },
    { selector: '#game-stats .stat-row:nth-child(2) .stat-label', normal: '分数名次', alien: '鈖數茗絘' },
    { selector: '#game-stats .stat-row:nth-child(3) .stat-label', normal: '最高记录', alien: '蕞鎬汜淥' },
    { selector: '#game-stats .stat-row:nth-child(4) .stat-label', normal: 'GB数量', alien: '👽' },
    // modal-stamp 印章文字
    { selector: '#game-over-modal .modal-stamp', normal: 'GAME OVER', alien: 'ɡαмＥ ○∨ёя' },
    { selector: '#pause-screen .modal-stamp', normal: 'PAUSE', alien: 'ㄗáǚＳΣ' },
    { selector: '#records-screen .modal-stamp', normal: 'RECORDS', alien: 'яΣ℃○яDＳ' },
    { selector: '#about-screen .modal-stamp', normal: 'ABOUT', alien: 'αｂ○ǚㄒ' },
    { selector: '#settings-screen .modal-stamp', normal: 'SETTINGS', alien: 'ＳΣTTīⓃgＳ' },
    { selector: '#sponsor-screen .modal-stamp', normal: 'SPONSOR', alien: 'Ｓ卩○иＳ○я' },
    // 排行榜表头
    { selector: '#records-table thead th:nth-child(1)', normal: '排名', alien: '棑洺' },
    { selector: '#records-table thead th:nth-child(2)', normal: '分数', alien: '忿數' },
    { selector: '#records-table thead th:nth-child(3)', normal: '时长', alien: '時長' },
    // 赞助页面文字
    { selector: '#sponsor-screen .footer-section-content:nth-child(4)', normal: '如果这个游戏让你感到开心', alien: '铷惈適嗰遊戱讓沵憾菿閞杺' },
    { selector: '#sponsor-screen .footer-section-content:nth-child(5)', normal: '我就很满足了😊', alien: '莪僦詪慲娖孒👽' },
    { selector: '#sponsor-screen .footer-section-content:nth-child(6)', normal: '如果你愿意的话', alien: '铷惈沵蒝嬑哋話' },
    { selector: '#sponsor-screen .footer-section-content:nth-child(7)', normal: '可以请我吃个TACO🌮', alien: '埥幫ィ莪褈踺傢園🚀' },
    // 设置/暂停页面的音效/音乐标签
    { selector: '#settings-screen .setting-row:nth-child(1) .setting-label', normal: '音效', alien: '堷楽' },
    { selector: '#settings-screen .setting-row:nth-child(2) .setting-label', normal: '音乐', alien: '諳田' },
    { selector: '#pause-screen .setting-row:nth-child(1) .setting-label', normal: '音效', alien: '堷楽' },
    { selector: '#pause-screen .setting-row:nth-child(2) .setting-label', normal: '音乐', alien: '諳滧' },
];

export class AlienMode {
    constructor() {
        this._enabled = false;
        this._alienBubble = null;
        this._earthBubble = null;
        this._timerId = null;
        this._hideTimerId = null;
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
        if (this._hideTimerId) {
            clearTimeout(this._hideTimerId);
            this._hideTimerId = null;
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

        this._hideTimerId = setTimeout(() => {
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
        this._applyAlienTexts();

        // 播放 level0-1 音效
        import('./audio.js').then(({ soundManager }) => {
            soundManager.playVoice(0);
        });

        // 背景网格 + 入场头像全部替换为 level0
        import('./loadingBg.js').then(({ loadingBg }) => {
            loadingBg.setAlienBgGrid();
            loadingBg.setAlienEntranceAvatars();
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
        this._restoreNormalTexts();

        // 恢复背景网格 + 入场头像
        import('./loadingBg.js').then(({ loadingBg }) => {
            loadingBg.restoreBgGrid();
            loadingBg.restoreEntranceAvatars();
        });

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

    /** 应用外星人模式文本 */
    _applyAlienTexts() {
        for (const item of ALIEN_TEXT_MAP) {
            const els = document.querySelectorAll(item.selector);
            for (const el of els) {
                if (el && el.textContent === item.normal) {
                    el.textContent = item.alien;
                }
            }
        }
    }

    /** 恢复普通模式文本 */
    _restoreNormalTexts() {
        for (const item of ALIEN_TEXT_MAP) {
            const els = document.querySelectorAll(item.selector);
            for (const el of els) {
                if (el && el.textContent === item.alien) {
                    el.textContent = item.normal;
                }
            }
        }
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