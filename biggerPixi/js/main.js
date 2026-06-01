/**
 * 渲染主入口
 * 负责 PixiJS 渲染、用户输入、UI 元素管理
 */

import { Application, Container, Sprite, Graphics, Text, TextStyle, Texture, Rectangle, Assets } from 'pixi.js';
import {
    PANEL_WIDTH, PANEL_HEIGHT, GAME_WIDTH, GAME_HEIGHT,
    GAME_OFFSET_X, GAME_OFFSET_Y, WALL_THICKNESS,
    FRUITS, ANIM, SKILLS, BOOP_FRAMES, BOOP_FRAME_DURATION,
    formatScore, formatTime, getAnimationFrameIndex, PHYSICS
} from './config.js';
import { Game } from './game.js';
import { soundManager } from './audio.js';
import { loadRecords, saveRecord, getRecordRank, isNewRecord, renderRecordsTable } from './records.js';
import { loadingManager } from './loading.js';
import { loadingBg } from './loadingBg.js';

/** -------------------- 全局变量 -------------------- */

let app, game;
let panelSprite, frontSprite;
let spritesheetTexture, boopTexture, ufoTexture;
let fruitTextures = [];
let frameW = 0, frameH = 0;
let boopFrameH = 0;
let boopSubTextures = [];

let ufoSummonEl;
let ufoSummonVx = 0, ufoSummonVy = 0;
let ufoSpawnTime = 0;
let ufoFlyingAway = false;
let ufoPaused = false;
let ufoPauseTime = 0;
let ufoFlyingTime = 0;
let ufoFloatAnim = null;
let ufoOffScreen = false;
let ufoOffScreenTime = 0;
let ufoLastFromLeft = false;
const UFO_FLY_DURATION = 60000;
const UFO_PAUSE_TIMEOUT = 300000;
const UFO_OFFSCREEN_DELAY = 1800;
const UFO_BASE_SPEED = 5;
const UFO_V_DRIFT_RATIO = 0.25;

let gameContainer, fruitContainer, effectContainer;
let currentFruitSprite, currentFruitContainer;
let dangerLineGfx, dangerCountText;
let dropGuideLineGfx;
let scoreText, timerText, pauseBtnContainer;
let ufoBtn;
let ufoShadowGfx;
let ufoArcGfx;
let skillBtnContainer;
let levelIconsContainer;
let previewSprite;
let previewPrevLevel = -1;
let previewAnimStartTime = 0;
let currentPrevLevel = -1;
let currentAnimStartTime = 0;
const PREVIEW_ANIM_SHRINK = 80;
const PREVIEW_ANIM_GROW = 120;
const PREVIEW_ANIM_MIN = 0.3;
const PREVIEW_ANIM_MAX = 1.15;
const PREVIEW_DISPLAY_SIZE = 40;
let fruitSprites = new Map();

let pointerPos = { x: PANEL_WIDTH / 2, y: 0 };
let pauseBtnRect = { x: 0, y: 0, w: 26, h: 24 };
let skillBtnHover = { ufo: false };

const previewOffset1 = Math.floor(Math.random() * 3000);
const previewOffset2 = Math.floor(Math.random() * 3000);

/** -------------------- 资源加载与初始化 -------------------- */

async function loadSprite(url) {
    const tex = await Assets.load(url);
    return new Sprite(tex);
}

/** -------------------- 场景 & UI 构建 -------------------- */

function buildScene() {
    app.stage.addChild(panelSprite);

    gameContainer = new Container();
    gameContainer.x = GAME_OFFSET_X;
    gameContainer.y = GAME_OFFSET_Y;
    app.stage.addChild(gameContainer);

    fruitContainer = new Container();
    gameContainer.addChild(fruitContainer);

    effectContainer = new Container();
    gameContainer.addChild(effectContainer);

    dangerLineGfx = new Graphics();
    gameContainer.addChild(dangerLineGfx);

    currentFruitContainer = new Container();
    gameContainer.addChild(currentFruitContainer);

    currentFruitSprite = new Sprite(fruitTextures[0][0]);
    currentFruitSprite.anchor.set(0.5);
    currentFruitContainer.addChild(currentFruitSprite);

    dropGuideLineGfx = new Graphics();
    gameContainer.addChild(dropGuideLineGfx);

    frontSprite.x = 0;
    frontSprite.y = 0;
    frontSprite.width = GAME_WIDTH;
    frontSprite.height = GAME_HEIGHT;
    gameContainer.addChild(frontSprite);

    const dangerStyle = new TextStyle({
        fontFamily: 'FusionPixel, sans-serif',
        fontSize: 32,
        fill: '#ff0000'
    });
    dangerCountText = new Text({ text: '', style: dangerStyle });
    dangerCountText.anchor.set(0.5);
    dangerCountText.visible = false;
    gameContainer.addChild(dangerCountText);

    buildUI();
    buildSkillButtons();
    buildLevelIcons();
    buildUfoSummon();
}

