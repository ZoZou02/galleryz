/**
 * 加载页面背景动画
 * 11列头像(0-10) + 随机基础图形间隔，棋盘错位 + 循环布局
 * 从下往上连续滚动 + 倾斜晃动
 */
const SHAPES = ['club', 'diamond', 'heart', 'spade'];

// ========== 扑克花色 SVG 路径（Path2D，保持原始 24×24 viewBox） ==========
const SHAPE_PATHS = {
    club: new Path2D("M13.775 11.04C14.933 9.266 16 7.632 16 6a4 4 0 0 0-8 0c0 1.633 1.067 3.267 2.225 5.04h.001l.234.359q-.433-.331-.808-.626C8.276 9.697 7.386 9 6 9a4 4 0 0 0 0 8c1.633 0 3.267-1.067 5.04-2.225l.03-.02c-.093 2.281-.958 3.683-1.913 5.23l-.369.602c-.384.636.087 1.413.83 1.413h4.764c.743 0 1.214-.777.83-1.413l-.369-.602c-.955-1.547-1.82-2.949-1.913-5.23l.03.02C14.734 15.933 16.368 17 18 17a4 4 0 0 0 0-8c-1.386 0-2.276.697-3.652 1.773q-.375.296-.808.626z"),
    diamond: new Path2D("M4.036 10.734l7.19-8.788a1 1 0 0 1 1.548 0l7.19 8.787a2 2 0 0 1 0 2.534l-7.19 8.787a1 1 0 0 1-1.548 0l-7.19-8.787a2 2 0 0 1 0-2.533"),
    heart: new Path2D("M2 8.5a5.5 5.5 0 0 1 10-3.163A5.5 5.5 0 0 1 22 8.5c0 7.5-10 12.985-10 12.985S2 16 2 8.5"),
    spade: new Path2D("M10.951 15.893A5.83 5.83 0 0 1 7.5 17C4.462 17 2 14.761 2 12c0-3.548 3.525-6.089 6.644-8.338C9.92 2.742 11.129 1.872 12 1c.871.871 2.08 1.742 3.356 2.662C18.476 5.911 22 8.452 22 12c0 2.761-2.462 5-5.5 5a5.83 5.83 0 0 1-3.451-1.107c.284 1.646 1.009 2.82 1.794 4.092l.369.602c.384.636-.087 1.413-.83 1.413H9.618c-.743 0-1.214-.777-.83-1.413l.369-.602c.785-1.272 1.51-2.446 1.794-4.092"),
};

// ========== 可调节动画参数 ==========
// ※ SCROLL_DURATION 是循环核心参数，修改后 cycleH / scrollT 均随之变化，直接影响循环流程
const SCROLL_DURATION = 30;    // [★循环关键] 头像网格滚动一整圈的时长(秒)，越大越慢
const SWAY_ANGLE = 3;          // 左右倾斜最大角度(度)，0-10 合适
const SWAY_DURATION = 10;       // 左右倾斜往复一次的时长(秒)，与滚动周期独立
const FADEIN_DURATION = 1;   // 头像网格首次淡入时长(秒)
const GAME_BLUR = 5;           // 游戏模式下头像模糊量(px)，0-10
const GAME_DARKEN = 0.50;      // 游戏模式下暗色遮罩透明度(0-1)，越大越暗
const GAME_MODE_DURATION = 0.5;// 进入/退出游戏模式过渡时长(秒)

export class LoadingBackground {
    constructor() {
        this._canvas = null;
        this._ctx = null;
        this._container = null;
        this._animFrameId = null;
        this._spritesheetImg = null;
        this._frameW = 0;
        this._frameH = 0;
        this._gridCycleH = 0;
        this._numCols = 11;
        this._shapeTypes = [];
        this._running = false;
        this._darkOverlay = null;
        this._animCurrentY = 0;
        this._animAbsTime = 0;
        this._animLastTime = 0;
        this._animPaused = false;
        this._forceLevel = -1;
    }

    async init(containerEl) {
        this._container = containerEl;

        this._canvas = document.createElement('canvas');
        this._canvas.id = 'loading-bg-canvas';
        this._ctx = this._canvas.getContext('2d');

        const overlay = document.createElement('div');
        overlay.id = 'loading-bg-overlay';

        this._darkOverlay = document.createElement('div');
        this._darkOverlay.id = 'loading-bg-dark-overlay';
        this._darkOverlay.style.opacity = '0';

        this._container.appendChild(this._canvas);
        this._container.appendChild(overlay);
        this._container.appendChild(this._darkOverlay);
    }

