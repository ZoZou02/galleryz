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
const SWAY_ANGLE = 3;          // 左右倾斜最大角度(度)，0-10 合适，不影响循环
const SWAY_DURATION = 10;       // 左右倾斜往复一次的时长(秒)，与滚动周期独立，不影响循环
const FADEIN_DURATION = 0.8;   // 头像网格首次淡入时长(秒)，不影响循环
const GAME_BLUR = 3;           // 游戏模式下头像模糊量(px)，0-10，不影响循环
const GAME_DARKEN = 0.35;      // 游戏模式下暗色遮罩透明度(0-1)，越大越暗，不影响循环
const GAME_MODE_DURATION = 0.5;// 进入/退出游戏模式过渡时长(秒)，不影响循环

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

    async startWithSpritesheet(img) {
        this._spritesheetImg = img;
        this._frameW = img.width / 5;
        this._frameH = img.height / 11;

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
            const fruitLevel = colIdx;
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

        t1.to(this._container.querySelector('.loading-bg-text-bg'), {
            width: '100vw',
            duration: 1,
            ease: 'power2.inOut'
        })
            .to(this._container.querySelector('.loading-bg-coutinue-text'), {
                opacity: 1,
                duration: 1,
                repeat: -1,
                yoyo: true,
                ease: 'power1.inOut'
            })
    }

    hideContinueTextAndBg() {
        gsap.killTweensOf(this._container.querySelector('.loading-bg-coutinue-text'));
        gsap.killTweensOf(this._container.querySelector('.loading-bg-text-bg'));
        gsap.to([".loading-bg-coutinue-text", ".loading-bg-text-bg"], {
            opacity: 0,
            duration: 0.2,
            ease: "power2.inOut",
            onComplete: () => {
                document.querySelector(".loading-bg-coutinue-text").style.display = "none";
                document.querySelector(".loading-bg-text-bg").style.display = "none";
            }
        });
    }

    fadeIn() {
        gsap.to(this._canvas, {
            autoAlpha: 1,
            duration: FADEIN_DURATION,
            ease: 'power2.inOut'
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

    enterGameMode() {
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
        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
        this._canvas = null;
        this._ctx = null;
        this._running = false;
    }
}

export const loadingBg = new LoadingBackground();