function buildUI() {
    const barY = -12;
    const boxH = 24;
    const boxW = 46;
    const margin = 4;

    const textStyle = new TextStyle({
        fontFamily: 'FusionPixel, sans-serif',
        fontSize: 16,
        fill: '#ffffff',
        // stroke: { color: '#000000', width: 1 },
        align: 'center'
    });

    const textCenterY = barY + boxH / 2;

    // --- 顶部背景条 ---
    const timeShadow = new Graphics();
    timeShadow.roundRect(0, barY - 2 + 6, 56, boxH + 4, 4);
    timeShadow.fill({ color: 0x000000, alpha: 0.1 });
    gameContainer.addChild(timeShadow);

    const timeBg = new Graphics();
    timeBg.roundRect(0, barY - 2, 56, boxH + 4, 4);
    timeBg.fill({ color: 0x9ddef6 });
    timeBg.roundRect(0, barY - 2, 56, boxH + 4, 4);
    timeBg.stroke({ color: 0xffffff, width: 4 });
    gameContainer.addChild(timeBg);

    const scoreShadow = new Graphics();
    scoreShadow.roundRect(GAME_WIDTH / 2 - 36, barY - 2 + 6, 72, boxH + 4, 4);
    scoreShadow.fill({ color: 0x000000, alpha: 0.1 });
    gameContainer.addChild(scoreShadow);

    const scoreBg = new Graphics();
    scoreBg.roundRect(GAME_WIDTH / 2 - 36, barY - 2, 72, boxH + 4, 4);
    scoreBg.fill({ color: 0xfab545 });
    scoreBg.roundRect(GAME_WIDTH / 2 - 36, barY - 2, 72, boxH + 4, 4);
    scoreBg.stroke({ color: 0xffffff, width: 4 });
    gameContainer.addChild(scoreBg);

    const pauseShadow = new Graphics();
    pauseShadow.roundRect(GAME_WIDTH - margin - boxW - 2, barY - 2 + 6, boxW + 4, boxH + 4, 4);
    pauseShadow.fill({ color: 0x000000, alpha: 0.1 });
    gameContainer.addChild(pauseShadow);

    const pauseBg = new Graphics();
    pauseBg.roundRect(GAME_WIDTH - margin - boxW - 2, barY - 2, boxW + 4, boxH + 4, 4);
    pauseBg.fill({ color: 0xbcb5ff });
    pauseBg.roundRect(GAME_WIDTH - margin - boxW - 2, barY - 2, boxW + 4, boxH + 4, 4);
    pauseBg.stroke({ color: 0xffffff, width: 4 });
    gameContainer.addChild(pauseBg);

    // --- 左侧：时间 ---
    // const clockGfx = new Graphics();
    // const cx = margin, cy = barY + boxH / 2;
    // clockGfx.circle(cx, cy, 6);
    // clockGfx.fill({ color: 0xffffff });
    // clockGfx.stroke({ color: 0x6f6f6f, width: 2, alpha: 0.6 });
    // clockGfx.moveTo(cx, cy);
    // clockGfx.lineTo(cx, cy - 3);
    // clockGfx.moveTo(cx, cy);
    // clockGfx.lineTo(cx + 3, cy);
    // clockGfx.stroke({ color: 0x6f6f6f, width: 2, alpha: 0.6 });
    // gameContainer.addChild(clockGfx);

    timerText = new Text({ text: '0:00', style: textStyle });
    timerText.anchor.set(0, 0.5);
    timerText.x = margin + 10;
    timerText.y = textCenterY - 2;
    gameContainer.addChild(timerText);

    // --- 中间：分数 ---
    scoreText = new Text({ text: '0', style: textStyle });
    scoreText.anchor.set(0.5, 0.5);
    scoreText.x = GAME_WIDTH / 2;
    scoreText.y = textCenterY - 2;
    gameContainer.addChild(scoreText);

    // --- 右侧：暂停按钮 ---
    const pauseX = GAME_WIDTH - margin - boxW;

    pauseBtnRect.x = pauseX;
    pauseBtnRect.y = barY;
    pauseBtnRect.w = boxW;
    pauseBtnRect.h = boxH;

    pauseBtnContainer = new Container();
    pauseBtnContainer.x = pauseX;
    pauseBtnContainer.y = barY;

    const pauseGfx = new Graphics();
    const barW = 4, barH = 14, gap = 5, radius = 0;
    const barsCenterX = boxW / 2;
    const leftBarX = barsCenterX - gap / 2 - barW;
    const rightBarX = barsCenterX + gap / 2;
    const barYPos = (boxH - barH) / 2;

    // 描边层（底层）
    const borderGfx = new Graphics();
    borderGfx.roundRect(leftBarX, barYPos, barW, barH, radius);
    borderGfx.roundRect(rightBarX, barYPos, barW, barH, radius);
    borderGfx.stroke({ color: 0x6f6f6f, width: 1, alpha: 0.6 });
    pauseBtnContainer.addChild(borderGfx);

    // 填充层（顶层）
    pauseGfx.roundRect(leftBarX, barYPos, barW, barH, radius);
    pauseGfx.roundRect(rightBarX, barYPos, barW, barH, radius);
    pauseGfx.fill({ color: 0xffffff });
    pauseBtnContainer.addChild(pauseGfx);

    gameContainer.addChild(pauseBtnContainer);
}

function buildSkillButtons() {
    skillBtnContainer = new Container();
    app.stage.addChild(skillBtnContainer);

    const circleD = 62;
    const startX = (PANEL_WIDTH - circleD) / 2;

    ufoBtn = createCircleSkillButton(startX, SKILLS.btnY, circleD, '#fab545');

    ufoShadowGfx = new Graphics();
    skillBtnContainer.addChild(ufoShadowGfx);

    ufoArcGfx = new Graphics();
    ufoArcGfx.x = startX;
    ufoArcGfx.y = SKILLS.btnY;
    skillBtnContainer.addChild(ufoArcGfx);

    skillBtnContainer.addChild(ufoBtn.container);
}

function createCircleSkillButton(x, y, d, accentColor) {
    const r = d / 2;
    const container = new Container();
    container.x = x;
    container.y = y;

    const bg = new Graphics();
    container.addChild(bg);

    const highlight = new Graphics();
    highlight.circle(r, r, r - 4);
    highlight.fill({ color: 0xffffff, alpha: 0.04 });
    container.addChild(highlight);

    const iconSize = d * 0.48;
    const ufoIcon = new Sprite(ufoTexture);
    ufoIcon.anchor.set(0.5);
    ufoIcon.x = r;
    ufoIcon.y = r;
    ufoIcon.width = iconSize;
    ufoIcon.height = iconSize;
    ufoIcon.tint = 0xffffff;
    container.addChild(ufoIcon);

    const slash = new Graphics();
    container.addChild(slash);

    const maxUses = SKILLS.ufoMaxUses;

    return {
        container, bg, highlight, ufoIcon, slash,
        maxUses, r,
        x, y, w: d, h: d, accentColor, isCircle: true
    };
}

function createSkillButton(x, y, w, h, drawIcon, label, accentColor) {
    const container = new Container();
    container.x = x;
    container.y = y;

    const shadow = new Graphics();
    shadow.roundRect(0, 4, w, h, 8);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    container.addChild(shadow);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    container.addChild(bg);

    const highlight = new Graphics();
    highlight.roundRect(3, 3, w - 6, h / 2 - 6, 5);
    highlight.fill({ color: 0xffffff, alpha: 0.08 });
    container.addChild(highlight);

    const iconGfx = new Graphics();
    iconGfx._w = w;
    iconGfx._h = h;
    drawIcon(iconGfx);
    container.addChild(iconGfx);

    const labelStyle = new TextStyle({
        fontFamily: 'FusionPixel, sans-serif',
        fontSize: 12,
        fill: '#ffffff'
    });
    const labelText = new Text({ text: label, style: labelStyle });
    labelText.anchor.set(0.5, 1);
    labelText.x = w / 2;
    labelText.y = h - 6;
    container.addChild(labelText);

    const bar = new Graphics();
    bar.y = -5;
    container.addChild(bar);

    const goldBorder = new Graphics();
    container.addChild(goldBorder);

    return { container, shadow, bg, highlight, iconGfx, labelText, bar, goldBorder, x, y, w, h, accentColor, label };
}

// 外星人召唤按钮
function buildUfoSummon() {
    ufoSummonEl = document.createElement('img');
    ufoSummonEl.src = 'images/0-ufo.png';
    ufoSummonEl.style.cssText = 'position:fixed;width:64px;height:64px;display:none;z-index:999;';
    ufoSummonEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!game || !game.ufoSummoned || ufoFlyingAway) return;

        if (!ufoPaused) {
            ufoPaused = true;
            ufoPauseTime = performance.now();
            ufoSummonVx = 0;
            ufoSummonVy = 0;

            soundManager.playAlienVoice();

            _startUfoFloat();
        } else {
            _resetUfoFloat();
            game.activateAlien();
            ufoFlyingAway = true;
            ufoSummonEl.style.transition = 'top 0.3s ease-in, opacity 0.3s ease-in';
            ufoSummonEl.style.top = '-100px';
            ufoSummonEl.style.opacity = '0';
            setTimeout(() => {
                ufoSummonEl.style.transition = '';
                ufoSummonEl.style.opacity = '1';
                ufoSummonEl.style.display = 'none';
                ufoFlyingAway = false;
                ufoPaused = false;
            }, 300);
        }
    });
    document.body.appendChild(ufoSummonEl);
}