    async startWithSpritesheet(img, useLowRes = false) {
        this._spritesheetImg = img;
        this._frameW = img.width / 5;
        this._frameH = img.height / 11;
        this._useLowRes = useLowRes;

        this._animCurrentY = 0;
        this._animAbsTime = 0;
        this._generateShapeTypes();
        this._buildGrid();
        this._startAnimation();

        this._running = true;
    }

    _generateShapeTypes() {
        this._shapeTypes = [];
        for (let i = 0; i < this._numCols; i++) {
            this._shapeTypes.push(SHAPES[i % SHAPES.length]);
        }
    }

    _buildGrid() {
        const W = window.innerWidth;
        const H = window.innerHeight;

        const isPortrait = W < H; // 竖屏设备
        const cellScale = isPortrait ? 1.5 : 0.6; // 竖屏时放大头像
        const cellW = Math.ceil(W / this._numCols * cellScale);  // 每个单元格的宽度
        const cellH = cellW;
        let rowsNeeded = Math.ceil(H / cellH) + 2;
        if (rowsNeeded % 2 !== 0) rowsNeeded++; // 确保偶数，保证周期内容一致
        this._gridCycleH = rowsNeeded * cellH;

        const extraCols = 5;   // 额外的列数，用于循环布局
        const totalCols = this._numCols + extraCols * 2;
        const canvasW = totalCols * cellW;
        const offsetX = -extraCols * cellW + (W - this._numCols * cellW) / 2;   // 左右位置

        this._canvas.width = canvasW;
        this._canvas.height = this._gridCycleH * 5;
        this._canvas.style.width = canvasW + 'px';
        this._canvas.style.height = (this._gridCycleH * 5) + 'px';
        this._canvas.style.left = offsetX + 'px';
        this._canvas.style.position = 'absolute';
        this._canvas.style.top = '0';

        const ctx = this._ctx;
        const img = this._spritesheetImg;
        const fw = this._frameW;
        const fh = this._frameH;
        const padding = cellW * 0.15;
        const elSize = cellW - padding * 2;

        for (let viewCol = 0; viewCol < totalCols; viewCol++) {
            const colIdx = ((viewCol - extraCols) % this._numCols + this._numCols) % this._numCols;
            const fruitLevel = this._forceLevel >= 0 ? this._forceLevel : colIdx;
            const shapeType = this._shapeTypes[colIdx];
            const cx = viewCol * cellW;

            for (let row = 0; row < rowsNeeded * 5; row++) {
                const isFruit = (row + viewCol) % 2 === 0;
                const dx = cx + padding;
                const dy = row * cellH + (cellH - elSize) / 2;

                if (isFruit) {
                    const sx = 0;
                    const sy = fruitLevel * fh;
                    ctx.drawImage(img, sx, sy, fw, fh, dx, dy, elSize, elSize);
                } else {
                    this._drawShape(ctx, shapeType, cx + cellW / 2, row * cellH + cellH / 2, elSize * 0.3);
                }
            }
        }
    }

    _drawShape(ctx, type, cx, cy, r) {
        const path = SHAPE_PATHS[type];
        if (!path) return;

        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';

        // 将 24×24 viewBox 的 SVG 路径缩放并平移到目标位置
        ctx.translate(cx - r, cy - r);
        const s = (r * 2) / 24;
        ctx.scale(s, s);
        ctx.lineWidth = 2 / s; // 补偿缩放，保持实际线宽为 2px

        ctx.fill(path);
        ctx.stroke(path);
        ctx.restore();
    }

    _startAnimation() {
        this._stopAnimation();
        this._animPaused = false;

        this._canvas.style.transformOrigin = '50% 50%';

        const gridCycleH = this._gridCycleH;
        const speed = gridCycleH / SCROLL_DURATION; // px/s
        const cycleCount = 3; // 循环序列包含 3 个周期 (0→1→2→0)
        const maxScrollCycles = 3; // 滚动到第 3 个周期末尾（周期3=周期0）时重置

        this._animLastTime = performance.now();

        const tick = (now) => {
            if (!this._running) return;
            this._animFrameId = requestAnimationFrame(tick);

            const dt = Math.min((now - this._animLastTime) / 1000, 0.2); // 防大跳帧
            this._animLastTime = now;
            this._animAbsTime += dt;

            // y 持续累减，不取模 → 无 CSS 值跳变
            this._animCurrentY -= speed * dt;

            // 滚动到周期3（=周期0）时，重置回周期0起点，实现无缝循环
            if (this._animCurrentY <= -gridCycleH * maxScrollCycles) {
                this._animCurrentY += gridCycleH * cycleCount;
            }

            // 摆动：sin(2π * t / T)，用不取模的 absTime 保证连续
            const phase = (this._animAbsTime / SWAY_DURATION) * Math.PI * 2;
            const rotation = Math.sin(phase) * SWAY_ANGLE;

            this._canvas.style.transform =
                `translate3d(0, ${this._animCurrentY}px, 0) rotate(${rotation}deg)`;
        };

        this._animFrameId = requestAnimationFrame(tick);
    }

