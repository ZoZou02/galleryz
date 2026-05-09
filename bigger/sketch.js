/**
 * 合成大XX - p5.js 小游戏
 * 相同等级XX碰撞后合成更高级XX，目标是合成大XX
 * 依赖：p5.js、Matter.js
 */

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

// ============================================================
//  游戏配置
// ============================================================

/** 画布尺寸与墙壁 */
const GAME_WIDTH = 350;
const GAME_HEIGHT = 550;
const WALL_THICKNESS = 20;

/** 面板背景尺寸及游戏区偏移 */
const PANEL_WIDTH = 425;
const PANEL_HEIGHT = 768;
const GAME_OFFSET_X = (PANEL_WIDTH - GAME_WIDTH) / 2;
const GAME_OFFSET_Y = (PANEL_WIDTH - GAME_WIDTH) / 2 - 10;

/** 物理引擎参数 */
const PHYSICS = {
    gravity: 1.2,         // 重力加速度
    restitution: 0.2,     // 弹性系数（0=完全不弹，1=完全反弹）
    friction: 0.1,        // 摩擦系数
    density: 0.001        // 密度（越小越轻、碰撞越柔和）
};

/** 游戏难度 */
const DIFFICULTY = {
    initialFruitMaxLevel: 4,    // 初始随机水果最高等级（0-4 共5种）
    dangerTimeoutSeconds: 3     // 水果超过危险线后几秒判负
};

/** 水果配置：名称、半径、颜色、分数、动画路径等 */
const FRUITS = [
    { name: '👽',    radius: 14,  color: '#9B59B6', score: 10,   folder: 'images/level0/',  idlePrefix: '0-idle-', idleFrames: 4, hitFile: '0-hit.png' },
    { name: '残杀',    radius: 21,  color: '#E74C3C', score: 20,   folder: 'images/level1/',  idlePrefix: '1-idle-', idleFrames: 4, hitFile: '1-hit.png' },
    { name: '口几口',    radius: 28,  color: '#F39C12', score: 30,  folder: 'images/level2/',  idlePrefix: '2-idle-', idleFrames: 4, hitFile: '2-hit.png' },
    { name: '象姐',    radius: 35,  color: '#F1C40F', score: 40,  folder: 'images/level3/',  idlePrefix: '3-idle-', idleFrames: 4, hitFile: '3-hit.png' },
    { name: '芙老大',  radius: 42,  color: '#8BC34A', score: 50,  folder: 'images/level4/',  idlePrefix: '4-idle-', idleFrames: 4, hitFile: '4-hit.png' },
    { name: '牧牧川',    radius: 47,  color: '#E67E22', score: 60,  folder: 'images/level5/',  idlePrefix: '5-idle-', idleFrames: 4, hitFile: '5-hit.png' },
    { name: '抽子',    radius: 52,  color: '#FFB6C1', score: 70,  folder: 'images/level6/',  idlePrefix: '6-idle-', idleFrames: 4, hitFile: '6-hit.png' },
    { name: '悠姆帕',    radius: 58,  color: '#FFD700', score: 80,  folder: 'images/level7/',  idlePrefix: '7-idle-', idleFrames: 4, hitFile: '7-hit.png' },
    { name: '鸟哥',    radius: 63,  color: '#D2691E', score: 90,  folder: 'images/level8/',  idlePrefix: '8-idle-', idleFrames: 4, hitFile: '8-hit.png' },
    { name: '李哥', radius: 68, color: '#2ECC71', score: 100, folder: 'images/level9/',  idlePrefix: '9-idle-', idleFrames: 4, hitFile: '9-hit.png' },
    { name: 'GEE',  radius: 74, color: '#27AE60', score: 150, folder: 'images/level10/', idlePrefix: '10-idle-', idleFrames: 4, hitFile: '10-hit.png' }
];

/** 动画参数 */
const ANIM = {
    frameDuration: 50,     // 每帧显示多少毫秒
    loopDelay: 2000,       // 一轮动画播放完后停多少毫秒
    hitDuration: 200       // 碰撞动画持续多少毫秒
};

/**
 * 合成音频配置 —— 提供参数化控制接口
 * - delay_time: 合成判断延迟（毫秒），碰撞后等待此时间才执行合成
 * - base_pitch: 合成音效的基础音调（等级0时）
 * - pitch_per_level: 每提升一级水果，音调增加的幅度
 */
