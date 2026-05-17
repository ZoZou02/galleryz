import {
    GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS, GAME_OFFSET_X, GAME_OFFSET_Y,
    FRUITS, DIFFICULTY, PHYSICS, ANIM, MERGE_AUDIO_CFG, SKILLS,
    DROP_DELAY, formatScore, VOICE_CFG
} from './config.js';

const { Engine, World, Bodies, Body, Events, Composite } = window.Matter;

export class Game {
    constructor(soundManager) {
        this.sound = soundManager;

        this.fruits = [];
        this.pendingMerges = [];
        this.mergeEffects = [];
        this.score = 0;
        this.scorePopups = [];
        this.lastPopupBaseY = 15;

        this.gameOver = false;
        this.started = false;
        this.paused = false;

        this.currentFruitLevel = 0;
        this.nextFruitLevel = 0;
        this.lastDropTime = 0;

        this.dangerLineY = 100;
        this.dangerTime = 0;
        this.dangerCooldownStart = 0;

        this.gameOverAnimating = false;
        this.gameOverExplodeIndex = 0;
        this.gameOverExplodeTime = 0;

        this.ufoUsesLeft = SKILLS.ufoMaxUses;
        this.ufoActive = false;
        this.ufoStartTime = 0;
        this.alienChargeCount = 0;
        this.alienUsesLeft = 0;

        this.startTime = 0;
        this.pauseAccumulated = 0;
        this.pauseStart = 0;
        this.elapsed = 0;

        this._init();
    }

    _init() {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.world.gravity.y = PHYSICS.gravity;

        const leftWall = Bodies.rectangle(
            GAME_OFFSET_X + WALL_THICKNESS / 2, GAME_OFFSET_Y + GAME_HEIGHT / 2,
            WALL_THICKNESS, GAME_HEIGHT, { isStatic: true });
        const rightWall = Bodies.rectangle(
            GAME_OFFSET_X + GAME_WIDTH - WALL_THICKNESS / 2, GAME_OFFSET_Y + GAME_HEIGHT / 2,
            WALL_THICKNESS, GAME_HEIGHT, { isStatic: true });
        const bottomWall = Bodies.rectangle(
            GAME_OFFSET_X + GAME_WIDTH / 2, GAME_OFFSET_Y + GAME_HEIGHT - WALL_THICKNESS / 2,
            GAME_WIDTH, WALL_THICKNESS, { isStatic: true });
        Composite.add(this.world, [leftWall, rightWall, bottomWall]);

        Events.on(this.engine, 'collisionStart', (event) => {
            this._handleCollision(event);
        });

        this.currentFruitLevel = this._getRandomInitialLevel();
        this.nextFruitLevel = this._getRandomInitialLevel();
    }

    _getRandomInitialLevel() {
        return Math.floor(Math.random() * (DIFFICULTY.initialFruitMaxLevel + 1));
    }

    get elapsedTime() { return this.elapsed; }

    start() {
        this.started = true;
        this.startTime = performance.now();
        this.pauseAccumulated = 0;
        this.pauseStart = 0;
        this.paused = false;
    }

    togglePause() {
        if (this.gameOver || !this.started) return;
        this.paused = !this.paused;
        if (this.paused) {
            this.pauseStart = performance.now();
        } else {
            this.pauseAccumulated += performance.now() - this.pauseStart;
            this.pauseStart = 0;
        }
    }

    getGameTimeSeconds() {
        if (!this.startTime) return 0;
        let now = performance.now();
        let paused = 0;
        if (this.paused && this.pauseStart > 0) {
            paused = now - this.pauseStart;
        }
        return (now - this.startTime - this.pauseAccumulated - paused) / 1000;
    }