// 头像列表
function buildLevelIcons() {
    levelIconsContainer = new Container();
    app.stage.addChild(levelIconsContainer);

    const iconSize = 32;
    const totalWidth = FRUITS.length * iconSize;
    const margin = (PANEL_WIDTH - totalWidth) / 2;
    const y = GAME_HEIGHT + 175;

    for (let i = 0; i < FRUITS.length; i++) {
        const x = margin + iconSize / 2 + i * iconSize;
        const icon = new Sprite(fruitTextures[i][0]);
        icon.anchor.set(0.5);
        icon.x = x;
        icon.y = y;
        icon.width = iconSize;
        icon.height = iconSize;
        levelIconsContainer.addChild(icon);
    }
}

/** -------------------- 输入事件 -------------------- */

function setupInput() {
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('pointermove', (e) => {
        pointerPos.x = e.global.x;
        pointerPos.y = e.global.y;
    });

    app.stage.on('pointerdown', (e) => {
        pointerPos.x = e.global.x;
        pointerPos.y = e.global.y;

        if (!game || game.gameOver || !game.started) return;

        updateSkillBtnHover(e.global);

        if (skillBtnHover.ufo) {
            const canUse = game.ufoUsesLeft > 0 && !game.ufoActive;
            if (!canUse) return;

            const container = ufoBtn.container;
            gsap.to(container, {
                y: ufoBtn.y + 6,
                duration: 0.08,
                ease: 'power2.in',
                onComplete: () => {
                    gsap.to(container, {
                        y: ufoBtn.y,
                        duration: 0.15,
                        ease: 'power2.out'
                    });
                }
            });
            soundManager.play('alien');
            game.activateUFO();
            return;
        }

        const local = gameContainer.toLocal(e.global);
        if (isInsidePauseBtn(local.x, local.y)) {
            soundManager.playButton();
            game.togglePause();
            const pauseScreen = document.getElementById('pause-screen');
            if (game.paused) {
                pauseScreen.classList.remove('hidden');
            } else {
                pauseScreen.classList.add('hidden');
            }
            return;
        }

        game.dropFruit(local.x);
    });
}

function updateSkillBtnHover(globalPos) {
    if (!ufoBtn) return;
    const ufoLocal = ufoBtn.container.toLocal(globalPos);
    skillBtnHover.ufo = ufoLocal.x >= 0 && ufoLocal.x <= ufoBtn.w && ufoLocal.y >= 0 && ufoLocal.y <= ufoBtn.h;
}

function isInsidePauseBtn(localX, localY) {
    return localX >= pauseBtnRect.x && localX <= pauseBtnRect.x + pauseBtnRect.w &&
        localY >= pauseBtnRect.y && localY <= pauseBtnRect.y + pauseBtnRect.h;
}

/** -------------------- 渲染更新 -------------------- */

function updateFruitSprites() {
    const now = performance.now();
    const activeIds = new Set();

    let maxLevel = -1;
    for (const fruit of game.fruits) {
        if (game.gameOverAnimating && game.fruits.indexOf(fruit) < game.gameOverExplodeIndex) continue;
        if (fruit.level > maxLevel) maxLevel = fruit.level;
    }

    for (const fruit of game.fruits) {
        if (game.gameOverAnimating && game.fruits.indexOf(fruit) < game.gameOverExplodeIndex) continue;

        activeIds.add(fruit.body.id);
        let sprite = fruitSprites.get(fruit.body.id);

        if (!sprite) {
            sprite = new Sprite(fruitTextures[fruit.level][0]);
            sprite.anchor.set(0.5);
            fruitContainer.addChild(sprite);
            fruitSprites.set(fruit.body.id, sprite);
        }

        const state = fruit.state || 'idle';
        const ufoFace = game.ufoActive && fruit.level < maxLevel;
        const frameIdx = (state === 'hit' || ufoFace) ? 4 : getAnimationFrameIndex(now, fruit.animationOffset);
        const texture = fruitTextures[fruit.level][frameIdx];
        sprite.texture = texture;

        const baseScale = (FRUITS[fruit.level].radius * 2.2) / texture.width;
        sprite.x = fruit.body.position.x - GAME_OFFSET_X;
        sprite.y = fruit.body.position.y - GAME_OFFSET_Y;
        sprite.rotation = fruit.body.angle;

        let mergeScale = 1;
        const mst = fruit.mergeAnimStartTime;
        if (mst) {
            const elapsed = now - mst;
            const shrinkTotal = ANIM.mergeScaleShrinkDuration;
            const growTotal = ANIM.mergeScaleGrowDuration;
            const total = shrinkTotal + growTotal;
            if (elapsed < total) {
                if (elapsed < shrinkTotal) {
                    mergeScale = 1 - Math.min(elapsed / shrinkTotal, 1) * (1 - ANIM.mergeScaleMin);
                } else {
                    mergeScale = ANIM.mergeScaleMax - (ANIM.mergeScaleMax - 1) * Math.min((elapsed - shrinkTotal) / growTotal, 1);
                }
            }
        }
        sprite.scale.set(baseScale * mergeScale);
    }

    for (const [id, sprite] of fruitSprites) {
        if (!activeIds.has(id)) {
            fruitContainer.removeChild(sprite);
            fruitSprites.delete(id);
        }
    }
}

function updateMergeEffects() {
    effectContainer.removeChildren();
    const now = performance.now();

    for (let i = game.mergeEffects.length - 1; i >= 0; i--) {
        const effect = game.mergeEffects[i];
        const elapsed = now - effect.startTime;
        const totalDuration = BOOP_FRAMES * BOOP_FRAME_DURATION;

        if (elapsed >= totalDuration) {
            game.mergeEffects.splice(i, 1);
            continue;
        }

        const frame = Math.min(Math.floor(elapsed / BOOP_FRAME_DURATION), BOOP_FRAMES - 1);
        if (boopSubTextures[frame]) {
            const boopSprite = new Sprite(boopSubTextures[frame]);
            boopSprite.anchor.set(0.5);
            boopSprite.x = effect.x - GAME_OFFSET_X;
            boopSprite.y = effect.y - GAME_OFFSET_Y;
            const drawSize = effect.radius * 4;
            boopSprite.width = drawSize;
            boopSprite.height = drawSize;
            effectContainer.addChild(boopSprite);
        }
    }
}

function updateDangerLine() {
    dangerLineGfx.clear();
    if (!game) return;

    const isDanger = game.IsInDanger;
    const alpha = isDanger ? 0.8 + 0.2 * Math.sin(performance.now() * 0.006) : 0.4;
    const y = game.dangerLineY;
    const dashLen = 6;
    const gapLen = 4;

    for (let x = WALL_THICKNESS; x < GAME_WIDTH - WALL_THICKNESS; x += dashLen + gapLen) {
        const endX = Math.min(x + dashLen, GAME_WIDTH - WALL_THICKNESS);
        dangerLineGfx.moveTo(x, y);
        dangerLineGfx.lineTo(endX, y);
    }
    dangerLineGfx.stroke({ color: 0xff0000, alpha, width: isDanger ? 3 : 2 });

    dangerCountText.visible = false;
    if (isDanger) {
        const remaining = game.DangerRemaining;
        if (remaining > 0) {
            dangerCountText.text = String(Math.ceil(remaining));
            dangerCountText.x = GAME_WIDTH / 2;
            dangerCountText.y = game.dangerLineY - 30;
            dangerCountText.alpha = remaining < 1.5 ? 0.4 + 0.6 * (remaining / 1.5) : 1;
            dangerCountText.visible = true;
        }
    }
}