const MERGE_AUDIO_CFG = {
    delay_time: 80,
    base_pitch: 0.7,
    pitch_per_level: 0.20
};

// ============================================================
//  游戏状态
// ============================================================

let engine;
let world;
let fruits = [];          // { body, level, animationOffset, state: 'idle' | 'hit', hitStartTime: 0, isNewDrop: boolean }
let pendingMerges = [];   // { fruitA, fruitB, newLevel, startTime, processed }
let score = 0;
let gameOver = false;
let currentFruitLevel = 0; // 当前待放置水果等级
let nextFruitLevel = 0;    // 下一个要放置的水果等级

/** 危险线判定相关 */
let dangerLineY = 100;
let dangerTime = 0;
let dangerCooldownStart = 0;
let gameOverAnimating = false; // 游戏结束动画中
let gameOverExplodeIndex = 0; // 当前爆炸水果索引
let gameOverExplodeTime = 0; // 上次爆炸时间

// ============================================================
//  资源加载状态
// ============================================================

let spritesheetImage = null; // 雪碧图（5列×11行，列0-3:idle帧，列4:hit帧）
let frameW = 0; // 雪碧图每帧宽度
let frameH = 0; // 雪碧图每帧高度
let mergeEffects = [];
let imagesReady = false;
let debugLoadStatus = '';
let frontImage = null; // 前景图片
let panelImage = null; // 面板背景（整合了背景+面板）
let loadingHidden = false; // 加载页是否已隐藏

// ============================================================
//  释放控制
// ============================================================

let lastDropTime = 0;        // 上次成功释放的时间戳
let dropDelay = 500;         // 释放间隔（毫秒）

// ============================================================
//  音效管理
// ============================================================

/**
 * 语音音效配置
 * voiceVariants[level] = 该等级拥有的语音变种数量
 * voiceChance = 释放时播放语音的概率（0-1）
 */
const VOICE_CFG = {
    voiceVariants: [],
    voiceChance: 0.35,
    _init() {
        this.voiceVariants[0] = 3;
        for (let i = 1; i < FRUITS.length; i++) {
            // 所有等级释放都可能有语音；仅后6种（5-10）合成有语音
            this.voiceVariants[i] = 1;
        }
    }
};
VOICE_CFG._init();

