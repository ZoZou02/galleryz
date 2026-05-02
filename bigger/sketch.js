/**
 * 合成大西瓜 - p5.js 小游戏
 * 相同等级水果碰撞后合成更高级水果，目标是合成大西瓜
 * 依赖：p5.js、Matter.js
 */

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

// ============================================================
//  游戏配置
// ============================================================

/** 画布尺寸与墙壁 */
const GAME_WIDTH = 400;
const GAME_HEIGHT = 700;
const WALL_THICKNESS = 20;

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

/** 水果配置：名称、半径、颜色、分数、动画路径、帧数 */
const FRUITS = [
    { name: '葡萄',    radius: 16,  color: '#9B59B6', score: 2,   folder: 'images/level0/',  prefix: '0-idle-',  frames: 5 },
    { name: '樱桃',    radius: 24,  color: '#E74C3C', score: 6,   folder: 'images/level1/',  prefix: '1-idle-',  frames: 5 },
    { name: '橘子',    radius: 32,  color: '#F39C12', score: 12,  folder: 'images/level2/',  prefix: '2-idle-',  frames: 5 },
    { name: '柠檬',    radius: 40,  color: '#F1C40F', score: 20,  folder: 'images/level3/',  prefix: '3-idle-',  frames: 5 },
    { name: '猕猴桃',  radius: 48,  color: '#8BC34A', score: 30,  folder: 'images/level4/',  prefix: '4-idle-',  frames: 5 },
    { name: '番茄',    radius: 54,  color: '#E67E22', score: 42,  folder: 'images/level5/',  prefix: '5-idle-',  frames: 5 },
    { name: '桃子',    radius: 60,  color: '#FFB6C1', score: 56,  folder: 'images/level6/',  prefix: '6-idle-',  frames: 5 },
    { name: '菠萝',    radius: 66,  color: '#FFD700', score: 72,  folder: 'images/level7/',  prefix: '7-idle-',  frames: 5 },
    { name: '椰子',    radius: 72,  color: '#D2691E', score: 64,  folder: 'images/level8/',  prefix: '8-idle-',  frames: 5 },
    { name: '半个西瓜', radius: 78, color: '#2ECC71', score: 70, folder: 'images/level9/',  prefix: '9-idle-',  frames: 5 },
    { name: '大西瓜',  radius: 84, color: '#27AE60', score: 76, folder: 'images/level10/', prefix: '10-idle-', frames: 5 }
];

/** 动画参数 */
const ANIM = {
    frameDuration: 50,     // 每帧显示多少毫秒
    loopDelay: 2000        // 一轮动画播放完后停多少毫秒
};

// ============================================================
//  游戏状态
// ============================================================

let engine;
let world;
let fruits = [];          // { body, level, animationOffset }
let score = 0;
let gameOver = false;
let currentFruitLevel = 0; // 当前待放置水果等级
let nextFruitLevel = 0;    // 下一个要放置的水果等级

/** 危险线判定相关 */
let dangerLineY = 150;
let dangerTime = 0;
let dangerCooldownStart = 0;
let gameOverAnimating = false; // 游戏结束动画中
let gameOverExplodeIndex = 0; // 当前爆炸水果索引
let gameOverExplodeTime = 0; // 上次爆炸时间

// ============================================================
//  资源加载状态
// ============================================================