    dropFruit(screenX) {
        if (this.gameOver || !this.started || this.paused) return;
        const now = performance.now();
        if (now - this.lastDropTime < DROP_DELAY) return;

        const fruitInfo = FRUITS[this.currentFruitLevel];
        let x = Math.max(WALL_THICKNESS + fruitInfo.radius, Math.min(GAME_WIDTH - WALL_THICKNESS - fruitInfo.radius, screenX));

        const body = Bodies.circle(GAME_OFFSET_X + x, GAME_OFFSET_Y + 80, fruitInfo.radius, {
            restitution: PHYSICS.restitution,
            friction: PHYSICS.friction,
            density: PHYSICS.density
        });
        Composite.add(this.world, body);

        this.fruits.push({
            body,
            level: this.currentFruitLevel,
            animationOffset: Math.floor(Math.random() * 3000),
            state: 'idle',
            hitStartTime: 0,
            isNewDrop: true,
            mergeAnimStartTime: 0,
            _pendingMergeId: null
        });

        this.sound.playDrop(this.currentFruitLevel);

        const droppedLevel = this.currentFruitLevel;
        this.currentFruitLevel = this.nextFruitLevel;
        this.nextFruitLevel = this._getRandomInitialLevel();
        this.lastDropTime = now;

        if (droppedLevel === 0) {
            this.alienChargeCount++;
            if (this.alienChargeCount >= SKILLS.alienDropCharge) {
                this.alienUsesLeft++;
                this.alienChargeCount = 0;
            }
        }
    }

    update(timestamp) {
        if (!this.started || this.paused || this.gameOverAnimating) {
            this.elapsed = timestamp;
            return;
        }

        this.elapsed = timestamp;
        Engine.update(this.engine, 1000 / 60);

        if (this.ufoActive && !this.gameOver) {
            if (timestamp - this.ufoStartTime > SKILLS.ufoDuration) {
                this.ufoActive = false;
            }
        }

        this._processPendingMerges(timestamp);
        this._updateFruitStates(timestamp);
        this._updateUFOFruits();
        this._updateScorePopups(timestamp);

        if (this.gameOverAnimating) {
            this._updateGameOverAnimation(timestamp);
            return;
        }

        if (!this.gameOver && this._checkGameOver(timestamp)) {
            this._startGameOverAnimation();
        }
    }

    _updateFruitStates(now) {
        for (const fruit of this.fruits) {
            if (!fruit.state) fruit.state = 'idle';
            if (fruit.state === 'hit' && fruit.hitStartTime && (now - fruit.hitStartTime) >= ANIM.hitDuration) {
                fruit.state = 'idle';
            }
            if (!fruit.isNewDrop) continue;
            const v = fruit.body.velocity;
            if (Math.abs(v.y) < 0.1 && Math.abs(v.x) < 0.1) {
                fruit.isNewDrop = false;
            }
        }
    }

    _handleCollision(event) {
        if (this.gameOver) return;

        const pairs = event.pairs;
        const processedFruits = new Set();

        for (const pair of pairs) {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            const fruitA = this.fruits.find(f => f.body === bodyA);
            const fruitB = this.fruits.find(f => f.body === bodyB);

            const hasNewDrop = (fruitA && fruitA.isNewDrop) || (fruitB && fruitB.isNewDrop);
            if (hasNewDrop) {
                if (fruitA) this._triggerHitState(fruitA);
                if (fruitB) this._triggerHitState(fruitB);
            }

            if (processedFruits.has(bodyA.id) || processedFruits.has(bodyB.id)) continue;
            if (!fruitA || !fruitB) continue;
            if (fruitA.level !== fruitB.level) continue;
            if (fruitA.level >= FRUITS.length - 1) continue;
            if (fruitA._pendingMergeId != null || fruitB._pendingMergeId != null) continue;

            const newLevel = fruitA.level + 1;
            const newPos = {
                x: (fruitA.body.position.x + fruitB.body.position.x) / 2,
                y: (fruitA.body.position.y + fruitB.body.position.y) / 2
            };

            processedFruits.add(bodyA.id);
            processedFruits.add(bodyB.id);

            const mergeId = Date.now() + Math.random();
            fruitA._pendingMergeId = mergeId;
            fruitB._pendingMergeId = mergeId;
            this.pendingMerges.push({
                fruitA, fruitB, newLevel, newPos, mergeId,
                startTime: performance.now()
            });
        }
    }

    _triggerHitState(fruitObj) {
        fruitObj.state = 'hit';
        fruitObj.hitStartTime = performance.now();
    }