const SoundManager = {
    ctx: null,
    buffers: {},
    _voiceBufs: [],            // [level] = [buf0, buf1, ...]

    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },

    load(name, url) {
        return fetch(url)
            .then(res => res.arrayBuffer())
            .then(buf => this.ctx.decodeAudioData(buf))
            .then(audioBuf => { this.buffers[name] = audioBuf; });
    },

    play(name, opts = {}) {
        if (!this.ctx) return;
        let buf = this.buffers[name];
        if (!buf) return;
        this._playBuf(buf, opts);
    },

    _playBuf(buf, opts = {}) {
        if (!this.ctx || !buf) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => this._startSource(buf, opts));
            return;
        }
        if (this.ctx.state !== 'running') return;
        this._startSource(buf, opts);
    },

    /**
     * 创建并启动一个音频源
     * @param {AudioBuffer} buf   - 音频 buffer
     * @param {Object} opts       - { rate, volume, duration, pitchRamp? {from,to}, volumeRamp? {from,to} }
     *                               若提供 pitchRamp/volumeRamp，则通过 Web Audio API
     *                               的 linearRampToValueAtTime 实现平滑渐变
     */
    _startSource(buf, opts) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        let source = this.ctx.createBufferSource();
        source.buffer = buf;
        let gain = this.ctx.createGain();
        source.connect(gain);
        gain.connect(this.ctx.destination);

        let now = this.ctx.currentTime;
        let dur = opts.duration != null ? opts.duration : buf.duration;

        // 音调：支持渐变 ramp 或固定值
        if (opts.pitchRamp) {
            source.playbackRate.setValueAtTime(opts.pitchRamp.from, now);
            source.playbackRate.linearRampToValueAtTime(opts.pitchRamp.to, now + dur);
        } else {
            source.playbackRate.value = opts.rate || 1;
        }

        // 音量：支持渐变 ramp 或固定值
        if (opts.volumeRamp) {
            gain.gain.setValueAtTime(opts.volumeRamp.from, now);
            gain.gain.linearRampToValueAtTime(opts.volumeRamp.to, now + dur);
        } else {
            gain.gain.value = opts.volume != null ? opts.volume : 1;
        }

        source.start(now, 0, dur);
    },

    // ---------- 语音加载 ----------

    _loadVoiceLevel(level, onLoad) {
        if (!this._voiceBufs[level]) this._voiceBufs[level] = [];
        let count = VOICE_CFG.voiceVariants[level] || 0;
        for (let v = 0; v < count; v++) {
            let url = 'sound/level' + level + '/level' + level + '-' + v + '.mp3';
            let idx = v;
            fetch(url)
                .then(res => res.arrayBuffer())
                .then(buf => this.ctx.decodeAudioData(buf))
                .then(audioBuf => { this._voiceBufs[level][idx] = audioBuf; if (onLoad) onLoad(); })
                .catch(() => { if (onLoad) onLoad(); });
        }
    },

    _pickVoice(level) {
        let bufs = this._voiceBufs[level];
        if (!bufs || bufs.length === 0) return null;
        let valid = bufs.filter(b => !!b);
        if (valid.length === 0) return null;
        return valid[floor(random(valid.length))];
    },

    _voiceDelay: 350,              // 语音延迟多少毫秒后播放
    _mergeVoiceTimerId: null,      // 合成语音 debounce 定时器
    _mergeMaxLevel: -1,            // 当前窗口内合成出的最高等级
    _mergeMaxBuf: null,            // 最高等级的语音 buffer
    _mergeMaxRate: 1,              // 最高等级的音调

    // ---------- 释放音效 ----------

    /**
     * 释放水果：先播 falling，一定概率延迟播放语音
     */
    playDrop(level) {
        this.play('falling', { duration: 1 });
        if (random() < VOICE_CFG.voiceChance) {
            setTimeout(() => {
                let buf = this._pickVoice(level);
                if (buf) this._playBuf(buf, { duration: 2.5 });
            }, this._voiceDelay);
        }
    },

    // ---------- 合成音效 ----------

    /**
     * 合成水果：bubble 音调查看水果等级，等级越高音调越高
     */
    playMerge(newLevel) {
        let rate = MERGE_AUDIO_CFG.base_pitch + newLevel * MERGE_AUDIO_CFG.pitch_per_level;
        this.play('merge', { rate });

        if (newLevel >= 5 && newLevel > this._mergeMaxLevel) {
            // 仅后6种（等级5-10）合成时有语音，同一个窗口内只保留最高等级
            let buf = this._pickVoice(newLevel);
            if (buf) {
                this._mergeMaxLevel = newLevel;
                this._mergeMaxBuf = buf;
                // 水果等级越高，音调越低 /* 需删除：下面 rate 整行 */
                this._mergeMaxRate = map(newLevel, 5, 10, 1.15, 0.85); /* 需删除 */
            }
        }

        if (this._mergeVoiceTimerId) clearTimeout(this._mergeVoiceTimerId);
        this._mergeVoiceTimerId = setTimeout(() => {
            if (this._mergeMaxBuf) {
                this._playBuf(this._mergeMaxBuf, { rate: this._mergeMaxRate, duration: 2 }); /* 需删除：把 rate 改成 1 */
            }
            this._mergeVoiceTimerId = null;
            this._mergeMaxLevel = -1;
            this._mergeMaxBuf = null;
            this._mergeMaxRate = 1;
        }, this._voiceDelay + 100);
    }
};

// ============================================================
//  动画系统
// ============================================================

/**
 * 基于真实时间计算当前动画帧索引，保证不同帧率设备效果一致
 * 播放顺序：0→1→2→3→1→0 循环
 * @param {Array} frames - 动画帧数组
 * @param {number} offset - 毫秒偏移，让不同水果异步播放
 * @returns {number} 当前应显示的帧索引
 */
function getAnimationFrameIndex(offset = 0) {
    let playSequence = [0, 1, 2, 3, 1, 0];
    let sequenceLength = playSequence.length;

    let duration = sequenceLength * ANIM.frameDuration;
    let cycleLength = duration + ANIM.loopDelay;
    let t = (millis() + offset) % cycleLength;

    if (t < duration) {
        let sequenceIndex = floor(t / ANIM.frameDuration) % sequenceLength;
        return playSequence[sequenceIndex];
    } else {
        return 0;
    }
}

// ============================================================
//  生命周期
// ============================================================

function preload() {
    // 资源由 setup() 中手动加载，此处留空
}