let fruitAnimations = []; // 每个等级的动画帧数组 [ [frame0,...], ... ]
let mergeEffects = [];
let imagesReady = false;
let debugLoadStatus = '';

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
        for (let i = 0; i < FRUITS.length; i++) {
            this.voiceVariants[i] = 1; // 每个等级 1 个语音变种（试用）
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
        this._playBufDirect(buf, opts);
    },

    _playBufDirect(buf, opts = {}) {
        if (!this.ctx || !buf) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        let source = this.ctx.createBufferSource();
        source.buffer = buf;
        let gain = this.ctx.createGain();
        source.playbackRate.value = opts.rate || 1;
        gain.gain.value = opts.volume != null ? opts.volume : 1;
        source.connect(gain);
        gain.connect(this.ctx.destination);
        if (opts.duration != null) {
            source.start(0, 0, opts.duration);
        } else {
            source.start(0);
        }
    },

    // ---------- 语音加载 ----------

    _loadVoiceLevel(level) {
        if (!this._voiceBufs[level]) this._voiceBufs[level] = [];
        let count = VOICE_CFG.voiceVariants[level] || 0;
        for (let v = 0; v < count; v++) {
            let url = 'sound/level' + level + '/level' + level + '-' + v + '.mp3';
            let idx = v;
            fetch(url)
                .then(res => res.arrayBuffer())
                .then(buf => this.ctx.decodeAudioData(buf))
                .then(audioBuf => { this._voiceBufs[level][idx] = audioBuf; })
                .catch(() => {});
        }
    },

    _pickVoice(level) {
        let bufs = this._voiceBufs[level];
        if (!bufs || bufs.length === 0) return null;
        let valid = bufs.filter(b => !!b);
        if (valid.length === 0) return null;
        return valid[floor(random(valid.length))];
    },

    // ---------- 释放音效 ----------

    playDrop(level) {
        if (random() < VOICE_CFG.voiceChance) {
            let buf = this._pickVoice(level);
            if (buf) { this._playBufDirect(buf, { duration: 1.5 }); return; }
        }
        this.play('falling', { duration: 1 });
    },

    // ---------- 合成音效队列 ----------

    _mergeQueue: [],
    _mergeTimerId: null,
    _mergeDelay: 120,

    playMerge(newLevel) {
        this._mergeQueue.push(newLevel);
        if (this._mergeQueue.length === 1) this._playNextMerge();
    },

    _playNextMerge() {
        if (this._mergeQueue.length === 0) return;
        let level = this._mergeQueue.shift();

        let buf = this._pickVoice(level);
        if (buf) {
            this._playBufDirect(buf, { rate: map(level, 1, 10, 0.85, 1.3), duration: 2 });
        } else {
            this.play('merge', { rate: map(level, 1, 10, 0.7, 2.2) });
        }

        if (this._mergeQueue.length > 0) {
            this._mergeTimerId = setTimeout(() => this._playNextMerge(), this._mergeDelay);
        }
    }
};

// ============================================================
//  动画系统
// ============================================================

/**
 * 基于真实时间计算当前动画帧索引，保证不同帧率设备效果一致
 * @param {Array} frames - 动画帧数组
 * @param {number} offset - 毫秒偏移，让不同水果异步播放
 * @returns {number} 当前应显示的帧索引
 */
