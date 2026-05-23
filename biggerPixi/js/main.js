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

/** -------------------- 全局变量 -------------------- */

let app, game;
let panelSprite, frontSprite;
let spritesheetTexture, boopTexture;
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
const UFO_FLY_DURATION = 60000;
const UFO_PAUSE_TIMEOUT = 3000;

let gameContainer, fruitContainer, effectContainer;
let currentFruitSprite, currentFruitContainer;
let dangerLineGfx, dangerCountText;
let dropGuideLineGfx;
let scoreText, timerText, pauseBtnContainer;
let ufoBtn;
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
let loadingHidden = false;
let fruitSprites = new Map();

let pointerPos = { x: PANEL_WIDTH / 2, y: 0 };
let pauseBtnRect = { x: 0, y: 0, w: 26, h: 24 };
let skillBtnHover = { ufo: false };

const previewOffset1 = Math.floor(Math.random() * 3000);
const previewOffset2 = Math.floor(Math.random() * 3000);

/** -------------------- 资源加载 -------------------- */

async function loadAssets() {
    spritesheetTexture = await Assets.load('images/spritesheet.png');
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

    [panelSprite, frontSprite] = await Promise.all([
        loadSprite('images/3-panel.png'),
        loadSprite('images/0-front.png')
    ]);
    panelSprite.width = PANEL_WIDTH;
    panelSprite.height = PANEL_HEIGHT;

    boopTexture = await Assets.load('images/0-boop.png');
    boopFrameH = boopTexture.height / 5;
    for (let f = 0; f < 5; f++) {
        boopSubTextures[f] = new Texture({
            source: boopTexture.source,
            frame: new Rectangle(0, f * boopFrameH, boopTexture.width, boopFrameH)
        });
    }
}

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
        fontFamily: 'SimHei, Heiti SC, sans-serif',
        fontSize: 32,
        fontWeight: 'bold',
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
    const barY = -14;
    const boxH = 24;
    const boxW = 46;
    const margin = 4;

    const textStyle = new TextStyle({
        fontFamily: 'SimHei, Heiti SC, sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: { color: '#000000', width: 2 }
    });

    // --- 左侧：时间 ---
    const timeBg = new Graphics();
    timeBg.roundRect(margin, barY, boxW, boxH, 4);
    timeBg.fill({ color: 0xffb15e });
    gameContainer.addChild(timeBg);

    const clockGfx = new Graphics();
    const cx = margin + 11, cy = barY + boxH / 2;
    clockGfx.circle(cx, cy, 6);
    clockGfx.stroke({ color: 0xa54800, width: 2 });
    clockGfx.moveTo(cx, cy);
    clockGfx.lineTo(cx, cy - 3);
    clockGfx.stroke({ color: 0xa54800, width: 2 });
    clockGfx.moveTo(cx, cy);
    clockGfx.lineTo(cx + 3, cy);
    clockGfx.stroke({ color: 0xa54800, width: 2 });
    gameContainer.addChild(clockGfx);

    timerText = new Text({ text: '0:00', style: textStyle });
    timerText.x = margin + 20;
    timerText.y = barY + 2;
    gameContainer.addChild(timerText);

    // --- 中间：分数 ---
    scoreText = new Text({ text: '0', style: textStyle });
    scoreText.anchor.set(0.5, 0);
    scoreText.x = GAME_WIDTH / 2;
    scoreText.y = barY + 2;
    gameContainer.addChild(scoreText);

    // --- 右侧：暂停按钮 ---
    const pauseX = GAME_WIDTH - margin - boxW;
    const pauseBg = new Graphics();
    pauseBg.roundRect(pauseX, barY, boxW, boxH, 4);
    pauseBg.fill({ color: 0xffb15e });
    pauseBg.stroke({ color: 0xa54800, width: 2 });
    gameContainer.addChild(pauseBg);

    pauseBtnRect.x = pauseX;
    pauseBtnRect.y = barY;
    pauseBtnRect.w = boxW;
    pauseBtnRect.h = boxH;

    pauseBtnContainer = new Container();
    pauseBtnContainer.x = pauseX;
    pauseBtnContainer.y = barY;

    const pauseGfx = new Graphics();
    const barW = 3, barH = 12, gap = 5;
    const barsCenterX = boxW / 2;
    pauseGfx.rect(barsCenterX - gap - barW, (boxH - barH) / 2, barW, barH);
    pauseGfx.rect(barsCenterX + gap, (boxH - barH) / 2, barW, barH);
    pauseGfx.fill({ color: 0xa54800 });
    pauseBtnContainer.addChild(pauseGfx);

    gameContainer.addChild(pauseBtnContainer);
}