/** 初始化画布、音效、图片、物理引擎 */
function setup() {
    createCanvas(PANEL_WIDTH, PANEL_HEIGHT);
    windowResized();

    SoundManager.init();

    // ---------- 加载资源（统一计数，全部就绪才进入游戏） ----------
    let loadedCount = 0;
    let totalToLoad = 3; // spritesheet + front + panel

    function onImgLoad() {
        loadedCount++;
        if (loadedCount === totalToLoad) imagesReady = true;
    }

    // 雪碧图
    loadImage('images/spritesheet.png', (img) => {
        spritesheetImage = img;
        frameW = img.width / 5;
        frameH = img.height / 11;
        onImgLoad();
    }, onImgLoad);

    // 前景/面板
    loadImage('images/0-front.png', (img) => { frontImage = img; onImgLoad(); }, onImgLoad);
    loadImage('images/1-panel.png', (img) => { panelImage = img; onImgLoad(); }, onImgLoad);

    // 核心音效
    totalToLoad += 3;
    SoundManager.load('falling', 'sound/falling.wav').then(onImgLoad).catch(onImgLoad);
    SoundManager.load('merge', 'sound/bubble.wav').then(onImgLoad).catch(onImgLoad);
    SoundManager.load('gameover', 'sound/gameover.wav').then(onImgLoad).catch(onImgLoad);

    // 语音音效
    for (let i = 0; i < FRUITS.length; i++) {
        totalToLoad += VOICE_CFG.voiceVariants[i] || 0;
        SoundManager._loadVoiceLevel(i, onImgLoad);
    }

    // ---------- 物理引擎 ----------
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = PHYSICS.gravity;

    // 创建左、右、底三面墙壁（加上面板偏移）
    let leftWall = Bodies.rectangle(GAME_OFFSET_X + WALL_THICKNESS / 2, GAME_OFFSET_Y + GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, { isStatic: true });
    let rightWall = Bodies.rectangle(GAME_OFFSET_X + GAME_WIDTH - WALL_THICKNESS / 2, GAME_OFFSET_Y + GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, { isStatic: true });
    let bottomWall = Bodies.rectangle(GAME_OFFSET_X + GAME_WIDTH / 2, GAME_OFFSET_Y + GAME_HEIGHT - WALL_THICKNESS / 2, GAME_WIDTH, WALL_THICKNESS, { isStatic: true });
    Composite.add(world, [leftWall, rightWall, bottomWall]);

    // 监听碰撞事件
    Events.on(engine, 'collisionStart', handleCollision);

    currentFruitLevel = getRandomInitialLevel();
    nextFruitLevel = getRandomInitialLevel();
}

/** 随机获取初始水果等级 */
function getRandomInitialLevel() {
    return floor(random(0, DIFFICULTY.initialFruitMaxLevel + 1));
}

/** 窗口大小变化时等比缩放 canvas，适配不同屏幕比例 */
function windowResized() {
    let scale = min(windowWidth / PANEL_WIDTH, windowHeight / PANEL_HEIGHT);
    let c = drawingContext.canvas;
    c.style.width = PANEL_WIDTH * scale + 'px';
    c.style.height = PANEL_HEIGHT * scale + 'px';
}