function updateCurrentFruit() {
    if (!game || game.gameOver || !game.started || game.paused) {
        currentFruitContainer.visible = false;
        return;
    }
    currentFruitContainer.visible = true;

    const level = game.currentFruitLevel;
    const fruitInfo = FRUITS[level];
    let globalX = pointerPos.x;
    if (globalX === undefined) globalX = PANEL_WIDTH / 2;
    const local = gameContainer.toLocal({ x: globalX, y: 0 });
    let x = Math.max(WALL_THICKNESS + fruitInfo.radius, Math.min(GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius, local.x));
    const y = 80;
    const now = performance.now();
    const frameIdx = getAnimationFrameIndex(now, previewOffset1);
    const texture = fruitTextures[level][frameIdx];
    currentFruitSprite.texture = texture;

    if (level !== currentPrevLevel) {
        currentPrevLevel = level;
        currentAnimStartTime = now;
    }

    const elapsed = now - currentAnimStartTime;
    const total = PREVIEW_ANIM_SHRINK + PREVIEW_ANIM_GROW;
    let animScale = 1;

    if (elapsed < total) {
        if (elapsed < PREVIEW_ANIM_SHRINK) {
            animScale = 1 - Math.min(elapsed / PREVIEW_ANIM_SHRINK, 1) * (1 - PREVIEW_ANIM_MIN);
        } else {
            animScale = PREVIEW_ANIM_MAX - (PREVIEW_ANIM_MAX - 1) * Math.min((elapsed - PREVIEW_ANIM_SHRINK) / PREVIEW_ANIM_GROW, 1);
        }
    }

    const baseScale = (fruitInfo.radius * 2.2) / texture.width;
    currentFruitSprite.scale.set(baseScale * animScale);
    currentFruitSprite.x = x;
    currentFruitSprite.y = y;
}

function updateNextFruitPreview() {
    if (!game) return;
    const level = game.nextFruitLevel;
    const now = performance.now();
    const frameIdx = getAnimationFrameIndex(now, previewOffset2);

    if (!previewSprite) {
        previewSprite = new Sprite(fruitTextures[0][0]);
        previewSprite.anchor.set(0.5);
        previewSprite.x = GAME_WIDTH + 2;
        previewSprite.y = 55;
        gameContainer.addChild(previewSprite);
        previewPrevLevel = level;
    }

    if (level !== previewPrevLevel) {
        previewPrevLevel = level;
        previewAnimStartTime = now;
    }

    const texture = fruitTextures[level][frameIdx];
    previewSprite.texture = texture;

    const baseScale = PREVIEW_DISPLAY_SIZE / texture.width;
    const elapsed = now - previewAnimStartTime;
    const total = PREVIEW_ANIM_SHRINK + PREVIEW_ANIM_GROW;
    let animScale = 1;

    if (elapsed < total) {
        if (elapsed < PREVIEW_ANIM_SHRINK) {
            animScale = 1 - Math.min(elapsed / PREVIEW_ANIM_SHRINK, 1) * (1 - PREVIEW_ANIM_MIN);
        } else {
            animScale = PREVIEW_ANIM_MAX - (PREVIEW_ANIM_MAX - 1) * Math.min((elapsed - PREVIEW_ANIM_SHRINK) / PREVIEW_ANIM_GROW, 1);
        }
    }

    previewSprite.scale.set(baseScale * animScale);
}

function updateDropGuideLine() {
    dropGuideLineGfx.clear();
    if (!game || game.gameOver || !game.started || game.paused) return;

    const fruitInfo = FRUITS[game.currentFruitLevel];
    let globalX = pointerPos.x;
    if (globalX === undefined) globalX = PANEL_WIDTH / 2;
    const local = gameContainer.toLocal({ x: globalX, y: 0 });
    const x = Math.max(WALL_THICKNESS + fruitInfo.radius, Math.min(GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius, local.x));
    const minRadius = FRUITS[0].radius;
    const startY = 80 + minRadius;
    const endY = GAME_HEIGHT;
    const dashLen = 6;
    const gapLen = 4;

    for (let dy = startY; dy < endY; dy += dashLen + gapLen) {
        const segEndY = Math.min(dy + dashLen, endY);
        dropGuideLineGfx.moveTo(x, dy);
        dropGuideLineGfx.lineTo(x, segEndY);
    }
    dropGuideLineGfx.stroke({ color: 0xffffff, alpha: 0.4, width: 2 });
}

function updateUI() {
    if (!game) return;

    scoreText.text = formatScore(game.score);
    timerText.text = formatTime(game.getGameTimeSeconds());

    updateSkillBtnHover(pointerPos);

    pauseBtnContainer.alpha = 1;
}

function updateSkillButtonVisuals() {
    if (!game || game.gameOver || !game.started) {
        skillBtnContainer.visible = false;
        return;
    }
    skillBtnContainer.visible = true;

    drawSkillBtnVisual(ufoBtn, game.ufoUsesLeft, skillBtnHover.ufo, false, 0, 0, game.ufoActive);
}