function buildSkillButtons() {
    skillBtnContainer = new Container();
    app.stage.addChild(skillBtnContainer);

    const startX = (PANEL_WIDTH - SKILLS.btnW) / 2;

    ufoBtn = createSkillButton(startX, SKILLS.btnY, SKILLS.btnW, SKILLS.btnH, drawUFOIcon, 'UFO', '#00bcd4');

    skillBtnContainer.addChild(ufoBtn.container);
}

function drawUFOIcon(g) {
    g.ellipse(g._w / 2, g._h / 2 + 2, 10, 4);
    g.fill({ color: 0xffffff });
    g.ellipse(g._w / 2, g._h / 2 - 4, 6, 4);
    g.fill({ color: 0xffffff, alpha: 0.6 });
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
        fontFamily: 'ZCOOL KuaiLe, SimHei, sans-serif',
        fontSize: 10,
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

function buildUfoSummon() {
    ufoSummonEl = document.createElement('img');
    ufoSummonEl.src = 'images/0-ufo.png';
    ufoSummonEl.style.cssText = 'position:fixed;width:64px;height:64px;display:none;z-index:999;cursor:pointer;';
    ufoSummonEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!game || !game.ufoSummoned || ufoFlyingAway) return;

        if (!ufoPaused) {
            ufoPaused = true;
            ufoPauseTime = performance.now();
            ufoSummonVx = 0;
            ufoSummonVy = 0;
        } else {
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

function buildLevelIcons() {
    levelIconsContainer = new Container();
    app.stage.addChild(levelIconsContainer);

    const iconSize = 28;
    const totalWidth = FRUITS.length * iconSize;
    const margin = (PANEL_WIDTH - totalWidth) / 2;
    const y = GAME_HEIGHT + 187;

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
            game.activateUFO();
            return;
        }

        const local = gameContainer.toLocal(e.global);
        if (isInsidePauseBtn(local.x, local.y)) {
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
        const ufoFace = game.ufoActive;
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

    const local = gameContainer.toLocal(pointerPos);
    const hoverPause = isInsidePauseBtn(local.x, local.y);
    pauseBtnContainer.alpha = hoverPause ? 1 : 0.6;
}

function updateSkillButtonVisuals() {
    if (!game || game.gameOver || !game.started) {
        skillBtnContainer.visible = false;
        return;
    }
    skillBtnContainer.visible = true;

    drawSkillBtnVisual(ufoBtn, game.ufoUsesLeft, skillBtnHover.ufo, false, 0, 0, game.ufoActive);
}

function drawSkillBtnVisual(btn, usesLeft, hovered, isCharging, chargeMax, chargeCur, ufoDisabled) {
    if (!btn) return;
    const active = usesLeft > 0 && !ufoDisabled;
    let bgColor, textColor, iconAlpha;

    if (!active && !isCharging) {
        bgColor = 0x666666; textColor = '#aaaaaa'; iconAlpha = 0.4;
    } else if (isCharging && usesLeft === 0) {
        bgColor = 0x555555; textColor = '#999999'; iconAlpha = 0.47;
    } else {
        bgColor = active ? parseInt(btn.accentColor.replace('#', ''), 16) : 0x555555;
        textColor = '#ffffff'; iconAlpha = 1;
    }

    const lift = (hovered && active) ? -3 : 0;
    btn.container.y = btn.y + lift;
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
            fontFamily: 'SimHei, Heiti SC, sans-serif',
            fontSize: 16,
            fill: popup.color,
            stroke: { color: '#000000', width: 2 }
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

function updateUfoSummon() {
    if (!ufoSummonEl || !game) return;

    if (ufoFlyingAway) return;

    if (game.ufoSummoned) {
        if (ufoSummonEl.style.display === 'none') {
            ufoSummonEl.style.display = 'block';
            const spawnEdge = Math.floor(Math.random() * 4);
            switch (spawnEdge) {
                case 0: ufoSummonEl.style.left = '-64px'; ufoSummonEl.style.top = (Math.random() * window.innerHeight) + 'px'; break;
                case 1: ufoSummonEl.style.left = window.innerWidth + 'px'; ufoSummonEl.style.top = (Math.random() * window.innerHeight) + 'px'; break;
                case 2: ufoSummonEl.style.left = (Math.random() * window.innerWidth) + 'px'; ufoSummonEl.style.top = '-64px'; break;
                case 3: ufoSummonEl.style.left = (Math.random() * window.innerWidth) + 'px'; ufoSummonEl.style.top = window.innerHeight + 'px'; break;
            }
            ufoSummonVx = (Math.random() - 0.5) * 50;
            ufoSummonVy = (Math.random() - 0.5) * 10;
            ufoSpawnTime = performance.now();
            ufoFlyingTime = 0;
            ufoFlyingAway = false;
            ufoPaused = false;
        }

        if (ufoPaused) {
            if (performance.now() - ufoPauseTime > UFO_PAUSE_TIMEOUT) {
                ufoSpawnTime = performance.now() - ufoFlyingTime;
                ufoPaused = false;
            } else {
                return;
            }
        }

        ufoFlyingTime = performance.now() - ufoSpawnTime;

        if (ufoFlyingTime > UFO_FLY_DURATION) {
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
                game.ufoSummoned = false;
            }, 300);
            return;
        }

        let left = parseFloat(ufoSummonEl.style.left) + ufoSummonVx;
        let top = parseFloat(ufoSummonEl.style.top) + ufoSummonVy;

        const elW = 64;
        const elH = 64;
        if (left < 0 || left + elW > window.innerWidth) {
            ufoSummonVx *= -1;
            left = Math.max(0, Math.min(window.innerWidth - elW, left));
        }
        if (top < 0 || top + elH > window.innerHeight) {
            ufoSummonVy *= -1;
            top = Math.max(0, Math.min(window.innerHeight - elH, top));
        }

        ufoSummonEl.style.left = left + 'px';
        ufoSummonEl.style.top = top + 'px';
    } else {
        ufoSummonEl.style.display = 'none';
        ufoFlyingAway = false;
        ufoPaused = false;
    }
}

function render() {
    if (!game) return;
    const now = performance.now();

    if (!loadingHidden && spritesheetTexture) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                if (loadingScreen.parentNode) loadingScreen.parentNode.removeChild(loadingScreen);
            }, 500);
        }
        loadingHidden = true;
        return;
    }
    if (!spritesheetTexture) return;

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
    const scale = Math.min(window.innerWidth / PANEL_WIDTH, window.innerHeight / PANEL_HEIGHT);
    const canvas = app.canvas;
    canvas.style.width = PANEL_WIDTH * scale + 'px';
    canvas.style.height = PANEL_HEIGHT * scale + 'px';
}