/** 主循环：更新物理 → 更新水果状态 → 绘制画面 → 检测结束 */
function draw() {
    if (!loadingHidden && imagesReady) {
        let loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                if (loadingScreen.parentNode) loadingScreen.parentNode.removeChild(loadingScreen);
            }, 500);
        }
        loadingHidden = true;
        return;
    }

    if (!imagesReady) return;

    Engine.update(engine, 1000 / 60);
    processPendingMerges();

    if (!gameOverAnimating) updateFruitStates();

    // background('#FFE5B4');

    // 绘制面板背景（全画布尺寸，比水果框大）
    if (panelImage) {
        imageMode(CORNER);
        image(panelImage, 0, 0, PANEL_WIDTH, PANEL_HEIGHT);
    }

    // 游戏区统一偏移到面板中央
    push();
    translate(GAME_OFFSET_X, GAME_OFFSET_Y);

    drawWalls();
    drawDangerLine();
    drawFruits();
    drawMergeEffects();
    drawCurrentFruit();
    drawUI();

    // 绘制前景图片（水果前面，在游戏区内）
    if (frontImage) {
        imageMode(CORNER);
        image(frontImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    pop();

    drawLevelIcons();

    if (gameOverAnimating) {
        updateGameOverAnimation();
        return;
    }

    if (!gameOver && checkGameOver()) {
        startGameOverAnimation();
    }
}

// ============================================================
//  绘制函数
// ============================================================

/** 绘制三面墙壁 */
function drawWalls() {
    // 墙壁已设为透明，由背景图片提供视觉效果
}

/** 面板底部绘制 level0-10 的 idle-0 图标，从左到右排列 */
function drawLevelIcons() {
    let iconRadius = 14;
    let iconSize = iconRadius * 2.2;
    let totalWidth = FRUITS.length * iconSize;
    let margin = (PANEL_WIDTH - totalWidth) / 2;
    let y = GAME_HEIGHT + 170;

    for (let i = 0; i < FRUITS.length; i++) {
        let x = margin + iconSize / 2 + i * iconSize;

        if (spritesheetImage && frameW > 0) {
            let srcY = i * frameH;
            imageMode(CENTER);
            image(spritesheetImage, x, y, iconSize, iconSize, 0, srcY, frameW, frameH);
        } else {
            fill(FRUITS[i].color);
            noStroke();
            ellipse(x, y, iconRadius * 2);
        }
    }
}

/** 绘制危险线（有危险时闪烁加粗） */
function drawDangerLine() {
    let isDanger = dangerTime > 0;
    let alpha = isDanger ? 200 + 55 * sin(frameCount * 0.1) : 100;
    stroke('#FF0000', alpha);
    strokeWeight(isDanger ? 3 : 2);
    drawingContext.setLineDash([10, 10]);
    line(WALL_THICKNESS, dangerLineY, GAME_WIDTH - WALL_THICKNESS, dangerLineY);
    drawingContext.setLineDash([]);
    noStroke();
}

/** 更新所有水果状态（hit 转 idle） */
function updateFruitStates() {
    let now = millis();
    for (let fruit of fruits) {
        if (!fruit.state) fruit.state = 'idle';
        if (fruit.state === 'hit' && fruit.hitStartTime && (now - fruit.hitStartTime) >= ANIM.hitDuration) {
            fruit.state = 'idle';
        }
        if (!fruit.isNewDrop) continue;
        let v = fruit.body.velocity;
        if (Math.abs(v.y) < 0.1 && Math.abs(v.x) < 0.1) {
            fruit.isNewDrop = false;
        }
    }
}

/** 绘制所有已落下的水果（含动画，从雪碧图裁剪） */
function drawFruits() {
    for (let i = 0; i < fruits.length; i++) {
        let fruit = fruits[i];
        if (gameOverAnimating && i < gameOverExplodeIndex) continue;
        let pos = fruit.body.position;
        let level = fruit.level;

        push();
        translate(pos.x - GAME_OFFSET_X, pos.y - GAME_OFFSET_Y);
        rotate(fruit.body.angle);

        let fruitInfo = FRUITS[level];
        let state = fruit.state || 'idle';
        let dw = fruitInfo.radius * 2.2;
        let dh = fruitInfo.radius * 2.2;

        if (spritesheetImage && frameW > 0) {
            let srcY = level * frameH;
            let srcX;
            if (state === 'hit') {
                srcX = 4 * frameW;
            } else {
                srcX = getAnimationFrameIndex(fruit.animationOffset || 0) * frameW;
            }
            imageMode(CENTER);
            image(spritesheetImage, 0, 0, dw, dh, srcX, srcY, frameW, frameH);
        } else {
            fill(fruitInfo.color);
            stroke(0, 50);
            strokeWeight(1);
            ellipse(0, 0, fruitInfo.radius * 2);
            fill(255, 200);
            textSize(max(12, fruitInfo.radius * 0.5));
            textAlign(CENTER, CENTER);
            noStroke();
            text(level + 1, 0, 0);
        }

        pop();
    }
}

let previewOffset1 = Math.floor(Math.random() * 3000);
let previewOffset2 = Math.floor(Math.random() * 3000);

/** 绘制当前待放置水果（跟随鼠标）及辅助虚线 */
function drawCurrentFruit() {
    if (gameOver) return;

    let fruitInfo = FRUITS[currentFruitLevel];
    let gameMouseX = mouseX - GAME_OFFSET_X;
    let x = constrain(gameMouseX, WALL_THICKNESS + fruitInfo.radius, GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius);
    let y = 80;

    push();

    if (spritesheetImage && frameW > 0) {
        let srcX = getAnimationFrameIndex(previewOffset1) * frameW;
        let srcY = currentFruitLevel * frameH;
        let dw = fruitInfo.radius * 2.2;
        let dh = fruitInfo.radius * 2.2;
        imageMode(CENTER);
        tint(255, 255);
        image(spritesheetImage, x, y, dw, dh, srcX, srcY, frameW, frameH);
    } else {
        fill(fruitInfo.color, 180);
        stroke(0, 80);
        strokeWeight(1);
        ellipse(x, y, fruitInfo.radius * 2);
        fill(255, 200);
        textSize(max(12, fruitInfo.radius * 0.5));
        textAlign(CENTER, CENTER);
        noStroke();
        text(currentFruitLevel + 1, x, y);
    }

    stroke('#999999', 100);
    strokeWeight(1);
    drawingContext.setLineDash([5, 5]);
    line(x, y + fruitInfo.radius, x, GAME_HEIGHT);
    drawingContext.setLineDash([]);
    pop();
}

/** 绘制 UI：分数、下一个水果预览、危险倒计时、调试信息 */
function drawUI() {
    fill(255);
    stroke(0);
    strokeWeight(2);
    textStyle(BOLD);
    textSize(20);
    textAlign(CENTER, TOP);
    text(score.toLocaleString(), GAME_WIDTH / 2, 0);

    // 调试信息
    textSize(12);
    fill(255, 0, 0);
    text(debugLoadStatus, 10, 40);

    textSize(20);
    fill(0);

    // 下一个水果预览
    textAlign(RIGHT, TOP);
    let nextFruitInfo = FRUITS[nextFruitLevel];

    if (spritesheetImage && frameW > 0) {
        let srcX = getAnimationFrameIndex(previewOffset2) * frameW;
        let srcY = nextFruitLevel * frameH;
        imageMode(CENTER);
        image(spritesheetImage, GAME_WIDTH - 30, 25, 20, 20, srcX, srcY, frameW, frameH);
    } else {
        fill(nextFruitInfo.color);
        ellipse(GAME_WIDTH - 30, 25, 20);
    }
    fill(0);
    text(GAME_WIDTH - 50, 20);

    // 危险倒计时
    if (dangerTime > 0) {
        let remaining = DIFFICULTY.dangerTimeoutSeconds - (millis() - dangerTime) / 1000;
        if (remaining > 0) {
            push();
            let alpha = remaining < 1.5 ? map(remaining, 0, 1.5, 100, 255) : 255;
            fill(255, 0, 0, alpha);
            textSize(32);
            textAlign(CENTER, CENTER);
            text(ceil(remaining), GAME_WIDTH / 2, dangerLineY - 30);
            pop();
        }
    }
}

// ============================================================
//  交互逻辑
// ============================================================

/** 点击事件：检查间隔，满足条件立即释放 */
function mousePressed() {
    if (gameOver || !imagesReady) return;

    let now = millis();
    if (now - lastDropTime < dropDelay) return;

    let fruitInfo = FRUITS[currentFruitLevel];
    let gameMouseX = mouseX - GAME_OFFSET_X;
    let x = constrain(gameMouseX, WALL_THICKNESS + fruitInfo.radius, GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius);

    let body = Bodies.circle(GAME_OFFSET_X + x, GAME_OFFSET_Y + 50, fruitInfo.radius, {
        restitution: PHYSICS.restitution,
        friction: PHYSICS.friction,
        density: PHYSICS.density
    });

    Composite.add(world, body);
    fruits.push({
        body,
        level: currentFruitLevel,
        animationOffset: Math.floor(Math.random() * 3000),
        state: 'idle',
        hitStartTime: 0,
        isNewDrop: true
    });

    SoundManager.playDrop(currentFruitLevel);

    currentFruitLevel = nextFruitLevel;
    nextFruitLevel = getRandomInitialLevel();

    lastDropTime = now;
}

// ============================================================
//  合成系统
// ============================================================

/**
 * 触发水果 hit 状态
 */
function triggerHitState(fruitObj) {
    fruitObj.state = 'hit';
    fruitObj.hitStartTime = millis();
}

/**
 * 碰撞回调：
 * - 检测新下落水果砸到其他水果/墙壁，触发 hit 动画
 * - 检测两个相同等级水果碰撞，加入延迟合成队列（不立即合并）
 * 使用 processedFruits 避免同一帧内重复处理
 */
function handleCollision(event) {
    if (gameOver) return;

    let pairs = event.pairs;
    let processedFruits = new Set();

    for (let pair of pairs) {
        let bodyA = pair.bodyA;
        let bodyB = pair.bodyB;

        // 先检测是否是新下落碰撞：是否有 isNewDrop 的水果
        let fruitA = fruits.find(f => f.body === bodyA);
        let fruitB = fruits.find(f => f.body === bodyB);

        let hasNewDrop = (fruitA && fruitA.isNewDrop) || (fruitB && fruitB.isNewDrop);
        if (hasNewDrop) {
            // 碰撞到水果或墙壁：都触发两个水果（如果是水果）的 hit
            if (fruitA) triggerHitState(fruitA);
            if (fruitB) triggerHitState(fruitB);
        }

        // 合成检测
        if (processedFruits.has(bodyA.id) || processedFruits.has(bodyB.id)) {
            continue;
        }

        if (fruitA && fruitB && fruitA.level === fruitB.level) {
            let level = fruitA.level;

            // 已是最高等级则不再合成
            if (level >= FRUITS.length - 1) continue;

            // 已被纳入其他待处理合成中则跳过
            if (fruitA._pendingMergeId != null || fruitB._pendingMergeId != null) continue;

            let newLevel = level + 1;
            let newPos = {
                x: (fruitA.body.position.x + fruitB.body.position.x) / 2,
                y: (fruitA.body.position.y + fruitB.body.position.y) / 2
            };

            processedFruits.add(bodyA.id);
            processedFruits.add(bodyB.id);

            // 标记两个水果为待合成状态，加入延迟队列
            let mergeId = Date.now() + Math.random();
            fruitA._pendingMergeId = mergeId;
            fruitB._pendingMergeId = mergeId;
            pendingMerges.push({
                fruitA, fruitB, newLevel, newPos, mergeId,
                startTime: millis()
            });
        }
    }
}

/**
 * 逐帧处理延迟合成队列：
 * 碰撞后等待 ${delay_time} 毫秒才执行合成，期间水果保持可见
 */
function processPendingMerges() {
    let now = millis();
    for (let i = pendingMerges.length - 1; i >= 0; i--) {
        let pm = pendingMerges[i];
        if (now - pm.startTime < MERGE_AUDIO_CFG.delay_time) continue;

        // 检查两个水果是否仍在场（可能已被其他合成分支消耗）
        let fa = fruits.find(f => f._pendingMergeId === pm.mergeId && f.body === pm.fruitA.body);
        let fb = fruits.find(f => f._pendingMergeId === pm.mergeId && f.body === pm.fruitB.body);
        if (!fa || !fb) {
            pendingMerges.splice(i, 1);
            continue;
        }

        // 移除两个旧水果
        Composite.remove(world, fa.body);
        Composite.remove(world, fb.body);
        fruits = fruits.filter(f => f._pendingMergeId !== pm.mergeId);

        // 创建合成后的新水果
        let newFruitInfo = FRUITS[pm.newLevel];
        let newBody = Bodies.circle(pm.newPos.x, pm.newPos.y, newFruitInfo.radius, {
            restitution: PHYSICS.restitution,
            friction: PHYSICS.friction,
            density: PHYSICS.density
        });
        Composite.add(world, newBody);
        fruits.push({
            body: newBody,
            level: pm.newLevel,
            animationOffset: Math.floor(Math.random() * 3000),
            state: 'idle',
            hitStartTime: 0,
            isNewDrop: false
        });

        score += newFruitInfo.score;

        // 合成特效
        mergeEffects.push({
            x: pm.newPos.x, y: pm.newPos.y,
            radius: newFruitInfo.radius,
            alpha: 255, expanding: true
        });

        // 合成音效（延迟后播放，带音调/音量渐变）
        SoundManager.playMerge(pm.newLevel);

        pendingMerges.splice(i, 1);
    }
}

/** 绘制合成特效：白色扩散光环 */
function drawMergeEffects() {
    for (let i = mergeEffects.length - 1; i >= 0; i--) {
        let effect = mergeEffects[i];
        if (effect.expanding) {
            effect.radius += 3;
            effect.alpha -= 10;
            if (effect.alpha <= 0) {
                mergeEffects.splice(i, 1);
                continue;
            }
        }
        noFill();
        stroke(255, effect.alpha);
        strokeWeight(3);
        ellipse(effect.x - GAME_OFFSET_X, effect.y - GAME_OFFSET_Y, effect.radius * 2);
    }
}

// ============================================================
//  游戏结束判定
// ============================================================

/**
 * 检测是否有水果稳定停在危险线以上超过时限
 * 一旦开始计时不会因新水果落下而轻易中断
 * @returns {boolean} 是否游戏结束
 */
function checkGameOver() {
    let hasStableFruitAbove = false;

    for (let fruit of fruits) {
        let fruitTop = fruit.body.position.y - GAME_OFFSET_Y - FRUITS[fruit.level].radius;
        if (fruitTop < dangerLineY) {
            let v = fruit.body.velocity;
            let speed = sqrt(v.x * v.x + v.y * v.y);
            if (speed < 0.3) {
                hasStableFruitAbove = true;
                break;
            }
        }
    }

    if (dangerTime > 0) {
        if (!hasStableFruitAbove) {
            // 水果已全部离开危险线：延迟1秒后重置计时
            if (!dangerCooldownStart) {
                dangerCooldownStart = millis();
            } else if (millis() - dangerCooldownStart > 1000) {
                dangerTime = 0;
                dangerCooldownStart = 0;
            }
        } else {
            dangerCooldownStart = 0;
        }
    } else {
        dangerCooldownStart = 0;
        if (hasStableFruitAbove) {
            dangerTime = millis();
        }
    }

    if (dangerTime > 0) {
        let elapsed = (millis() - dangerTime) / 1000;
        if (elapsed > DIFFICULTY.dangerTimeoutSeconds) {
            return true;
        }
    }

    return false;
}

// ============================================================
//  游戏重启
// ============================================================

// ============================================================
//  游戏结束动画
// ============================================================

/** 开始游戏结束流程：排序水果、播放结束音效、进入爆炸动画 */
function startGameOverAnimation() {
    gameOver = true;
    gameOverAnimating = true;
    gameOverExplodeIndex = 0;
    gameOverExplodeTime = 0;

    // 按水果顶部 y 坐标从高到低排序（从上到下）
    fruits.sort((a, b) => {
        let aTop = a.body.position.y - FRUITS[a.level].radius;
        let bTop = b.body.position.y - FRUITS[b.level].radius;
        return aTop - bTop;
    });

    SoundManager.play('gameover');
}

/** 逐帧执行爆炸动画 */
function updateGameOverAnimation() {
    if (gameOverExplodeIndex >= fruits.length) {
        // 所有水果爆炸完成，清空数组，显示弹窗
        fruits = [];
        gameOverAnimating = false;
        showGameOverModal(score);
        return;
    }

    let now = millis();
    if (now - gameOverExplodeTime > 80) { // 每80ms爆炸一个
        let fruit = fruits[gameOverExplodeIndex];
        let level = fruit.level;

        // 播放 bubble 音效（按等级变调）
        SoundManager.play('merge', { rate: map(level, 1, 10, 0.7, 2.2) });

        // 移除物理体
        Composite.remove(world, fruit.body);

        // 添加爆炸特效
        let pos = fruit.body.position;
        let radius = FRUITS[level].radius;
        mergeEffects.push({
            x: pos.x,
            y: pos.y,
            radius: radius,
            alpha: 255,
            expanding: true
        });

        gameOverExplodeIndex++;
        gameOverExplodeTime = now;
    }
}

/** 清理所有状态重新开始 */
function restartGame() {
    for (let fruit of fruits) {
        Composite.remove(world, fruit.body);
    }
    fruits = [];
    pendingMerges = [];
    mergeEffects = [];
    score = 0;
    gameOver = false;
    gameOverAnimating = false;
    gameOverExplodeIndex = 0;
    gameOverExplodeTime = 0;
    dangerTime = 0;
    dangerCooldownStart = 0;
    lastDropTime = 0;
    SoundManager._mergeVoiceTimerId = null;
    SoundManager._mergeMaxLevel = -1;
    SoundManager._mergeMaxBuf = null;
    SoundManager._mergeMaxRate = 1;

    currentFruitLevel = getRandomInitialLevel();
    nextFruitLevel = getRandomInitialLevel();
}

/** 弹出游戏结束弹窗 */
function showGameOverModal(finalScore) {
    let modal = document.getElementById('game-over-modal');
    let scoreDisplay = document.getElementById('final-score');
    if (modal && scoreDisplay) {
        scoreDisplay.textContent = finalScore;
        modal.classList.add('visible');
    }
}

/** 从弹窗按钮触发重启 */
function restartFromModal() {
    let modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.remove('visible');
    restartGame();
}

window.restartFromModal = restartFromModal;