// 绘制技能按钮
function drawSkillBtnVisual(btn, usesLeft, hovered, isCharging, chargeMax, chargeCur, ufoDisabled) {
    if (!btn) return;
    const active = usesLeft > 0 && !ufoDisabled;
    let bgColor;

    if (!active && !isCharging) {
        bgColor = 0x666666;
    } else if (isCharging && usesLeft === 0) {
        bgColor = 0x555555;
    } else {
        bgColor = active ? parseInt(btn.accentColor.replace('#', ''), 16) : 0x555555;
    }

    if (btn.isCircle) {
        const r = btn.w / 2;
        const accentNum = parseInt(btn.accentColor.replace('#', ''), 16);
        const hoverActive = hovered && active;

        const shadowCx = btn.x + r;
        const shadowCy = btn.y + r + 4;
        const shadowR = r + 2;
        ufoShadowGfx.clear();
        ufoShadowGfx.circle(shadowCx, shadowCy, shadowR);
        ufoShadowGfx.fill({ color: 0x000000, alpha: 0.1 });

        btn.bg.clear();
        btn.bg.circle(r, r, r);
        btn.bg.fill({ color: bgColor });
        btn.bg.circle(r, r, r);
        btn.bg.stroke({ color: 0xffffff, width: 4 });

        btn.highlight.alpha = hoverActive ? 0.80 : 0.06;

        btn.ufoIcon.alpha = !active && !isCharging ? 0.12 : 0.35;

        btn.slash.clear();
        if (!active && !isCharging) {
            const inset = r * 0.3;
            btn.slash.moveTo(inset, inset);
            btn.slash.lineTo(btn.w - inset, btn.h - inset);
            btn.slash.stroke({ color: 0xffffff, width: 4, alpha: 0.5 });
        }

        const dotR = 7;
        const dotGap = 14;
        const dotX = r * 2 + 10;

        ufoArcGfx.clear();
        for (let i = 0; i < btn.maxUses; i++) {
            const dotY = r - dotGap / 2 + i * dotGap;
            const filled = i >= btn.maxUses - usesLeft;

            ufoArcGfx.circle(dotX, dotY, dotR);
            ufoArcGfx.fill({ color: 0xffffff });

            ufoArcGfx.circle(dotX, dotY, dotR - 2.5);
            ufoArcGfx.fill({ color: filled ? 0xfab545 : 0x666666 });
        }
    } else {
        const iconAlpha = !active && !isCharging ? 0.4 : (isCharging && usesLeft === 0 ? 0.47 : 1);
        const textColor = !active && !isCharging ? '#aaaaaa' : (isCharging && usesLeft === 0 ? '#999999' : '#ffffff');

        btn.shadow.alpha = (hovered && active) ? 0.15 : 0.3;
        btn.bg.clear();
        btn.bg.roundRect(0, 0, btn.w, btn.h, 8);
        btn.bg.fill({ color: bgColor });
        btn.highlight.alpha = hovered && active ? 0.24 : 0.08;
        btn.iconGfx.alpha = iconAlpha;

        if (isCharging) {
            btn.labelText.text = chargeCur + '/' + chargeMax;
            btn.labelText.style.fill = textColor;
            btn.bar.clear();
            btn.bar.roundRect(4, 0, btn.w - 8, 3, 2);
            btn.bar.fill({ color: 0x000000, alpha: 0.24 });
            if (chargeMax > 0) {
                const progress = chargeCur / chargeMax;
                btn.bar.roundRect(4, 0, (btn.w - 8) * progress, 3, 2);
                btn.bar.fill({ color: parseInt(btn.accentColor.replace('#', ''), 16) });
            }
            btn.goldBorder.clear();
            if (usesLeft > 0) {
                btn.goldBorder.roundRect(-1, -1, btn.w + 2, btn.h + 2, 9);
                btn.goldBorder.stroke({ color: 0xffd700, width: 1.5 });
            }
        } else {
            btn.labelText.text = btn.label + '\u00D7' + usesLeft;
            btn.labelText.style.fill = textColor;
            btn.bar.clear();
            btn.goldBorder.clear();
        }
    }
}

function updateScorePopups() {
    if (!game || !game.scorePopups.length) return;

    const existingPopups = gameContainer.children.filter(c => c._isPopup);
    for (const p of existingPopups) {
        gameContainer.removeChild(p);
    }

    const now = performance.now();
    for (const popup of game.scorePopups) {
        const age = now - popup.startTime;
        if (age >= 1000) continue;
        const alpha = age < 600 ? 1 : Math.max(0, 1 - (age - 600) / 400);
        if (alpha <= 0) continue;

        const rise = (age / 800) * -30;
        const style = new TextStyle({
            fontFamily: 'FusionPixel, sans-serif',
            fontSize: 16,
            fill: popup.color,
            dropShadow: true,
            dropShadowColor: '#666666',
            dropShadowBlur: 1,
            dropShadowDistance: 2
        });
        const text = new Text({ text: formatScore(popup.amount), style });
        text.anchor.set(0.5, 0);
        text.x = GAME_WIDTH / 2;
        text.y = popup.baseY + rise;
        text.alpha = alpha;
        text._isPopup = true;
        gameContainer.addChild(text);
    }
}

/** -------------------- 主循环 & 初始化 -------------------- */

function _spawnUfoAtSide() {
    const elW = 64, elH = 64;
    const W = window.innerWidth, H = window.innerHeight;
    ufoLastFromLeft = !ufoLastFromLeft;
    const fromLeft = ufoLastFromLeft;

    const vx = UFO_BASE_SPEED + Math.random() * 2;
    const vyMax = vx * (UFO_V_DRIFT_RATIO * H / W);
    const vy = (Math.random() * 0.6 + 0.4) * vyMax * (Math.random() < 0.5 ? 1 : -1);

    const driftMargin = H * UFO_V_DRIFT_RATIO;
    const yMin = driftMargin;
    const yMax = H - elH - driftMargin;

    if (fromLeft) {
        ufoSummonEl.style.left = (-elW) + 'px';
        ufoSummonVx = Math.abs(vx);
    } else {
        ufoSummonEl.style.left = W + 'px';
        ufoSummonVx = -Math.abs(vx);
    }
    ufoSummonEl.style.top = (yMin + Math.random() * Math.max(0, yMax - yMin)) + 'px';
    ufoSummonVy = vy;
    ufoSummonEl.style.display = 'block';
    gsap.set(ufoSummonEl, { y: 0 });
}

function _resetUfoFloat() {
    if (ufoFloatAnim) { ufoFloatAnim.kill(); ufoFloatAnim = null; }
    gsap.set(ufoSummonEl, { y: 0 });
}

function _startUfoFloat() {
    _resetUfoFloat();
    ufoFloatAnim = gsap.timeline({ repeat: -1 });
    ufoFloatAnim
        .to(ufoSummonEl, { y: -8, duration: 2.5, ease: 'sine.inOut' })
        .to(ufoSummonEl, { y: 0, duration: 2.5, ease: 'sine.inOut' });
}

function updateUfoSummon() {
    if (!ufoSummonEl || !game) return;

    if (ufoFlyingAway) return;

    if (game.ufoSummoned) {
        if (ufoSummonEl.style.display === 'none' && !ufoOffScreen) {
            _spawnUfoAtSide();
            ufoSpawnTime = performance.now();
            ufoFlyingTime = 0;
            ufoFlyingAway = false;
            ufoPaused = false;
        }

        if (ufoPaused) {
            if (performance.now() - ufoPauseTime > UFO_PAUSE_TIMEOUT) {
                ufoSpawnTime = performance.now() - ufoFlyingTime;
                ufoPaused = false;
                _resetUfoFloat();
            } else {
                return;
            }
        }

        ufoFlyingTime = performance.now() - ufoSpawnTime;

        if (ufoFlyingTime > UFO_FLY_DURATION) {
            ufoFlyingAway = true;
            _resetUfoFloat();
            ufoSummonEl.style.transition = 'top 0.3s ease-in, opacity 0.3s ease-in';
            ufoSummonEl.style.top = '-100px';
            ufoSummonEl.style.opacity = '0';
            setTimeout(() => {
                ufoSummonEl.style.transition = '';
                ufoSummonEl.style.opacity = '1';
                ufoSummonEl.style.display = 'none';
                ufoFlyingAway = false;
                ufoPaused = false;
                game.ufoSummoned = false;
            }, 300);
            return;
        }

        const now = performance.now();

        if (ufoOffScreen) {
            if (now - ufoOffScreenTime > UFO_OFFSCREEN_DELAY) {
                ufoOffScreen = false;
                _spawnUfoAtSide();
            }
            return;
        }

        let left = parseFloat(ufoSummonEl.style.left) + ufoSummonVx;
        let top = parseFloat(ufoSummonEl.style.top) + ufoSummonVy;

        const elW = 64;
        const elH = 64;
        if (left + elW < 0 || left > window.innerWidth) {
            ufoOffScreen = true;
            ufoOffScreenTime = now;
            ufoSummonEl.style.display = 'none';
            return;
        }

        ufoSummonEl.style.left = left + 'px';
        ufoSummonEl.style.top = Math.max(0, Math.min(window.innerHeight - elH, top)) + 'px';
    } else {
        ufoSummonEl.style.display = 'none';
        ufoFlyingAway = false;
        ufoPaused = false;
    }
}