function getAnimationFrameIndex(frames, offset = 0) {
    let totalFrames = frames.length;
    if (totalFrames === 0) return 0;

    let duration = totalFrames * ANIM.frameDuration;
    let cycleLength = duration + ANIM.loopDelay;
    let t = (millis() + offset) % cycleLength;

    if (t < duration) {
        return floor(t / ANIM.frameDuration) % totalFrames;
    } else {
        return totalFrames - 1; // 停顿期间停在最后一帧（即复制的第0帧）
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
    createCanvas(GAME_WIDTH, GAME_HEIGHT);

    SoundManager.init();
    SoundManager.load('falling', 'sound/falling.wav');
    SoundManager.load('merge', 'sound/bubble.wav');
    SoundManager.load('gameover', 'sound/gameover.wav');

    // 加载各等级语音音效
    for (let i = 0; i < FRUITS.length; i++) {
        SoundManager._loadVoiceLevel(i);
    }

    // ---------- 加载水果动画帧 ----------
    let totalToLoad = 0;
    let loadedCount = 0;
    let perLevelLoaded = [];
    let perLevelExpected = [];

    for (let i = 0; i < FRUITS.length; i++) {
        let expected = FRUITS[i].frames;
        perLevelExpected[i] = expected;
        perLevelLoaded[i] = 0;
        fruitAnimations[i] = new Array(expected).fill(null);
        totalToLoad += expected;
    }

    for (let levelIndex = 0; levelIndex < FRUITS.length; levelIndex++) {
        let fruitInfo = FRUITS[levelIndex];

        for (let frameIdx = 0; frameIdx < fruitInfo.frames; frameIdx++) {
            let imgPath = fruitInfo.folder + fruitInfo.prefix + frameIdx + '.png';

            // IIFE 捕获当前 level/frame 值，避免异步回调闭包问题
            (function (level, fIdx, expected) {
                loadImage(
                    imgPath,
                    (img) => {
                        fruitAnimations[level][fIdx] = img; // 按正确位置插入，不依赖加载顺序
                        loadedCount++;
                        perLevelLoaded[level]++;

                        // 该等级全部帧加载完：末尾追加第0帧副本（实现无缝循环）
                        if (perLevelLoaded[level] === expected) {
                            fruitAnimations[level].push(fruitAnimations[level][0]);
                        }

                        if (loadedCount === totalToLoad) {
                            imagesReady = true;
                            debugLoadStatus = 'All ' + totalToLoad + ' frames loaded!';
                        }
                    },
                    (err) => {
                        debugLoadStatus = 'Failed: ' + imgPath;
                        loadedCount++;
                        perLevelLoaded[level]++;
                        if (perLevelLoaded[level] === expected) {
                            fruitAnimations[level].push(fruitAnimations[level][0]);
                        }
                        if (loadedCount === totalToLoad) {
                            imagesReady = true;
                        }
                    }
                );
            })(levelIndex, frameIdx, fruitInfo.frames);
        }
    }

    // ---------- 物理引擎 ----------
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = PHYSICS.gravity;

    // 创建左、右、底三面墙壁
    let leftWall = Bodies.rectangle(WALL_THICKNESS / 2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, { isStatic: true });
    let rightWall = Bodies.rectangle(GAME_WIDTH - WALL_THICKNESS / 2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, { isStatic: true });
    let bottomWall = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - WALL_THICKNESS / 2, GAME_WIDTH, WALL_THICKNESS, { isStatic: true });
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

/** 主循环：更新物理 → 绘制画面 → 检测结束 */
function draw() {
    Engine.update(engine, 1000 / 60);

    background('#FFE5B4');

    drawWalls();
    drawDangerLine();
    drawFruits();
    drawMergeEffects();
    drawCurrentFruit();
    drawUI();

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
    noStroke();
    fill('#8B4513');
    rect(0, 0, WALL_THICKNESS, GAME_HEIGHT);
    rect(GAME_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, GAME_HEIGHT);
    rect(0, GAME_HEIGHT - WALL_THICKNESS, GAME_WIDTH, WALL_THICKNESS);
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

/** 绘制所有已落下的水果（含动画） */
function drawFruits() {
    for (let i = 0; i < fruits.length; i++) {
        let fruit = fruits[i];
        if (gameOverAnimating && i < gameOverExplodeIndex) continue; // 爆炸过的不绘制
        let pos = fruit.body.position;
        let level = fruit.level;

        push();
        translate(pos.x, pos.y);
        rotate(fruit.body.angle);

        let fruitInfo = FRUITS[level];
        let frames = fruitAnimations[level];
        let frameIndex = getAnimationFrameIndex(frames, fruit.animationOffset || 0);
        let img = frames ? frames[frameIndex] : null;

        if (img) {
            imageMode(CENTER);
            image(img, 0, 0, fruitInfo.radius * 2.2, fruitInfo.radius * 2.2);
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
    let x = constrain(mouseX, WALL_THICKNESS + fruitInfo.radius, GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius);
    let y = 50;
    let frames = fruitAnimations[currentFruitLevel];
    let frameIndex = getAnimationFrameIndex(frames, previewOffset1);
    let img = frames ? frames[frameIndex] : null;

    push();

    if (img) {
        imageMode(CENTER);
        tint(255, 180);
        image(img, x, y, fruitInfo.radius * 2.2, fruitInfo.radius * 2.2);
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
    fill(0);
    noStroke();
    textSize(20);
    textAlign(LEFT, TOP);
    text('分数: ' + score, 10, 10);

    // 调试信息
    textSize(12);
    fill(255, 0, 0);
    text(debugLoadStatus, 10, 40);
    let info = '';
    for (let i = 0; i < 3 && i < fruitAnimations.length; i++) {
        info += 'Level' + i + ': ' + (fruitAnimations[i] ? fruitAnimations[i].length : 0) + '  ';
    }
    text(info, 10, 55);

    textSize(20);
    fill(0);

    // 下一个水果预览
    textAlign(RIGHT, TOP);
    let nextFruitInfo = FRUITS[nextFruitLevel];
    let nextFrames = fruitAnimations[nextFruitLevel];
    let frameIndex = getAnimationFrameIndex(nextFrames, previewOffset2);
    let nextImg = nextFrames ? nextFrames[frameIndex] : null;
    if (nextImg) {
        imageMode(CENTER);
        image(nextImg, GAME_WIDTH - 30, 25, 20, 20);
    } else {
        fill(nextFruitInfo.color);
        ellipse(GAME_WIDTH - 30, 25, 20);
    }
    fill(0);
    text('下一个', GAME_WIDTH - 50, 20);

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
    let x = constrain(mouseX, WALL_THICKNESS + fruitInfo.radius, GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius);

    let body = Bodies.circle(x, 50, fruitInfo.radius, {
        restitution: PHYSICS.restitution,
        friction: PHYSICS.friction,
        density: PHYSICS.density
    });

    Composite.add(world, body);
    fruits.push({ body, level: currentFruitLevel, animationOffset: Math.floor(Math.random() * 3000) });

    SoundManager.playDrop(currentFruitLevel);

    currentFruitLevel = nextFruitLevel;
    nextFruitLevel = getRandomInitialLevel();

    lastDropTime = now;
}

// ============================================================
//  合成系统
// ============================================================

/**
 * 碰撞回调：检测两个相同等级水果碰撞，触发合成
 * 使用 processedFruits 避免同一帧内重复合成
 */
function handleCollision(event) {
    if (gameOver) return;

    let pairs = event.pairs;
    let processedFruits = new Set();

    for (let pair of pairs) {
        let bodyA = pair.bodyA;
        let bodyB = pair.bodyB;

        if (processedFruits.has(bodyA.id) || processedFruits.has(bodyB.id)) {
            continue;
        }

        let fruitA = fruits.find(f => f.body === bodyA);
        let fruitB = fruits.find(f => f.body === bodyB);

        if (fruitA && fruitB && fruitA.level === fruitB.level) {
            let level = fruitA.level;

            // 已是最高等级则不再合成
            if (level >= FRUITS.length - 1) continue;

            let newLevel = level + 1;
            let newPos = {
                x: (fruitA.body.position.x + fruitB.body.position.x) / 2,
                y: (fruitA.body.position.y + fruitB.body.position.y) / 2
            };

            processedFruits.add(bodyA.id);
            processedFruits.add(bodyB.id);

            // 移除两个旧水果
            Composite.remove(world, fruitA.body);
            Composite.remove(world, fruitB.body);
            fruits = fruits.filter(f => f.body !== fruitA.body && f.body !== fruitB.body);

            // 创建合成后的新水果
            let newFruitInfo = FRUITS[newLevel];
            let newBody = Bodies.circle(newPos.x, newPos.y, newFruitInfo.radius, {
                restitution: PHYSICS.restitution,
                friction: PHYSICS.friction,
                density: PHYSICS.density
            });
            Composite.add(world, newBody);
            fruits.push({ body: newBody, level: newLevel, animationOffset: Math.floor(Math.random() * 3000) });

            score += newFruitInfo.score;

            // 合成特效
            mergeEffects.push({
                x: newPos.x, y: newPos.y,
                radius: newFruitInfo.radius,
                alpha: 255, expanding: true
            });

            SoundManager.playMerge(newLevel);
        }
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
        ellipse(effect.x, effect.y, effect.radius * 2);
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
        let fruitTop = fruit.body.position.y - FRUITS[fruit.level].radius;
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
    mergeEffects = [];
    score = 0;
    gameOver = false;
    gameOverAnimating = false;
    gameOverExplodeIndex = 0;
    gameOverExplodeTime = 0;
    dangerTime = 0;
    dangerCooldownStart = 0;
    lastDropTime = 0;

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
