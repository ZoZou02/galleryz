/**
 * 加载页面背景动画
 * 11列头像(0-10) + 随机基础图形间隔，棋盘错位 + 循环布局
 * 从下往上连续滚动 + 倾斜晃动
 */
const SHAPES = ['club', 'diamond', 'heart', 'spade'];

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

        const cellW = Math.ceil(W / this._numCols * 0.6);  // 每个单元格的宽度
        const cellH = cellW;
        const rowsNeeded = Math.ceil(H / cellH) + 2;
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
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;

        ctx.beginPath();

        switch (type) {
            case 'square':
                ctx.roundRect(cx - r, cy - r, r * 2, r * 2, 4);
                break;
            case 'triangle': {
                const h = r * 1.6;
                ctx.moveTo(cx, cy - h);
                ctx.lineTo(cx + r * 1.4, cy + h * 0.5);
                ctx.lineTo(cx - r * 1.4, cy + h * 0.5);
                ctx.closePath();
                break;
            }
            case 'diamond':
                ctx.moveTo(cx, cy - r);
                ctx.lineTo(cx + r, cy);
                ctx.lineTo(cx, cy + r);
                ctx.lineTo(cx - r, cy);
                ctx.closePath();
                break;
            case 'cross': {
                const armW = r * 0.45;
                const armH = r * 1.1;
                ctx.moveTo(cx - armW, cy - armH);
                ctx.lineTo(cx + armW, cy - armH);
                ctx.lineTo(cx + armW, cy - armW);
                ctx.lineTo(cx + armH, cy - armW);
                ctx.lineTo(cx + armH, cy + armW);
                ctx.lineTo(cx + armW, cy + armW);
                ctx.lineTo(cx + armW, cy + armH);
                ctx.lineTo(cx - armW, cy + armH);
                ctx.lineTo(cx - armW, cy + armW);
                ctx.lineTo(cx - armH, cy + armW);
                ctx.lineTo(cx - armH, cy - armW);
                ctx.lineTo(cx - armW, cy - armW);
                ctx.closePath();
                break;
            }
            case 'star': {
                const spikes = 5;
                const outerR = r;
                const innerR = r * 0.4;
                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerR : innerR;
                    const angle = (Math.PI / 2 * 3) + (i * Math.PI / spikes);
                    const sx = cx + Math.cos(angle) * radius;
                    const sy = cy + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
                break;
            }
            // ===== 扑克牌花色 =====
            case 'heart': {
                const top = cy - r * 0.3;
                const bottom = cy + r * 0.9;
                const midY = cy + r * 0.2;

                ctx.moveTo(cx, bottom);
                ctx.bezierCurveTo(
                    cx + r * 1.2, midY,
                    cx + r, top,
                    cx, cy - r * 0.6
                );
                ctx.bezierCurveTo(
                    cx - r, top,
                    cx - r * 1.2, midY,
                    cx, bottom
                );
                ctx.closePath();
                break;
            }

            case 'club': {
                const stemW = r * 0.18;
                const stemH = r * 0.9;

                // 茎
                ctx.moveTo(cx - stemW, cy + r * 0.3);
                ctx.lineTo(cx - stemW, cy + stemH);
                ctx.lineTo(cx + stemW, cy + stemH);
                ctx.lineTo(cx + stemW, cy + r * 0.3);
                ctx.closePath();

                // 下面左圆
                ctx.moveTo(cx - r * 0.55 + r * 0.5, cy + r * 0.15);
                ctx.arc(cx - r * 0.55, cy + r * 0.15, r * 0.5, 0, Math.PI * 2);
                // 下面右圆
                ctx.moveTo(cx + r * 0.55 + r * 0.5, cy + r * 0.15);
                ctx.arc(cx + r * 0.55, cy + r * 0.15, r * 0.5, 0, Math.PI * 2);
                // 上面圆
                ctx.moveTo(cx + r * 0.55, cy - r * 0.35);
                ctx.arc(cx, cy - r * 0.35, r * 0.55, 0, Math.PI * 2);
                break;
            }

            case 'spade': {
                const top = cy - r * 0.5;
                const bottom = cy + r * 0.6;

                // 上半部分
                ctx.moveTo(cx, top - r * 0.4);
                ctx.bezierCurveTo(
                    cx + r * 1.1, top + r * 0.3,
                    cx + r * 0.6, bottom,
                    cx, bottom
                );
                ctx.bezierCurveTo(
                    cx - r * 0.6, bottom,
                    cx - r * 1.1, top + r * 0.3,
                    cx, top - r * 0.4
                );
                ctx.closePath();

                // 茎
                const stemW = r * 0.15;
                ctx.moveTo(cx - stemW, bottom);
                ctx.lineTo(cx - stemW * 1.5, bottom + r * 0.7);
                ctx.lineTo(cx + stemW * 1.5, bottom + r * 0.7);
                ctx.lineTo(cx + stemW, bottom);
                ctx.closePath();
                break;
            }
            // =====================

            default: // circle
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                break;
        }

        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    _startAnimation() {
        this._stopAnimation();

        this._canvas.style.transformOrigin = '50% 50%';

        const gridCycleH = this._gridCycleH;
        const speed = gridCycleH / SCROLL_DURATION; // px/s
        const maxCycles = 4; // 5 周期画布，用前 4 个循环滚动，保留 1 个缓冲区

        let lastTime = performance.now();
        let currentY = 0;
        let absTime = 0; // 累计时间，用于摆动相位（不取模）

        console.log('[loadingBg] 动画启动 | gridCycleH:', gridCycleH.toFixed(0),
            '| speed:', speed.toFixed(1), 'px/s | canvasCycles: 5 | SCROLL_DURATION:', SCROLL_DURATION, 's');

        const tick = (now) => {
            if (!this._running) return;
            this._animFrameId = requestAnimationFrame(tick);

            const dt = Math.min((now - lastTime) / 1000, 0.2); // 防大跳帧
            lastTime = now;
            absTime += dt;

            // y 持续累减，不取模 → 无 CSS 值跳变
            currentY -= speed * dt;

            // 逼近缓冲区边界时，向上平移一个周期（视觉内容完全一致）
            if (currentY <= -gridCycleH * maxCycles) {
                currentY += gridCycleH;
            }

            // 摆动：sin(2π * t / T)，用不取模的 absTime 保证连续
            const phase = (absTime / SWAY_DURATION) * Math.PI * 2;
            const rotation = Math.sin(phase) * SWAY_ANGLE;

            this._canvas.style.transform =
                `translate3d(0, ${currentY}px, 0) rotate(${rotation}deg)`;
        };

        this._animFrameId = requestAnimationFrame(tick);
    }

    _stopAnimation() {
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }
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