function render() {
    if (!game) return;
    const now = performance.now();

    if (!game.started) {
        if (ufoSummonEl) ufoSummonEl.style.display = 'none';
        app.render();
        return;
    }

    game.update(now);

    updateFruitSprites();
    updateMergeEffects();
    updateDangerLine();
    updateCurrentFruit();
    updateDropGuideLine();
    updateNextFruitPreview();
    updateUI();
    updateSkillButtonVisuals();
    updateScorePopups();

    updateUfoSummon();

    app.render();
}

function handleResize() {
    const isLandscape = window.innerWidth >= window.innerHeight;
    const scale = isLandscape
        ? window.innerHeight / PANEL_HEIGHT
        : window.innerWidth / PANEL_WIDTH;
    const newWidth = Math.floor(PANEL_WIDTH * scale);
    const newHeight = Math.floor(PANEL_HEIGHT * scale);

    app.renderer.resolution = getQualityResolution();
    app.renderer.resize(newWidth, newHeight);

    if (app && app.stage && scale > 0) {
        app.stage.scale.set(scale);
    }

    const settingsBtn = document.getElementById('settings-btn');
    const aboutBtn = document.getElementById('about-btn');
    if (isLandscape && settingsBtn && aboutBtn) {
        const aboutRect = aboutBtn.getBoundingClientRect();
        const btnSize = 56;
        const gap = 10;

        // 布局隐患点
        // -------------------------------------------------
        settingsBtn.style.left = (aboutRect.left - btnSize - gap) + 'px';
        settingsBtn.style.top = (aboutRect.bottom - btnSize) + 'px';
        settingsBtn.style.bottom = 'auto';

        const sponsorBtn = document.getElementById('sponsor-btn');
        if (sponsorBtn) {
            sponsorBtn.style.left = (aboutRect.right + gap) + 'px';
            sponsorBtn.style.top = (aboutRect.bottom - btnSize) + 'px';
            sponsorBtn.style.bottom = 'auto';
            sponsorBtn.style.right = 'auto';
        }
    } else if (settingsBtn) {
        settingsBtn.style.left = '';
        settingsBtn.style.top = '';
        settingsBtn.style.bottom = '';

        const sponsorBtn = document.getElementById('sponsor-btn');
        if (sponsorBtn) {
            sponsorBtn.style.left = '';
            sponsorBtn.style.right = '';
            sponsorBtn.style.top = '';
            sponsorBtn.style.bottom = '';
        }
    }
}

function getGameTimeSeconds() {
    return game ? game.getGameTimeSeconds() : 0;
}

function showGameOverModal(finalScore, gbCount) {
    const durationSec = getGameTimeSeconds();
    const recordsBefore = loadRecords();
    const newRec = isNewRecord(finalScore, recordsBefore);

    saveRecord(finalScore, durationSec, gbCount);
    const recordsAfter = loadRecords();
    const rankFinal = getRecordRank(finalScore, recordsAfter);

    const modal = document.getElementById('game-over-modal');
    const scoreDisplay = document.getElementById('final-score');
    if (modal && scoreDisplay) {
        scoreDisplay.textContent = formatScore(finalScore);
        modal.classList.add('visible');
    }

    const durationEl = document.getElementById('game-duration');
    if (durationEl) durationEl.textContent = formatTime(durationSec);

    const rankEl = document.getElementById('score-rank');
    if (rankEl) {
        if (finalScore === 0) {
            rankEl.textContent = '\u{1F47D}';
        } else {
            rankEl.textContent = rankFinal <= 10 ? String(rankFinal) : '-';
        }
    }

    const gbEl = document.getElementById('gb-count');
    if (gbEl) {
        if (gbCount > 0) {
            gbEl.textContent = gbCount;
        } else {
            gbEl.textContent = '0';
        }
    }

    const newRecTag = document.getElementById('new-record-tag');
    if (newRecTag) {
        if (newRec && finalScore > 0) {
            newRecTag.classList.remove('hidden');
        } else {
            newRecTag.classList.add('hidden');
        }
    }

    const highestEl = document.getElementById('highest-record');
    if (highestEl) {
        const highest = recordsAfter.length > 0 ? recordsAfter[0].score : finalScore;
        highestEl.textContent = formatScore(highest);
    }
}

async function init() {
    app = new Application();
    await app.init({
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        backgroundAlpha: 0,
        resolution: getQualityResolution(),
        autoDensity: true,
        antialias: true,
    });

    console.log('devicePixelRatio:', window.devicePixelRatio);

    app.ticker.maxFPS = 60;

    const container = document.getElementById('pixi-container');
    container.appendChild(app.canvas);
    handleResize();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            handleResize();
            loadingBg.resize();
        }, 100);
    });
    window.addEventListener('orientationchange', () => setTimeout(() => {
        handleResize();
        loadingBg.resize();
    }, 200));

    loadingManager.init();

    let voiceCount = 0;
    let voiceConfig = {};
    try {
        const res = await fetch('sound/index.json');
        voiceConfig = await res.json();
        voiceCount = Object.values(voiceConfig).reduce((sum, c) => sum + (c || 0), 0);
    } catch (e) {
        console.warn('Failed to fetch sound config:', e);
    }

    // 加载资源数量统计
    loadingManager.setTotal(5 + 3 + 1 + voiceCount);

    // 加载字体
    loadingManager.tick('正在tb山沟搜索911612…');
    await Assets.load('https://fusion-pixel-font.takwolf.com/fusion-pixel-12px-proportional-zh_hans.otf.woff2');

    // 加载头像纹理
    loadingManager.tick('正在从中华田园犬变成人形…');
    const spritesheetUrl = useLowResSpritesheet ? 'images/spritesheet0.25.png' : 'images/spritesheet.png';
    console.log('加载头像纹理:', spritesheetUrl);
    spritesheetTexture = await Assets.load(spritesheetUrl);
    frameW = spritesheetTexture.width / 5;
    frameH = spritesheetTexture.height / 11;
    for (let level = 0; level < FRUITS.length; level++) {
        fruitTextures[level] = [];
        for (let col = 0; col < 5; col++) {
            fruitTextures[level][col] = new Texture({
                source: spritesheetTexture.source,
                frame: new Rectangle(col * frameW, level * frameH, frameW, frameH)
            });
        }
    }

    // 加载背景动画
    const bgContainer = document.getElementById('loading-bg-container');
    await loadingBg.init(bgContainer);
    if (currentQuality === 'high') {
        const bgSpritesheetUrl = useLowResSpritesheet ? 'images/spritesheet0.5.png' : 'images/spritesheet.png';
        const spritesheetImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = bgSpritesheetUrl;
        });
        await loadingBg.startWithSpritesheet(spritesheetImg, useLowResSpritesheet);
    }

    loadingManager.tick('正在+5000…');
    panelSprite = await loadSprite('images/3-panel.png');
    panelSprite.width = PANEL_WIDTH;
    panelSprite.height = PANEL_HEIGHT;

    loadingManager.tick('正在咕咕嘎嘎…');
    frontSprite = await loadSprite('images/0-front.png');

    loadingManager.tick('正在刘C梦…');
    ufoTexture = await Assets.load('images/0-ufo.png');

    loadingManager.tick('正在刺死…');
    boopTexture = await Assets.load('images/0-boop.png');
    boopFrameH = boopTexture.height / 5;
    for (let f = 0; f < 5; f++) {
        boopSubTextures[f] = new Texture({
            source: boopTexture.source,
            frame: new Rectangle(0, f * boopFrameH, boopTexture.width, boopFrameH)
        });
    }

    soundManager.init();

    loadingManager.tick('正在长按重生geebar…');
    await soundManager.load('falling', 'sound/falling.mp3');
    loadingManager.tick('正在和弹幕吵架…');
    await soundManager.load('merge', 'sound/bubble.mp3');
    loadingManager.tick('正在双人站市场…');
    await soundManager.load('gameover', 'sound/gameover.mp3');
    loadingManager.tick('正在部署爆能器…');
    await soundManager.load('button', 'sound/button.mp3');
    loadingManager.tick('正在G头刷抖…');
    await soundManager.loadBGM('menu', 'sound/menu_bgm.mp3');
    loadingManager.tick('正在马来的路上…');
    await soundManager.loadBGM('gameplay', 'sound/gameplay_bgm.mp3');
    loadingManager.tick('正在bbkk…');
    await soundManager.load('countdown', 'sound/count_down.mp3');
    loadingManager.tick('正在单排上神话…');
    await soundManager.load('alien', 'sound/ufo.mp3');

    if (voiceCount > 0) {
        await soundManager.loadVoiceConfig(voiceConfig, (level) => {
            loadingManager.tick(`正在戒烟 day${level}`);
        });
    }

    loadingManager.tick('正在急急急…');
    loadingManager.onReady(() => {
        // main-menu 已在 animateToMainMenu 衔接动画中显示
        // loading-screen 的淡出也由衔接动画回调处理
    });

    loadingManager.showReady();

    game = new Game(soundManager);

    game.on('gameOver', (finalScore, gbCount) => {
        showGameOverModal(finalScore, gbCount);
    });

    buildScene();
    setupInput();

    app.ticker.add(render);
    handleResize();
}

