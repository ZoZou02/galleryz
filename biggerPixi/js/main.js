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

let app, game;
let panelSprite, frontSprite;
let spritesheetTexture, eggTexture, boopTexture;
let fruitTextures = [];
let frameW = 0, frameH = 0;
let boopFrameH = 0;
let boopSubTextures = [];

let gameContainer, fruitContainer, effectContainer;
let currentFruitSprite, currentFruitContainer;
let dangerLineGfx, dangerCountText;
let scoreText, timerText, pauseBtnContainer;
let ufoBtn, alienBtn;
let skillBtnContainer;
let levelIconsContainer;
let previewSprite;
let loadingHidden = false;
let fruitSprites = new Map();

let pointerPos = { x: PANEL_WIDTH / 2, y: 0 };
let pauseBtnRect = { x: 0, y: 0, w: 26, h: 24 };
let skillBtnHover = { ufo: false, alien: false };

const previewOffset1 = Math.floor(Math.random() * 3000);
const previewOffset2 = Math.floor(Math.random() * 3000);

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

    eggTexture = await Assets.load('images/0-egg.png');

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

    frontSprite.x = 0;
    frontSprite.y = 0;
    frontSprite.width = GAME_WIDTH;
    frontSprite.height = GAME_HEIGHT;
    gameContainer.addChild(frontSprite);

    const dangerStyle = new TextStyle({
        fontFamily: 'ZCOOL KuaiLe, Comic Sans MS, sans-serif',
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
}

function buildUI() {
    const style = new TextStyle({
        fontFamily: 'ZCOOL KuaiLe, Comic Sans MS, sans-serif',
        fontSize: 20,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: { color: '#000000', width: 2 }
    });

    scoreText = new Text({ text: '0', style });
    scoreText.anchor.set(0.5, 0);
    scoreText.x = GAME_WIDTH / 2;
    scoreText.y = -14;
    gameContainer.addChild(scoreText);

    const timerStyle = new TextStyle({
        fontFamily: 'ZCOOL KuaiLe, Comic Sans MS, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: { color: '#000000', width: 1 }
    });
    timerText = new Text({ text: '\u23F1 0:00', style: timerStyle });
    timerText.x = 8;
    timerText.y = -14;
    gameContainer.addChild(timerText);

    pauseBtnRect.x = GAME_WIDTH - 32;
    pauseBtnRect.y = -30;

    pauseBtnContainer = new Container();
    pauseBtnContainer.x = pauseBtnRect.x;
    pauseBtnContainer.y = pauseBtnRect.y;

    const pauseBg = new Graphics();
    pauseBg.roundRect(0, 0, pauseBtnRect.w, pauseBtnRect.h, 6);
    pauseBg.fill({ color: 0xffffff, alpha: 0.4 });
    pauseBtnContainer.addChild(pauseBg);

    const pauseIconStyle = new TextStyle({
        fontFamily: 'ZCOOL KuaiLe, sans-serif',
        fontSize: 14,
        fill: '#3c3c3c'
    });
    const pauseIcon = new Text({ text: '\u23F8', style: pauseIconStyle });
    pauseIcon.anchor.set(0.5);
    pauseIcon.x = pauseBtnRect.w / 2;
    pauseIcon.y = pauseBtnRect.h / 2;
    pauseBtnContainer.addChild(pauseIcon);

    gameContainer.addChild(pauseBtnContainer);
}

function buildSkillButtons() {
    skillBtnContainer = new Container();
    app.stage.addChild(skillBtnContainer);

    const totalW = SKILLS.btnW * 2 + SKILLS.btnGap;
    const startX = (PANEL_WIDTH - totalW) / 2;

    ufoBtn = createSkillButton(startX, SKILLS.btnY, SKILLS.btnW, SKILLS.btnH, '\uD83D\uDEF8', 'UFO', '#00bcd4');
    alienBtn = createSkillButton(startX + SKILLS.btnW + SKILLS.btnGap, SKILLS.btnY, SKILLS.btnW, SKILLS.btnH, '\uD83D\uDC7D', '\u5165\u4FB5', '#8bc34a');

    skillBtnContainer.addChild(ufoBtn.container);
    skillBtnContainer.addChild(alienBtn.container);
}

function createSkillButton(x, y, w, h, icon, label, accentColor) {
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

    const iconStyle = new TextStyle({
        fontFamily: 'ZCOOL KuaiLe, sans-serif',
        fontSize: 16,
        fill: '#ffffff'
    });
    const iconText = new Text({ text: icon, style: iconStyle });
    iconText.anchor.set(0.5);
    iconText.x = w / 2;
    iconText.y = h / 2 - 7;
    container.addChild(iconText);

    const labelStyle = new TextStyle({
        fontFamily: 'ZCOOL KuaiLe, sans-serif',
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

    return { container, shadow, bg, highlight, iconText, labelText, bar, goldBorder, x, y, w, h, accentColor, label };
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

function setupInput() {
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('pointermove', (e) => {
        pointerPos.x = e.global.x;
        pointerPos.y = e.global.y;
    });

    app.stage.on('pointerdown', (e) => {
        if (!game || game.gameOver || !game.started) return;

        updateSkillBtnHover(e.global);

        if (skillBtnHover.ufo) {
            game.activateUFO();
            return;
        }
        if (skillBtnHover.alien) {
            game.activateAlien();
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
    if (!ufoBtn || !alienBtn) return;
    const ufoLocal = ufoBtn.container.toLocal(globalPos);
    const alienLocal = alienBtn.container.toLocal(globalPos);
    skillBtnHover.ufo = ufoLocal.x >= 0 && ufoLocal.x <= ufoBtn.w && ufoLocal.y >= 0 && ufoLocal.y <= ufoBtn.h;
    skillBtnHover.alien = alienLocal.x >= 0 && alienLocal.x <= alienBtn.w && alienLocal.y >= 0 && alienLocal.y <= alienBtn.h;
}

function isInsidePauseBtn(localX, localY) {
    return localX >= pauseBtnRect.x && localX <= pauseBtnRect.x + pauseBtnRect.w &&
           localY >= pauseBtnRect.y && localY <= pauseBtnRect.y + pauseBtnRect.h;
}

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
        const frameIdx = state === 'hit' ? 4 : getAnimationFrameIndex(now, fruit.animationOffset);
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
    const scale = (fruitInfo.radius * 2.2) / texture.width;
    currentFruitSprite.scale.set(scale);
    currentFruitSprite.x = x;
    currentFruitSprite.y = y;
}

function updateNextFruitPreview() {
    if (!game) return;
    const level = game.nextFruitLevel;
    const now = performance.now();
    const frameIdx = getAnimationFrameIndex(now, previewOffset2);

    if (!previewSprite) {
        const eggW = 50, eggH = 50;
        const halfW = eggTexture.width / 2;
        const fullH = eggTexture.height;

        const eggLeftTex = new Texture({ source: eggTexture.source, frame: new Rectangle(0, 0, halfW, fullH) });
        const eggRightTex = new Texture({ source: eggTexture.source, frame: new Rectangle(halfW, 0, halfW, fullH) });

        const eggLeftP = new Sprite(eggLeftTex);
        eggLeftP.width = eggW / 2;
        eggLeftP.height = eggH;
        eggLeftP.x = GAME_WIDTH - 30 - eggW / 2;
        eggLeftP.y = 28 - eggH / 2;
        eggLeftP.alpha = 0.88;
        gameContainer.addChild(eggLeftP);

        const eggRightP = new Sprite(eggRightTex);
        eggRightP.width = eggW / 2;
        eggRightP.height = eggH;
        eggRightP.x = GAME_WIDTH - 30;
        eggRightP.y = 28 - eggH / 2;
        eggRightP.alpha = 0.88;
        gameContainer.addChild(eggRightP);

        previewSprite = new Sprite(fruitTextures[0][0]);
        previewSprite.anchor.set(0.5);
        previewSprite.x = GAME_WIDTH - 30;
        previewSprite.y = 28;
        previewSprite.width = 40;
        previewSprite.height = 40;
        gameContainer.addChild(previewSprite);
    }
    previewSprite.texture = fruitTextures[level][frameIdx];
}

function updateUI() {
    if (!game) return;

    scoreText.text = formatScore(game.score);
    timerText.text = '\u23F1 ' + formatTime(game.getGameTimeSeconds());

    updateSkillBtnHover(pointerPos);

    const local = gameContainer.toLocal(pointerPos);
    const hoverPause = isInsidePauseBtn(local.x, local.y);
    pauseBtnContainer.children[0].alpha = hoverPause ? 0.7 : 0.4;
}

function updateSkillButtonVisuals() {
    if (!game || game.gameOver || !game.started) {
        skillBtnContainer.visible = false;
        return;
    }
    skillBtnContainer.visible = true;

    drawSkillBtnVisual(ufoBtn, game.ufoUsesLeft, skillBtnHover.ufo, false, 0, 0, game.ufoActive);
    drawSkillBtnVisual(alienBtn, game.alienUsesLeft, skillBtnHover.alien, true, SKILLS.alienDropCharge, game.alienChargeCount);
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
    btn.iconText.alpha = iconAlpha;
    btn.iconText.style.fill = textColor;

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
        if (age >= 1500) continue;
        const alpha = age < 1000 ? 1 : Math.max(0, 1 - (age - 1000) / 500);
        if (alpha <= 0) continue;

        const rise = (age / 1500) * -18;
        const style = new TextStyle({
            fontFamily: 'ZCOOL KuaiLe, sans-serif',
            fontSize: 15,
            fill: popup.color,
            stroke: { color: '#000000', width: 1 }
        });
        const text = new Text({ text: '+' + formatScore(popup.amount), style });
        text.anchor.set(0.5, 0);
        text.x = GAME_WIDTH / 2;
        text.y = popup.baseY + rise;
        text.alpha = alpha;
        text._isPopup = true;
        gameContainer.addChild(text);
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
        app.render();
        return;
    }

    game.update(now);

    updateFruitSprites();
    updateMergeEffects();
    updateDangerLine();
    updateCurrentFruit();
    updateNextFruitPreview();
    updateUI();
    updateSkillButtonVisuals();
    updateScorePopups();

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
        background: '#1a1a2e',
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
    document.body.classList.add('game-active');
    soundManager.init();
    game.start();
}

function openRecords() {
    document.getElementById('start-screen').classList.add('hidden');
    renderRecordsTable();
    document.getElementById('records-screen').classList.remove('hidden');
}

function closeRecords() {
    document.getElementById('records-screen').classList.add('hidden');
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
}

function quitToHome() {
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('game-over-modal').classList.remove('visible');
    document.getElementById('start-screen').classList.remove('hidden');
    document.body.classList.remove('game-active');
    game.restart();
    game.started = false;
    game.paused = false;
}

function restartFromModal() {
    document.getElementById('game-over-modal').classList.remove('visible');
    game.restart();
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