    _processPendingMerges(now) {
        for (let i = this.pendingMerges.length - 1; i >= 0; i--) {
            const pm = this.pendingMerges[i];
            if (now - pm.startTime < MERGE_AUDIO_CFG.delay_time) continue;

            const fa = this.fruits.find(f => f._pendingMergeId === pm.mergeId && f.body === pm.fruitA.body);
            const fb = this.fruits.find(f => f._pendingMergeId === pm.mergeId && f.body === pm.fruitB.body);
            if (!fa || !fb) {
                this.pendingMerges.splice(i, 1);
                continue;
            }

            Composite.remove(this.world, fa.body);
            Composite.remove(this.world, fb.body);
            this.fruits = this.fruits.filter(f => f._pendingMergeId !== pm.mergeId);

            const newFruitInfo = FRUITS[pm.newLevel];
            const newBody = Bodies.circle(pm.newPos.x, pm.newPos.y, newFruitInfo.radius, {
                restitution: PHYSICS.restitution,
                friction: PHYSICS.friction,
                density: PHYSICS.density
            });
            Composite.add(this.world, newBody);
            this.fruits.push({
                body: newBody,
                level: pm.newLevel,
                animationOffset: Math.floor(Math.random() * 3000),
                state: 'idle',
                hitStartTime: 0,
                isNewDrop: false,
                mergeAnimStartTime: now,
                _pendingMergeId: null
            });

            this.score += newFruitInfo.score;
            this._addScorePopup(newFruitInfo.score, '#f9ca71');

            this.mergeEffects.push({
                x: pm.newPos.x, y: pm.newPos.y,
                radius: newFruitInfo.radius,
                startTime: now,
                frame: 0
            });

            this.sound.playMerge(pm.newLevel);
            this.pendingMerges.splice(i, 1);
        }
    }

    _addScorePopup(amount, colorHex) {
        this.scorePopups.push({
            amount, color: colorHex,
            startTime: performance.now(),
            baseY: this.lastPopupBaseY
        });
        this.lastPopupBaseY += 18;
    }