function startGame() {
    document.getElementById('main-menu').classList.add('hidden');
    const pixiContainer = document.getElementById('pixi-container');
    pixiContainer.classList.remove('hidden');
    pixiContainer.style.opacity = 0;
    void pixiContainer.offsetHeight;
    requestAnimationFrame(() => {
        pixiContainer.style.opacity = 1;
    });
    document.body.classList.add('game-active');
    loadingBg.enterGameMode();
    soundManager.init();
    applyVolumeSettings();
    soundManager.crossfadeTo('gameplay');
    game.start();

    //gsap 动画写法
    // const pixiContainer = document.getElementById('pixi-container');
    // const menu = document.getElementById('main-menu');
    // const startGameTimeline = gsap.timeline({
    //     onComplete: () => {
    //         document.body.classList.add('game-active');
    //         loadingBg.enterGameMode();
    //         soundManager.init();
    //         applyVolumeSettings();
    //         soundManager.crossfadeTo('gameplay');
    //         game.start();
    //     }
    // });
    // startGameTimeline.to(menu, { opacity: 0, duration: 0.2, ease: 'power2.inOut' })
    //     .set(menu, { className: '+=hidden' })
    //     .set(pixiContainer, { className: '+=hidden' })
    //     .fromTo(pixiContainer, { opacity: 0 }, {
    //         opacity: 1, duration: 0.5, ease: 'power2.inOut'
    //     });
}

function openRecords() {
    renderRecordsTable();
    document.getElementById('records-screen').classList.remove('hidden');
}

function closeRecords() {
    const recordsScreen = document.getElementById('records-screen');
    recordsScreen.style.transition = 'none';
    recordsScreen.classList.add('hidden');
    recordsScreen.offsetHeight;
    recordsScreen.style.transition = '';
}

function openAbout() {
    document.getElementById('about-screen').classList.remove('hidden');
    requestAnimationFrame(() => {
        const wrap = document.querySelector('.about-info-wrap');
        if (!wrap) return;
        if (wrap.scrollHeight > wrap.clientHeight) {
            wrap.classList.add('overflow');
        } else {
            wrap.classList.remove('overflow', 'scrolled-bottom');
        }
    });
}

function closeAbout() {
    const aboutScreen = document.getElementById('about-screen');
    aboutScreen.style.transition = 'none';
    aboutScreen.classList.add('hidden');
    aboutScreen.offsetHeight;
    aboutScreen.style.transition = '';
}

function openSettings() {
    document.getElementById('settings-screen').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-screen').classList.add('hidden');
}

function openSponsor() {
    document.getElementById('sponsor-screen').classList.remove('hidden');
}

function closeSponsor() {
    document.getElementById('sponsor-screen').classList.add('hidden');
}

function loadVolumeSettings() {
    try {
        const raw = localStorage.getItem('biggerPixi_volumes');
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return { sfx: 0.5, music: 0.5 };
}

function saveVolumeSettings(sfx, music) {
    try {
        localStorage.setItem('biggerPixi_volumes', JSON.stringify({ sfx, music }));
    } catch (e) { }
}

function loadQualitySetting() {
    try {
        return localStorage.getItem('biggerPixi_quality') || 'high';
    } catch (e) { return 'high'; }
}

function saveQualitySetting(quality) {
    try {
        localStorage.setItem('biggerPixi_quality', quality);
    } catch (e) { }
}

let currentQuality = loadQualitySetting();

// 获取最大纹理尺寸
function getMaxTextureSize() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    console.log('纹理上限:', gl.getParameter(gl.MAX_TEXTURE_SIZE), 'GPU:', gl.getParameter(gl.RENDERER))
    if (!gl) return 2048;
    return gl.getParameter(gl.MAX_TEXTURE_SIZE);
}

const maxTextureSize = getMaxTextureSize();
const useLowResSpritesheet = maxTextureSize <= 4096;

function getQualityResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return currentQuality === 'low' ? 1 : dpr;
}

function applyQualityButtons() {
    const buttons = document.querySelectorAll('.quality-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.quality === currentQuality);
    });
}

function updateQualityUI() {
    applyQualityButtons();
    if (app && app.renderer) {
        handleResize();
    }
    if (loadingBg && loadingBg._canvas) {
        loadingBg._canvas.style.display = currentQuality === 'low' ? 'none' : '';
    }
}

function setupQualityToggle() {
    applyQualityButtons();

    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.quality === currentQuality) return;
            currentQuality = btn.dataset.quality;
            saveQualitySetting(currentQuality);
            updateQualityUI();
        });
    });
}

function applyVolumeSettings() {
    const vol = loadVolumeSettings();
    soundManager.setSfxVolume(vol.sfx);
    soundManager.setMusicVolume(vol.music);
    const sfxSlider = document.getElementById('sfx-volume');
    const musicSlider = document.getElementById('music-volume');
    const pauseSfxSlider = document.getElementById('pause-sfx-volume');
    const pauseMusicSlider = document.getElementById('pause-music-volume');
    if (sfxSlider) sfxSlider.value = Math.round(vol.sfx * 100);
    if (musicSlider) musicSlider.value = Math.round(vol.music * 100);
    if (pauseSfxSlider) pauseSfxSlider.value = Math.round(vol.sfx * 100);
    if (pauseMusicSlider) pauseMusicSlider.value = Math.round(vol.music * 100);
}