function getGameTimeSeconds() {
    return game ? game.getGameTimeSeconds() : 0;
}

function showGameOverModal(finalScore) {
    const durationSec = getGameTimeSeconds();
    const recordsBefore = loadRecords();
    const newRec = isNewRecord(finalScore, recordsBefore);

    saveRecord(finalScore, durationSec);
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
        if (rankFinal <= 10) {
            rankEl.textContent = '\u7B2C ' + rankFinal + ' \u540D';
            rankEl.style.display = 'block';
        } else {
            rankEl.style.display = 'none';
        }
    }
}

async function init() {
    app = new Application();
    await app.init({
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        backgroundAlpha: 0,
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true
    });

    app.ticker.maxFPS = 60;

    const container = document.getElementById('pixi-container');
    container.appendChild(app.canvas);
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));

    await loadAssets();
    soundManager.init();

    try {
        await Promise.all([
            soundManager.load('falling', 'sound/falling.wav'),
            soundManager.load('merge', 'sound/bubble.wav'),
            soundManager.load('gameover', 'sound/gameover.wav')
        ]);

        const res = await fetch('sound/index.json');
        const config = await res.json();
        await soundManager.loadVoiceConfig(config);
    } catch (e) {
        console.warn('Audio load failed:', e);
    }

    game = new Game(soundManager);

    game.on('gameOver', (finalScore) => {
        showGameOverModal(finalScore);
    });

    buildScene();
    setupInput();

    app.ticker.add(render);
    handleResize();
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('pixi-container').classList.remove('hidden');
    document.body.classList.add('game-active');
    soundManager.init();
    game.start();
}

function openRecords() {
    const startScreen = document.getElementById('start-screen');
    startScreen.style.transition = 'none';
    startScreen.classList.add('hidden');
    startScreen.offsetHeight;
    startScreen.style.transition = '';

    renderRecordsTable();
    document.getElementById('records-screen').classList.remove('hidden');
}

function closeRecords() {
    const recordsScreen = document.getElementById('records-screen');
    recordsScreen.style.transition = 'none';
    recordsScreen.classList.add('hidden');
    recordsScreen.offsetHeight;
    recordsScreen.style.transition = '';

    document.getElementById('start-screen').classList.remove('hidden');
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

function quitToHome() {
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('game-over-modal').classList.remove('visible');
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('pixi-container').classList.add('hidden');
    document.body.classList.remove('game-active');
    game.restart();
    game.started = false;
    game.paused = false;
    resetUfoSummonState();
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
}

function setupHTMLButtons() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('records-btn').addEventListener('click', openRecords);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('pause-restart-btn').addEventListener('click', restartGameFromPause);
    document.getElementById('quit-btn-1').addEventListener('click', quitToHome);
    document.getElementById('quit-btn-2').addEventListener('click', quitToHome);
    document.getElementById('restart-btn').addEventListener('click', restartFromModal);
    document.getElementById('close-records-btn').addEventListener('click', closeRecords);
}

setupHTMLButtons();
init();