    _updateScorePopups(now) {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            if (now - this.scorePopups[i].startTime > 1500) {
                this.scorePopups.splice(i, 1);
            }
        }
        if (this.scorePopups.length === 0) {
            this.lastPopupBaseY = 15;
        }
    }

    _checkGameOver(now) {
        let hasStableFruitAbove = false;

        for (const fruit of this.fruits) {
            const fruitTop = fruit.body.position.y - GAME_OFFSET_Y - FRUITS[fruit.level].radius;
            if (fruitTop < this.dangerLineY) {
                const v = fruit.body.velocity;
                const speed = Math.sqrt(v.x * v.x + v.y * v.y);
                if (speed < 0.3) {
                    hasStableFruitAbove = true;
                    break;
                }
            }
        }

        if (this.dangerTime > 0) {
            if (!hasStableFruitAbove) {
                if (!this.dangerCooldownStart) {
                    this.dangerCooldownStart = now;
                } else if (now - this.dangerCooldownStart > 500) {
                    this.dangerTime = 0;
                    this.dangerCooldownStart = 0;
                }
            } else {
                this.dangerCooldownStart = 0;
            }
        } else {
            this.dangerCooldownStart = 0;
            if (hasStableFruitAbove) {
                this.dangerTime = now;
            }
        }

        if (this.dangerTime > 0) {
            const elapsed = (now - this.dangerTime) / 1000;
            if (elapsed > DIFFICULTY.dangerTimeoutSeconds) {
                return true;
            }
        }
        return false;
    }

    get DangerRemaining() {
        if (this.dangerTime <= 0) return -1;
        return DIFFICULTY.dangerTimeoutSeconds - (performance.now() - this.dangerTime) / 1000;
    }

    get IsInDanger() {
        return this.dangerTime > 0;
    }

    _startGameOverAnimation() {
        this.gameOver = true;
        this.gameOverAnimating = true;
        this.gameOverExplodeIndex = 0;
        this.gameOverExplodeTime = 0;

        this.fruits.sort((a, b) => {
            const aTop = a.body.position.y - FRUITS[a.level].radius;
            const bTop = b.body.position.y - FRUITS[b.level].radius;
            return aTop - bTop;
        });

        this.sound.play('gameover');
    }

    _updateGameOverAnimation(now) {
        if (this.gameOverExplodeIndex >= this.fruits.length) {
            this.fruits = [];
            this.mergeEffects = [];
            this.gameOverAnimating = false;
            this._onGameOver && this._onGameOver(this.score);
            return;
        }

        if (now - this.gameOverExplodeTime > 80) {
            const fruit = this.fruits[this.gameOverExplodeIndex];
            const level = fruit.level;
            this.sound.play('merge', { rate: this._mapRange(level, 1, 10, 0.7, 2.2) });

            Composite.remove(this.world, fruit.body);

            this.mergeEffects.push({
                x: fruit.body.position.x, y: fruit.body.position.y,
                radius: FRUITS[level].radius,
                startTime: now,
                frame: 0
            });

            this.gameOverExplodeIndex++;
            this.gameOverExplodeTime = now;
        }
    }

    _mapRange(value, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    }

    _updateUFOFruits() {
        if (!this.ufoActive || this.gameOver || this.gameOverAnimating) return;
        const maxLevel = FRUITS.length - 1;
        const limitY = GAME_OFFSET_Y + this.dangerLineY;

        for (const fruit of this.fruits) {
            const factor = SKILLS.ufoUpBaseline + (1 - SKILLS.ufoUpBaseline) * (1 - fruit.level / maxLevel);
            const upAccel = SKILLS.ufoUpAccel * factor;
            Body.applyForce(fruit.body, fruit.body.position, { x: 0, y: -upAccel * fruit.body.mass });

            if (fruit.body.velocity.y < -SKILLS.ufoMaxUpSpeed) {
                Body.setVelocity(fruit.body, { x: fruit.body.velocity.x, y: -SKILLS.ufoMaxUpSpeed });
            }
            Body.setVelocity(fruit.body, {
                x: fruit.body.velocity.x,
                y: fruit.body.velocity.y * SKILLS.ufoDamping
            });

            const fruitTop = fruit.body.position.y - FRUITS[fruit.level].radius;
            if (fruitTop < limitY) {
                Body.setPosition(fruit.body, {
                    x: fruit.body.position.x,
                    y: limitY + FRUITS[fruit.level].radius
                });
                Body.setVelocity(fruit.body, { x: fruit.body.velocity.x, y: 0 });
            }
        }
    }

    activateUFO() {
        if (this.ufoUsesLeft <= 0 || this.ufoActive || this.gameOver) return;
        this.ufoUsesLeft--;
        this.ufoActive = true;
        this.ufoStartTime = performance.now();
    }

    activateAlien() {
        if (this.alienUsesLeft <= 0 || this.gameOver) return;
        this.alienUsesLeft--;

        const alienRadius = FRUITS[0].radius;
        const now = performance.now();

        for (const fruit of this.fruits) {
            const oldRadius = FRUITS[fruit.level].radius;
            const scale = alienRadius / oldRadius;
            Body.scale(fruit.body, scale, scale);
            fruit.level = 0;
            fruit.animationOffset = Math.floor(Math.random() * 3000);
            fruit.state = 'idle';
            fruit.mergeAnimStartTime = now;
        }

        this._addScorePopup(0, '#8bc34a');
    }

    restart() {
        for (const fruit of this.fruits) {
            Composite.remove(this.world, fruit.body);
        }
        this.fruits = [];
        this.pendingMerges = [];
        this.mergeEffects = [];
        this.score = 0;
        this.gameOver = false;
        this.gameOverAnimating = false;
        this.gameOverExplodeIndex = 0;
        this.gameOverExplodeTime = 0;
        this.dangerTime = 0;
        this.dangerCooldownStart = 0;
        this.lastDropTime = 0;
        this.lastPopupBaseY = 15;
        this.sound.reset();

        this.world.gravity.y = PHYSICS.gravity;

        this.ufoUsesLeft = SKILLS.ufoMaxUses;
        this.ufoActive = false;
        this.ufoStartTime = 0;
        this.alienChargeCount = 0;
        this.alienUsesLeft = 0;

        this.startTime = performance.now();
        this.pauseAccumulated = 0;
        this.pauseStart = 0;
        this.paused = false;

        this.currentFruitLevel = this._getRandomInitialLevel();
        this.nextFruitLevel = this._getRandomInitialLevel();
        this.scorePopups = [];
    }

    on(event, callback) {
        if (event === 'gameOver') this._onGameOver = callback;
    }
}