function setupSettingsSliders() {
    const sfxSlider = document.getElementById('sfx-volume');
    const musicSlider = document.getElementById('music-volume');
    const pauseSfxSlider = document.getElementById('pause-sfx-volume');
    const pauseMusicSlider = document.getElementById('pause-music-volume');

    applyVolumeSettings();

    const onSfxInput = (v) => {
        soundManager.setSfxVolume(v);
        const vol = loadVolumeSettings();
        saveVolumeSettings(v, vol.music);
    };

    const onSfxChange = () => {
        soundManager.playAlienVoice();
    };

    const onMusicInput = (v) => {
        soundManager.setMusicVolume(v);
        const vol = loadVolumeSettings();
        saveVolumeSettings(vol.sfx, v);
    };

    sfxSlider.addEventListener('input', () => {
        const v = sfxSlider.value / 100;
        onSfxInput(v);
        if (pauseSfxSlider) pauseSfxSlider.value = sfxSlider.value;
    });
    sfxSlider.addEventListener('change', onSfxChange);

    musicSlider.addEventListener('input', () => {
        const v = musicSlider.value / 100;
        onMusicInput(v);
        if (pauseMusicSlider) pauseMusicSlider.value = musicSlider.value;
    });

    if (pauseSfxSlider) {
        pauseSfxSlider.addEventListener('input', () => {
            const v = pauseSfxSlider.value / 100;
            onSfxInput(v);
            if (sfxSlider) sfxSlider.value = pauseSfxSlider.value;
        });
        pauseSfxSlider.addEventListener('change', onSfxChange);
    }

    if (pauseMusicSlider) {
        pauseMusicSlider.addEventListener('input', () => {
            const v = pauseMusicSlider.value / 100;
            onMusicInput(v);
            if (musicSlider) musicSlider.value = pauseMusicSlider.value;
        });
    }
}

function resumeGame() {
    if (!game || !game.paused) return;
    game.togglePause();
    document.getElementById('pause-screen').classList.add('hidden');
}

function restartGameFromPause() {
    document.getElementById('pause-screen').classList.add('hidden');
    game.restart();
    resetUfoSummonState();
}

function endGameFromPause() {
    document.getElementById('pause-screen').classList.add('hidden');
    if (game.paused && game.pauseStart > 0) {
        game.pauseAccumulated += performance.now() - game.pauseStart;
        game.pauseStart = 0;
    }
    game.paused = false;
    game.gameOver = true;
    game.gameOverStartTime = performance.now();
    game.gameOverAnimating = false;
    showGameOverModal(game.score, game.gbCount);
}

function quitToHome() {
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('game-over-modal').classList.remove('visible');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('pixi-container').classList.add('hidden');
    document.body.classList.remove('game-active');
    loadingBg.exitGameMode();
    game.restart();
    game.started = false;
    game.paused = false;
    resetUfoSummonState();
    soundManager.crossfadeTo('menu');
}

function restartFromModal() {
    document.getElementById('game-over-modal').classList.remove('visible');
    game.restart();
    resetUfoSummonState();
}

function resetUfoSummonState() {
    if (ufoSummonEl) ufoSummonEl.style.display = 'none';
    ufoSummonVx = 0;
    ufoSummonVy = 0;
    ufoFlyingAway = false;
    ufoPaused = false;
    ufoFlyingTime = 0;
    ufoOffScreen = false;
    ufoLastFromLeft = false;
    _resetUfoFloat();
}

function animateButtonPress(el) {
    gsap.killTweensOf(el);

    const tl = gsap.timeline();
    tl.to(el, {
        y: 8,
        duration: 0.1,
        ease: 'power2.in'
    })
        .to(el, {
            scale: 1,
            y: 0,
            duration: 0.3,
            ease: 'elastic.out(1, 0.35)'
        }, '-=0.05');
}

function addHoverBounce(el) {
    el.addEventListener('mouseenter', () => {
        gsap.killTweensOf(el);
        gsap.to(el, {
            scale: 1.08,
            y: -3,
            duration: 0.3,
            ease: 'back.out(2)'
        });
    });
    el.addEventListener('mouseleave', () => {
        gsap.killTweensOf(el);
        gsap.to(el, {
            scale: 1,
            y: 0,
            duration: 0.2,
            ease: 'power2.out'
        });
    });
}

function setupHTMLButtons() {
    const startBtns = document.querySelectorAll('.start-btn-main');
    startBtns.forEach(addHoverBounce);
    const modalBtns = document.querySelectorAll('.modal-btn');
    modalBtns.forEach(addHoverBounce);

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) addHoverBounce(settingsBtn);

    const sponsorBtn = document.getElementById('sponsor-btn');
    if (sponsorBtn) addHoverBounce(sponsorBtn);

    const bind = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => {
            soundManager.playButton();
            animateButtonPress(el);
            setTimeout(() => handler(e), 150);
        });
    };

    bind('start-btn', startGame);
    bind('records-btn', openRecords);
    bind('about-btn', openAbout);
    bind('resume-btn', resumeGame);
    bind('pause-restart-btn', restartGameFromPause);
    bind('quit-btn-1', endGameFromPause);
    bind('quit-btn-2', quitToHome);
    bind('restart-btn', restartFromModal);
    bind('close-records-btn', closeRecords);
    bind('close-about-btn', closeAbout);
    bind('settings-btn', openSettings);
    bind('close-settings-btn', closeSettings);
    bind('sponsor-btn', openSponsor);
    bind('close-sponsor-btn', closeSponsor);
}

setupHTMLButtons();
setupSettingsSliders();
setupQualityToggle();

function setupRecordsScrollListener() {
    const wrap = document.querySelector('.records-table-wrap');
    if (!wrap) return;
    wrap.addEventListener('scroll', () => {
        if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 8) {
            wrap.classList.add('scrolled-bottom');
        } else {
            wrap.classList.remove('scrolled-bottom');
        }
    });
}

function setupAboutScrollListener() {
    const wrap = document.querySelector('.about-info-wrap');
    if (!wrap) return;
    wrap.addEventListener('scroll', () => {
        if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 8) {
            wrap.classList.add('scrolled-bottom');
        } else {
            wrap.classList.remove('scrolled-bottom');
        }
    });
}

setupRecordsScrollListener();
setupAboutScrollListener();
init();

// ========== 页面聚焦/失焦处理 ==========
// 网页不在前台时暂停所有动画、游戏和音频，回到前台后恢复
function handleVisibilityChange() {
    if (document.hidden) {
        loadingBg.pauseAnimation();
        soundManager.suspendAudio();

        // 游戏运行中且未暂停，自动触发暂停
        if (game && game.started && !game.paused && !game.gameOver) {
            game.togglePause();
            document.getElementById('pause-screen').classList.remove('hidden');
        }
    } else {
        loadingBg.resumeAnimation();
        soundManager.resumeAudio();
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);