    _stopAnimation() {
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }
    }

    /** 暂停背景动画（页面失焦时调用），保留当前滚动状态 */
    pauseAnimation() {
        if (!this._running || this._animPaused) return;
        this._stopAnimation();
        this._animPaused = true;
    }

    /** 恢复背景动画（页面聚焦时调用），从暂停位置继续 */
    resumeAnimation() {
        if (!this._running || !this._animPaused || !this._spritesheetImg) return;
        this._animPaused = false;
        this._animLastTime = performance.now();
        this._startAnimation();
    }

    showContinueTextAndBg() {
        const t1 = gsap.timeline();

        this._container.querySelector('.loading-bg-coutinue-text').style.display = 'block';
        this._container.querySelector('.loading-bg-text-bg').style.display = 'block';
        this._container.querySelector('.loading-bg-text').style.display = 'block';

        t1.to(this._container.querySelector('.loading-bg-text-bg'), {
            width: '100vw',
            duration: 1,
            ease: 'power2.inOut'
        }).to(this._container.querySelector('.loading-bg-text'), {
            opacity: 1,
            duration: 1,
            ease: 'power1.inOut'
        }).to(this._container.querySelector('.loading-bg-coutinue-text'), {
            opacity: 1,
            duration: 1,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut'
        })
    }

    hideContinueTextAndBg() {
        const continueEl = this._container.querySelector('.loading-bg-coutinue-text');
        const textEl = this._container.querySelector('.loading-bg-text');
        const bgEl = this._container.querySelector('.loading-bg-text-bg');

        gsap.killTweensOf(continueEl);
        gsap.killTweensOf(textEl);
        gsap.killTweensOf(bgEl);

        gsap.to([continueEl, textEl, bgEl], {
            opacity: 0,
            duration: 0.2,
            ease: "power2.inOut",
            onComplete: () => {
                continueEl.style.display = "none";
                textEl.style.display = "none";
                bgEl.style.display = "none";
            }
        });
    }

    /**
     * 过渡衔接：标题从 scale 0.1 弹出在 continue 条上方
     * 在 showContinueTextAndBg 动画完成后调用
     */
    shrinkContinueAndShowTitle() {
        const menu = document.getElementById('main-menu');
        const mainTitle = menu.querySelector('.title-image');
        const startButtons = menu.querySelectorAll('.start-btn-main');
        const settingsBtn = document.getElementById('settings-btn');
        const sponsorBtn = document.getElementById('sponsor-btn');

        menu.classList.remove('hidden');
        menu.style.transition = 'none';

        // 计算标题从自然位置到屏幕中央的偏移
        const rect = mainTitle.getBoundingClientRect();
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const offsetX = cx - (rect.left + rect.width / 2);
        const offsetY = cy - (rect.top + rect.height / 2) - 100;

        // 标题定位到 continue 条上方，scale 0.1
        gsap.set(mainTitle, { x: offsetX, y: offsetY, scale: 0.1, autoAlpha: 0 });
        // 所有按钮隐藏（包括设置按钮、赞赏按钮）
        gsap.set(startButtons, { y: 250, autoAlpha: 0 });
        gsap.set(settingsBtn, { y: 250, autoAlpha: 0 });
        gsap.set(sponsorBtn, { y: 250, autoAlpha: 0 });

        // 标题从 scale 0.1 弹出
        gsap.to(mainTitle, {
            scale: 1,
            autoAlpha: 1,
            duration: 0.5,
            ease: 'back.out(1.7)'
        });
    }

    /**
     * 点击后的衔接动画：标题上移到最终位置，主页面按钮从屏幕下方冲上来
     * @param {Function} onComplete 动画完成后的回调
     */
    animateToMainMenu(onComplete) {
        const continueText = this._container.querySelector('.loading-bg-coutinue-text');
        const continueBg = this._container.querySelector('.loading-bg-text-bg');
        const loadingText = this._container.querySelector('.loading-bg-text');
        const menu = document.getElementById('main-menu');
        const mainTitle = menu.querySelector('.title-image');
        const startButtons = menu.querySelectorAll('.start-btn-main');
        const settingsBtn = document.getElementById('settings-btn');
        const sponsorBtn = document.getElementById('sponsor-btn');
        const allButtons = [...startButtons, settingsBtn, sponsorBtn];

        // 如果 main-menu 还是隐藏状态（用户过早点击），先显示
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            menu.style.transition = 'none';
            gsap.set(mainTitle, { x: 0, y: 0, scale: 1, autoAlpha: 1 });
            gsap.set(allButtons, { y: 0, autoAlpha: 1 });
            continueText.style.display = 'none';
            continueBg.style.display = 'none';
            loadingText.style.display = 'none';
            if (onComplete) onComplete();
            return;
        }

        const tl = gsap.timeline({
            onComplete: () => {
                continueText.style.display = 'none';
                continueBg.style.display = 'none';
                menu.style.transition = '';
                if (onComplete) onComplete();
            }
        });

        // continue 条淡出
        tl.to([continueBg, continueText, loadingText], {
            autoAlpha: 0,
            duration: 0.3,
            ease: 'power2.in'
        }, 0)
            // 标题上移到最终位置
            .to(mainTitle, {
                x: 0,
                y: 0,
                duration: 0.5,
                ease: 'power3.inOut'
            }, 0)
            // 按钮从下方冲上来（包括设置按钮）
            .to(allButtons, {
                y: 0,
                autoAlpha: 1,
                duration: 0.5,
                stagger: 0.08,
                ease: 'back.out(1)'
            }, '>-=0.15');
    }

    fadeIn() {
        gsap.to(this._canvas, {
            autoAlpha: 1,
            duration: FADEIN_DURATION,
            ease: 'power2.out'
        });
    }

    /**
     * 控制背景遮罩透明度
     * @param {number} opacity 目标透明度 (0-1)
     * @param {number} duration 动画时长(秒)
     */
    fadeOverlay(opacity, duration) {
        const overlay = this._container.querySelector('#loading-bg-overlay');
        if (!overlay) return;
        gsap.to(overlay, {
            opacity,
            duration: duration || 0.6,
            ease: 'power2.inOut'
        });
    }

    /**
     * 开始变黑（loading消失时同步调用）
     * @param {number} duration 动画时长(秒)
     */
    fadeToBlack(duration) {
        const overlay = this._container.querySelector('#loading-bg-overlay');
        if (overlay) {
            gsap.to(overlay, { background: '#000', opacity: 1, duration, ease: 'power2.in' });
        }
        gsap.to(this._canvas, { autoAlpha: 0, duration, ease: 'power2.in' });
    }

    enterGameMode() {
        this.hideEntranceAvatars();
        gsap.killTweensOf(this._canvas, 'filter');
        gsap.killTweensOf(this._darkOverlay);
        gsap.to(this._canvas, {
            filter: `blur(${GAME_BLUR}px)`,
            duration: GAME_MODE_DURATION,
            ease: 'power2.inOut'
        });
        if (this._darkOverlay) {
            gsap.to(this._darkOverlay, {
                opacity: GAME_DARKEN,
                duration: GAME_MODE_DURATION,
                ease: 'power2.inOut'
            });
        }
    }

    exitGameMode() {
        this.showEntranceAvatars();
        gsap.killTweensOf(this._canvas, 'filter');
        gsap.killTweensOf(this._darkOverlay);
        gsap.to(this._canvas, {
            filter: 'blur(0px)',
            duration: GAME_MODE_DURATION,
            ease: 'power2.inOut'
        });
        if (this._darkOverlay) {
            gsap.to(this._darkOverlay, {
                opacity: 0,
                duration: GAME_MODE_DURATION,
                ease: 'power2.inOut'
            });
        }
    }

    resize() {
        if (!this._running || !this._spritesheetImg) return;
        this._stopAnimation();
        this._animCurrentY = 0;
        this._animAbsTime = 0;
        this._buildGrid();
        this._startAnimation();
    }

    destroy() {
        this._stopAnimation();
        this.removeEntranceAvatars();
        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
        this._canvas = null;
        this._ctx = null;
        this._running = false;
    }

    /** 外星人模式：背景网格全部替换为 level0 头像 */
    setAlienBgGrid() {
        if (!this._running || !this._spritesheetImg) return;
        this._forceLevel = 0;
        this._stopAnimation();
        this._animCurrentY = 0;
        this._animAbsTime = 0;
        this._buildGrid();
        this._startAnimation();
    }

    /** 恢复普通模式背景网格 */
    restoreBgGrid() {
        if (!this._running || !this._spritesheetImg) return;
        this._forceLevel = -1;
        this._stopAnimation();
        this._animCurrentY = 0;
        this._animAbsTime = 0;
        this._buildGrid();
        this._startAnimation();
    }

    /** 外星人模式：入场头像全部替换为 level0 */
    setAlienEntranceAvatars() {
        if (!this._entranceAvatars) return;
        const fw = this._frameW;
        for (const el of this._entranceAvatars) {
            if (!el._origLevel) {
                el._origLevel = parseInt(el.dataset.level);
            }
            el.dataset.level = '0';
            el.style.backgroundPosition = `0px -0px`;
        }
    }

    /** 恢复入场头像原始等级 */
    restoreEntranceAvatars() {
        if (!this._entranceAvatars) return;
        const fh = this._frameH;
        for (const el of this._entranceAvatars) {
            const lv = el._origLevel != null ? el._origLevel : parseInt(el.dataset.level);
            el.dataset.level = String(lv);
            el.style.backgroundPosition = `0px -${lv * fh}px`;
            delete el._origLevel;
        }
    }

    // 启动入口头像动画
    // 1. 清理上一次的入口头像
    // 2. 计算目标位置
    // 3. 播放动画
    async startEntranceAnimation(onStartBGM) {
        if (!this._spritesheetImg || !this._container) return;

        this.removeEntranceAvatars();

        const W = window.innerWidth;
        const H = window.innerHeight;
        const fw = this._frameW;
        const fh = this._frameH;
        const img = this._spritesheetImg;
        const imgW = img.width;
        const imgH = img.height;

        // ==========================================
        //         所有可调节参数（手动调整区）
        // ==========================================

        // -- 精灵图缩放常量（影响所有距离和大小参数） --
        // this._useLowRes = true;
        const SPRITE_SCALE = this._useLowRes ? 0.25 : 1;             // 精灵图分辨率缩放比例
        const containerScale = this._useLowRes ? 4 : 1;
        console.log('this._useLowRes:', this._useLowRes, 'containerScale:', containerScale);

        // -- 基础间距 --
        const GAP = 32 * SPRITE_SCALE;
        const AVATAR_SCALE = 0.3;                                       // 单个头像缩放倍率（1.0=原始大小）
        const AVATAR_SCALE_SMALL = 0.25;
        const cellW = fw * AVATAR_SCALE - GAP;                          // 头像+间距宽度
        const cellFix = 164 * SPRITE_SCALE;

        // -- 容器动画 --
        const CONTAINER_SCALE = 0.25;                                   // 最终缩放比例
        const CONTAINER_DUR = 1.0;                                      // 缩放+下移时长
        const CONTAINER_EASE = 'power3.inOut';                          // 缓动
        const CONTAINER_BOTTOM_GAP = 0;                                     // 容器底部距屏幕底部的像素偏移（正值=上移）

        // -- 背景渐变 --
        const OVERLAY_COLOR = '#61a8c9';                                // 目标颜色
        const OVERLAY_DUR = 0.7;                                        // 渐变时长
        const OVERLAY_EASE = 'power2.inOut';                            // 缓动

        // -- 头像最终位置Y轴（容器内） --
        const BOTTOM_ROW_Y = H - fh / 2;                                // 底行：头像底部贴容器底部
        const TOP_ROW_Y = BOTTOM_ROW_Y - fh - GAP;                     // 顶行：底行上方

        // -- 所有头像参数（x: 容器内绝对坐标 / y: 行Y / rotation: 下落时旋转起始角度°） --
        const avatarParams = {
            10: { left: '50%', bottom: '0%', rotation: 0 },          //gb
            8: { left: '50%', bottom: '0%', rotation: 0, scale: 0.1 },           //yjfn
            9: { x: cellW, y: cellFix, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: -10, scale: AVATAR_SCALE },//lee
            7: { x: -cellW, y: cellFix, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: 10, scale: AVATAR_SCALE },//ump
            6: { x: -2 * cellW, y: cellFix, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: 5, scale: AVATAR_SCALE },//xzyy
            5: { x: 0.5 * cellW, y: cellFix - cellW + 16 * SPRITE_SCALE, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: -10, scale: AVATAR_SCALE },//mmc
            4: { x: -0.5 * cellW, y: cellFix - cellW + 12 * SPRITE_SCALE, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: 15, scale: AVATAR_SCALE_SMALL },//fld
            3: { x: 1.5 * cellW, y: cellFix - cellW + 16 * SPRITE_SCALE, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: -15, scale: AVATAR_SCALE_SMALL },//hwx
            2: { x: -1.5 * cellW, y: cellFix - cellW + 16 * SPRITE_SCALE, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: 15, scale: AVATAR_SCALE_SMALL },//kjk
            1: { x: -cellW - 12 * SPRITE_SCALE, y: cellFix - 2 * cellW + 48 * SPRITE_SCALE, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: -15, scale: 0.2 },//cs
            0: { x: cellW + 12 * SPRITE_SCALE, y: cellFix - 2 * cellW + 52 * SPRITE_SCALE, left: '50%', bottom: '200%', lastLeft: '50%', lastBottom: '0%', rotation: 15, scale: 0.2 },//wxr
        };

        // -- Level 10 淡入 --
        const L10_FADE_DUR = 3;                                       // 淡入时长（覆盖2次idle循环）
        const L10_FADE_EASE = 'power2.inOut';                           // 缓动

        // -- Level 8 专用动画参数 --
        const L8_FALL_START_Y = -fh;                                    // 下落起始（屏幕外）
        const L8_FALL_DUR = 0.3;                                        // 下落时长
        const L8_FALL_EASE = 'back.out(0.5)';                               // 下落缓动
        const L8_ROLL_DUR = 1.5;                                       // 滚动总时长
        const L8_ROLL_TOTAL_ROTATION = 375;                            // 滚动总旋转角度
        const L8_ROLL_PHASE1_RATIO = 0.45;                             // 第一阶段时间占比（右→下到level9）
        const L8_ROLL_PHASE2_RATIO = 0.55;                             // 第二阶段时间占比（右到最终位置）

        // -- 容器砸到瞬间效果参数 --
        const CONTAINER_IMPACT_SCALE_FROM = 1.5;                     // 砸到前容器scale
        const CONTAINER_IMPACT_SCALE_TO = 1.3;                       // 砸到后容器scale
        const CONTAINER_IMPACT_SCALE_DUR = 0.15;                     // 缩放时长
        const CONTAINER_IMPACT_SHAKE = 6 * SPRITE_SCALE;                            // 抖动幅度(px)
        const CONTAINER_IMPACT_SHAKE_DUR = 0.04;                     // 单次抖动时长

        // -- 其余头像下落通用参数 --
        const OTHER_FALL_START_Y = -fh;                                 // 起始Y（屏幕外）
        const OTHER_FALL_DUR = 0.2;                                    // 下落时长
        const OTHER_FALL_EASE = 'back.out(0.3)';                           // 下落缓动（前慢后快）
        const OTHER_STAGGER = 0.1;                                      // 交错间隔

        // ========== 游戏idle循环参数 ==========
        const IDLE_SEQUENCE = [0, 1, 2, 3, 1, 0];
        const IDLE_FRAME_MS = 50;
        const IDLE_LOOP_DELAY = 800;
        const IDLE_ACTIVE_MS = IDLE_SEQUENCE.length * IDLE_FRAME_MS;
        const IDLE_CYCLE_MS = IDLE_ACTIVE_MS + IDLE_LOOP_DELAY;

        // ========== 头像容器 ==========
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'entrance-avatar-container';
        avatarContainer.style.cssText = [
            'position:fixed;left:0%;bottom:40%;',
            `width:100vw;height:100vh;`,
            'pointer-events:none;z-index:4;'
        ].join('');
        gsap.set(avatarContainer, { transformOrigin: '50% 100%', scale: 1.5 * containerScale });
        this._container.appendChild(avatarContainer);
        this._entranceContainer = avatarContainer;

        return new Promise((resolve) => {
            const overlay = this._container.querySelector('#loading-bg-overlay');

            // 背景变黑已在 loading.js showReady 中同步启动

            const idleEls = [];
            let idleAnimId = null;

            const tickIdle = (now) => {
                for (const el of idleEls) {
                    const elapsed = now - el._idleStartTime;
                    const cycleTime = elapsed % IDLE_CYCLE_MS;
                    let frame;
                    if (cycleTime < IDLE_ACTIVE_MS) {
                        frame = IDLE_SEQUENCE[Math.floor(cycleTime / IDLE_FRAME_MS)];
                    } else {
                        frame = 0;
                    }
                    el.style.backgroundPosition = `-${frame * fw}px -${parseInt(el.dataset.level) * fh}px`;
                }
                idleAnimId = requestAnimationFrame(tickIdle);
            };

            const startIdle = () => {
                idleAnimId = requestAnimationFrame(tickIdle);
            };

            const stopIdle = () => {
                if (idleAnimId) { cancelAnimationFrame(idleAnimId); idleAnimId = null; }
            };

            const createAvatar = (level) => {
                const el = document.createElement('div');
                el.className = 'entrance-avatar';
                el.dataset.level = String(level);
                el._idleStartTime = 0;
                el.style.cssText = [
                    'position:absolute;left:0%;bottom:0%;',
                    `width:${fw}px;height:${fh}px;`,
                    `background-image:url(${img.src});`,
                    `background-size:${imgW}px ${imgH}px;`,
                    `background-position:0px -${level * fh}px;`,
                    'image-rendering:pixelated;',
                    'z-index:4;pointer-events:none;',
                    'transform-origin:center center;',
                    `transform:scale(${AVATAR_SCALE});`,
                    'visibility:hidden;'
                ].join('');
                avatarContainer.appendChild(el);
                return el;
            };

            const avatars = {};
            for (let lv = 0; lv <= 10; lv++) {
                avatars[lv] = createAvatar(lv);
            }

            startIdle();

            const tl = gsap.timeline({
                id: 'entrance',
                onComplete: () => {
                    stopIdle();
                    for (const el of Object.values(avatars)) {
                        const level = parseInt(el.dataset.level);
                        el.style.backgroundPosition = `0px -${level * fh}px`;
                    }
                    this._entranceAvatars = Object.values(avatars);
                    resolve();
                }
            });

            // GSDevTools.create({ animation: tl });

            // ===== Level 10: 始终位于容器底部中央，淡入 =====
            tl.set(avatars[10], { x: 0, y: `+=${cellFix}`, left: '50%', bottom: '0%', xPercent: -50, autoAlpha: 0 });
            tl.to(avatars[10], {
                autoAlpha: 1, duration: L10_FADE_DUR, ease: L10_FADE_EASE,
                onStart: () => {
                    avatars[10]._idleStartTime = performance.now();
                    idleEls.push(avatars[10]);
                    if (onStartBGM) onStartBGM();
                },
                onComplete: stopIdle
            });

            // B1. Level 8 — 从Level10正上方下落，转一圈，落地后向右滚动一个头像直径
            const L8_IMPACT = L8_FALL_DUR;                              // 砸到时间点（相对于'enter'）
            const L8_ROLL_START = L8_IMPACT + CONTAINER_IMPACT_SCALE_DUR; // 滚动起始（容器impact后）

            tl.set(avatars[8], { x: 0, y: 0, left: '50%', bottom: '0%', xPercent: -50, autoAlpha: 0 });
            tl.fromTo(avatars[8], {
                x: 0, y: 0, left: '50%', bottom: '100%', autoAlpha: 0, rotation: 0
            }, {
                x: 0, y: 38 * SPRITE_SCALE, left: '50%', bottom: '0%', autoAlpha: 1, rotation: 0,
                duration: L8_FALL_DUR, ease: L8_FALL_EASE
            }, 'enter');

            // 8 砸到瞬间：容器抖动 + scale + level8 切换 hit 动画帧
            const CS = CONTAINER_IMPACT_SHAKE;
            const CSD = CONTAINER_IMPACT_SHAKE_DUR;
            const HIT_DUR = 500;                                        // hit 动画持续时间（同游戏内）
            const HIT_FRAME = 4;                                        // hit 帧索引（第5帧）
            tl.to(avatarContainer, { x: CS, duration: CSD }, `enter+=${L8_IMPACT - 0.1}`);
            tl.to(avatarContainer, { x: -CS, duration: CSD }, `enter+=${L8_IMPACT - 0.1 + CSD}`);
            tl.to(avatarContainer, { x: 0, duration: CSD }, `enter+=${L8_IMPACT - 0.1 + CSD * 2}`);
            tl.to(avatarContainer, { scale: 1.0 * containerScale, duration: CONTAINER_IMPACT_SCALE_DUR, ease: 'power2.out' }, `enter+=${L8_IMPACT - 0.1}`);
            // level8 切换到 hit 帧
            tl.call(() => {
                avatars[8].style.backgroundPosition = `-${HIT_FRAME * fw}px -${8 * fh}px`;
            }, null, `enter+=${L8_IMPACT - 0.1}`);
            // level10 也切换到 hit 帧
            tl.call(() => {
                avatars[10].style.backgroundPosition = `-${HIT_FRAME * fw}px -${10 * fh}px`;
            }, null, `enter+=${L8_IMPACT - 0.1}`);
            // hit 结束后切回第1帧
            tl.call(() => {
                avatars[8].style.backgroundPosition = `0px -${8 * fh}px`;
                avatars[10].style.backgroundPosition = `0px -${10 * fh}px`;
            }, null, `enter+=${L8_IMPACT - 0.1 + HIT_DUR / 1000}`);

            // 向右滚动（两阶段 motion path）
            // 第一阶段：向右下滚到 level9 位置；第二阶段：向右滚到 level8 最终位置
            // rotation 通过 onUpdate 实时同步 x 位移比例，模拟真实滚动
            const L8_FINAL_X = cellW + 128 * SPRITE_SCALE;
            const L8_FINAL_Y = cellFix;
            const L9_MID_X = cellW;
            const PHASE1_DUR = L8_ROLL_DUR * L8_ROLL_PHASE1_RATIO;
            const PHASE2_DUR = L8_ROLL_DUR * L8_ROLL_PHASE2_RATIO;

            tl.to(avatars[8], {
                x: L9_MID_X, y: L8_FINAL_Y,
                duration: PHASE1_DUR, ease: 'power3.in',
                onUpdate: () => {
                    const dx = gsap.getProperty(avatars[8], 'x');
                    gsap.set(avatars[8], { rotation: (dx / L8_FINAL_X) * L8_ROLL_TOTAL_ROTATION });
                }
            }, `enter+=${L8_ROLL_START}`);

            // 背景渐变
            tl.to(overlay, { background: OVERLAY_COLOR, duration: OVERLAY_DUR, ease: OVERLAY_EASE }, 'enter');

            tl.to(avatars[8], {
                x: L8_FINAL_X,
                duration: PHASE2_DUR, ease: 'power2.out',
                onUpdate: () => {
                    const dx = gsap.getProperty(avatars[8], 'x');
                    gsap.set(avatars[8], { rotation: (dx / L8_FINAL_X) * L8_ROLL_TOTAL_ROTATION });
                }
            }, `enter+=${L8_ROLL_START + PHASE1_DUR}`);

            // ===== 两个并行动画：A.容器缩放+下移 / B.头像下落 =====
            tl.addLabel('enter', '+=0.3');

            // A. 容器向底部移动（scale在impact时处理）
            tl.to(avatarContainer, {
                bottom: '0%',
                left: '0%',
                duration: CONTAINER_DUR,
                ease: CONTAINER_EASE
            }, 'enter');


            // 容器继续缩放到最终大小
            tl.to(avatarContainer, {
                scale: 0.7 * containerScale,
                duration: CONTAINER_DUR,
                ease: CONTAINER_EASE
            }, `enter`);

            // B2. 其余头像依次从屏幕外下落（x固定不变，旋转角度各自可调）
            const otherLevels = [7, 6, 9, 5, 4, 3, 2, 1, 0];
            otherLevels.forEach((lv, i) => {
                const pos = avatarParams[lv];
                const stagger = i * OTHER_STAGGER;

                tl.fromTo(avatars[lv], {
                    x: pos.x,
                    y: pos.y,
                    left: pos.left,
                    bottom: pos.bottom,
                    xPercent: -50,
                    autoAlpha: 0,
                    rotation: 0,
                    scale: pos.scale
                }, {
                    x: pos.x,
                    y: pos.y,
                    left: pos.lastLeft,
                    bottom: pos.lastBottom,
                    xPercent: -50,
                    autoAlpha: 1,
                    rotation: pos.rotation,
                    duration: OTHER_FALL_DUR,
                    ease: OTHER_FALL_EASE,
                    scale: pos.scale
                }, `enter+=${stagger}`);
            });
        });
    }

    /** 隐藏入口头像（进入游戏模式时调用） */
    hideEntranceAvatars() {
        if (this._entranceContainer) {
            gsap.to(this._entranceContainer, {
                autoAlpha: 0,
                duration: 0.2,
                ease: 'power2.inOut'
            });
        }
    }

    /** 显示入口头像（回到主页面时调用） */
    showEntranceAvatars() {
        if (this._entranceContainer) {
            gsap.to(this._entranceContainer, {
                autoAlpha: 1,
                duration: 0.2,
                ease: 'power2.inOut'
            });
        }
    }

    /** 移除入口动画残留头像（彻底清理） */
    removeEntranceAvatars() {
        if (this._entranceAvatars) {
            for (const el of this._entranceAvatars) {
                if (el.parentNode) el.remove();
            }
            this._entranceAvatars = null;
        }
        if (this._entranceContainer) {
            this._entranceContainer.remove();
            this._entranceContainer = null;
        }
    }
}

export const loadingBg = new LoadingBackground();