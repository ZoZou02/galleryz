// === 游戏状态 ===
const STATE = { IDLE: 'idle', SPINNING: 'spinning', STOPPING: 'stopping', RESULT: 'result' };

// === 符号定义：{ emoji, name, weight(出现概率权重), payout(三连倍率), type } ===
const SYMBOLS = [
  { emoji: '🍒', name: 'cherry', weight: 30, payout: 3, type: 'fruit' },
  { emoji: '🍋', name: 'lemon', weight: 25, payout: 3, type: 'fruit' },
  { emoji: '🍇', name: 'grape', weight: 20, payout: 5, type: 'fruit' },
  { emoji: '🍊', name: 'orange', weight: 15, payout: 5, type: 'fruit' },
  { emoji: '💎', name: 'diamond', weight: 7, payout: 10, type: 'gem' },
  { emoji: '7️⃣', name: 'seven', weight: 2, payout: 20, type: 'special' },
  { emoji: '⭐', name: 'star', weight: 1, payout: 0, type: 'scatter' },
];

const totalWeight = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

// === 游戏变量 ===
let gameState = STATE.IDLE;
let balance = 1000;
let bet = 10;
let message = '点击拉杆开始游戏!';
let messageTimer = 0;

const REEL_COUNT = 3;
const VISIBLE_ROWS = 3;
const REEL_LENGTH = 20;

// 每列的符号序列和滚动偏移
let reelSymbols = [];
let reelOffsets = [];
let reelSpeeds = [];
let reelStopping = [];
let reelStopTimes = [];
let reelClickPlayed = [];
let resultGrid = [];
let winLines = [];
let stopSoundPlayed = false;

// === 拉杆 ===
let leverY = 0;
let leverTargetY = 0;
let leverDragging = false;
let leverPulled = false;

// === 动画 ===
let winFlashTimer = 0;
let resultTimer = 0;

// === 布局变量（响应式计算） ===
let scale = 1;
let canvasW, canvasH;
let reelX, reelY, reelW, reelH, cellH;
let leverBaseX, leverBaseY, leverTopY, leverBallR;
let topBarY, balanceX, betX;
let btnMinusX, btnPlusX, btnSize;

function setup() {
  calcLayout();
  createCanvas(canvasW, canvasH);
  textFont('Arial');
  initReels();
  initAudio();
}

function windowResized() {
  calcLayout();
  resizeCanvas(canvasW, canvasH);
}

function calcLayout() {
  const w = windowWidth;
  const h = windowHeight;
  const aspect = 800 / 650;
  if (w / h > aspect) {
    canvasH = h;
    canvasW = h * aspect;
  } else {
    canvasW = w;
    canvasH = w / aspect;
  }
  scale = canvasW / 800;

  reelW = 130 * scale;
  reelH = 280 * scale;
  cellH = reelH / VISIBLE_ROWS;
  reelX = (canvasW - REEL_COUNT * reelW) / 2;
  reelY = canvasH * 0.25;

  leverBaseX = canvasW - 60 * scale;
  leverBaseY = canvasH * 0.2;
  leverTopY = canvasH * 0.2;
  leverBallR = 18 * scale;
  leverY = leverTopY;
  leverTargetY = leverTopY;

  topBarY = 15 * scale;
  balanceX = 20 * scale;
  betX = canvasW * 0.35;

  btnSize = 28 * scale;
  btnMinusX = canvasW * 0.65;
  btnPlusX = canvasW * 0.78;
}

function initReels() {
  reelSymbols = [];
  reelOffsets = [];
  reelSpeeds = [];
  reelStopping = [];
  reelStopTimes = [];
  reelClickPlayed = [];
  resultGrid = [];
  winLines = [];
  stopSoundPlayed = false;
  for (let i = 0; i < REEL_COUNT; i++) {
    reelSymbols[i] = generateReel();
    reelOffsets[i] = 0;
    reelSpeeds[i] = 0;
    reelStopping[i] = false;
    reelStopTimes[i] = 0;
    reelClickPlayed[i] = false;
    resultGrid[i] = [];
    for (let r = 0; r < VISIBLE_ROWS; r++) {
      resultGrid[i][r] = null;
    }
  }
}

function generateReel() {
  const reel = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    reel.push(weightedRandomSymbol());
  }
  return reel;
}

function weightedRandomSymbol() {
  let r = random(totalWeight);
  let cumulative = 0;
  for (const sym of SYMBOLS) {
    cumulative += sym.weight;
    if (r < cumulative) return sym;
  }
  return SYMBOLS[0];
}

// === 音效（使用振荡器） ===
let spinOsc, winOsc, clickOsc;
let audioStarted = false;

function initAudio() {
  if (typeof p5 === 'undefined' || !p5.prototype) return;
}

function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  try {
    if (getAudioContext()) getAudioContext().resume();
  } catch (e) {}
}

function playSpinSound() {
  if (!audioStarted) return;
  try {
    if (spinOsc) spinOsc.stop();
    spinOsc = new p5.Oscillator(200, 'sawtooth');
    spinOsc.amp(0.06);
    spinOsc.start();
  } catch (e) {}
}

function stopSpinSound() {
  try {
    if (spinOsc) { spinOsc.stop(); spinOsc = null; }
  } catch (e) {}
}

function playClickSound() {
  if (!audioStarted) return;
  try {
    clickOsc = new p5.Oscillator(800, 'square');
    clickOsc.amp(0.1, 0);
    clickOsc.amp(0, 0.1);
    clickOsc.start();
    clickOsc.stop(0.1);
  } catch (e) {}
}

function playWinSound() {
  if (!audioStarted) return;
  try {
    winOsc = new p5.Oscillator(523, 'sine');
    winOsc.amp(0.08);
    winOsc.start();
    setTimeout(() => { try { winOsc.freq(659); } catch (e) {} }, 120);
    setTimeout(() => { try { winOsc.freq(784); } catch (e) {} }, 240);
    setTimeout(() => { try { winOsc.amp(0, 0.4); winOsc.stop(); } catch (e) {} }, 500);
  } catch (e) {}
}

function playBigWinSound() {
  if (!audioStarted) return;
  try {
    winOsc = new p5.Oscillator(523, 'sine');
    winOsc.amp(0.1);
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => { try { winOsc.freq(f); } catch (e) {} }, i * 100);
    });
    setTimeout(() => { try { winOsc.amp(0, 0.5); winOsc.stop(); } catch (e) {} }, 600);
  } catch (e) {}
}

// === 绘制主循环 ===
function draw() {
  background(30, 20, 50);

  drawBackgroundDecor();
  drawTopBar();
  drawReels();
  drawLever();
  drawBetControls();
  drawMessage();

  updateGameLogic();
  updateLever();
}

function drawBackgroundDecor() {
  // 装饰边框
  noFill();
  stroke(255, 215, 0, 80);
  strokeWeight(3 * scale);
  const margin = 8 * scale;
  rect(margin, margin, canvasW - 2 * margin, canvasH - 2 * margin, 15 * scale);

  stroke(255, 215, 0, 40);
  strokeWeight(1 * scale);
  rect(margin + 5 * scale, margin + 5 * scale, canvasW - 2 * (margin + 5 * scale), canvasH - 2 * (margin + 5 * scale), 10 * scale);

  // 标题
  fill(255, 215, 0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(22 * scale);
  text('🎰 老虎机 🎰', canvasW / 2, topBarY + 25 * scale);
}

function drawTopBar() {
  // 余额显示
  fill(255, 215, 0);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(14 * scale);
  text('💰 余额: ' + balance, balanceX, topBarY + 55 * scale);

  // 汇率说明
  fill(200, 200, 200);
  textSize(10 * scale);
  textAlign(RIGHT, CENTER);
  text('汇率: 1元 = 1金币 | 本金: ¥1000', canvasW - 20 * scale, topBarY + 55 * scale);
}

function drawBetControls() {
  fill(200, 200, 200);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(13 * scale);
  text('🎫 投注: ' + bet, betX, topBarY + 55 * scale);

  // - 按钮
  drawButton(btnMinusX, topBarY + 55 * scale, '-', gameState === STATE.IDLE);
  // + 按钮
  drawButton(btnPlusX, topBarY + 55 * scale, '+', gameState === STATE.IDLE);
}

function drawButton(x, y, label, enabled) {
  const b = btnSize;
  fill(enabled ? color(60, 60, 100) : color(40, 40, 60));
  stroke(enabled ? color(255, 215, 0) : color(100, 100, 100));
  strokeWeight(2 * scale);
  rectMode(CENTER);
  rect(x, y, b, b, 6 * scale);
  rectMode(CORNER);

  fill(enabled ? color(255, 215, 0) : color(150, 150, 150));
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(18 * scale);
  text(label, x, y - 1 * scale);
}

function drawMessage() {
  if (messageTimer > 0) {
    messageTimer--;
    const alpha = map(messageTimer, 0, 60, 0, 255);
    fill(255, 255, 200, alpha);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16 * scale);
    text(message, canvasW / 2, canvasH - 25 * scale);
  }
}

function showMessage(msg, duration = 90) {
  message = msg;
  messageTimer = duration;
}

// === 绘制转轮 ===
function drawReels() {
  // 转轮背景
  fill(20, 15, 40);
  stroke(255, 215, 0, 100);
  strokeWeight(3 * scale);
  rect(reelX - 10 * scale, reelY - 5 * scale,
    REEL_COUNT * reelW + 20 * scale, reelH + 10 * scale, 12 * scale);

  // 分隔线
  stroke(255, 215, 0, 30);
  strokeWeight(1 * scale);
  for (let r = 1; r < VISIBLE_ROWS; r++) {
    const y = reelY + r * cellH;
    line(reelX - 5 * scale, y, reelX + REEL_COUNT * reelW + 5 * scale, y);
  }

  noStroke();
  for (let col = 0; col < REEL_COUNT; col++) {
    const x = reelX + col * reelW;
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      const y = reelY + row * cellH;
      const symIndex = getSymbolIndex(col, row);

      // 中奖高亮
      if (winFlashTimer > 0 && isWinningCell(col, row)) {
        const pulse = sin(frameCount * 0.3) * 0.3 + 0.7;
        fill(255, 215, 0, 80 * pulse);
        rect(x + 3 * scale, y + 3 * scale, reelW - 6 * scale, cellH - 6 * scale, 8 * scale);
      }

      // 符号绘制
      const sym = reelSymbols[col][((symIndex % REEL_LENGTH) + REEL_LENGTH) % REEL_LENGTH];
      if (sym && sym.emoji) {
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(cellH * 0.55);
        text(sym.emoji, x + reelW / 2, y + cellH / 2);
      }
    }

    // 列分隔线
    if (col < REEL_COUNT - 1) {
      stroke(255, 215, 0, 40);
      strokeWeight(1 * scale);
      const sepX = x + reelW;
      line(sepX, reelY, sepX, reelY + reelH);
      noStroke();
    }
  }

  // 列顶部和底部的遮罩
  const maskH = cellH * 0.3;
  for (let col = 0; col < REEL_COUNT; col++) {
    const x = reelX + col * reelW;
    // 顶部渐变遮罩
    drawMaskGradient(x, reelY, reelW, maskH, 0);
    // 底部渐变遮罩
    drawMaskGradient(x, reelY + reelH - maskH, reelW, maskH, 1);
  }
}

function drawMaskGradient(x, y, w, h, dir) {
  for (let i = 0; i < h; i += 2) {
    const alpha = dir === 0 ? map(i, 0, h, 200, 0) : map(i, 0, h, 0, 200);
    fill(20, 15, 38, alpha);
    noStroke();
    rect(x, y + i, w, 2);
  }
}

function getSymbolIndex(col, row) {
  const offset = reelOffsets[col];
  return floor(offset) + row;
}

function isWinningCell(col, row) {
  for (const line of winLines) {
    if (line.col === col && line.row === row) return true;
  }
  return false;
}

// === 绘制拉杆 ===
function drawLever() {
  const lx = leverBaseX;
  const ly = leverBaseY;
  const topY = leverY;
  const rodW = 10 * scale;
  const baseH = 30 * scale;
  const baseW = 30 * scale;

  // 底座
  fill(80, 80, 100);
  stroke(180, 180, 200);
  strokeWeight(2 * scale);
  rectMode(CENTER);
  rect(lx, ly, baseW, baseH, 5 * scale);
  rectMode(CORNER);

  // 滑槽
  fill(40, 40, 60);
  noStroke();
  rect(lx - rodW / 2 - 3 * scale, topY, rodW + 6 * scale, ly - topY - baseH / 2, 3 * scale);

  // 拉杆杆身
  const rodBottom = min(ly - baseH / 2, leverY + leverBallR + 5 * scale);
  fill(200, 200, 220);
  stroke(150, 150, 180);
  strokeWeight(1 * scale);
  rect(lx - rodW / 2, topY, rodW, rodBottom - topY, 3 * scale);

  // 拉杆球头
  const ballY = clamp(leverY, topY + leverBallR, ly - baseH / 2);
  fill(255, 60, 60);
  stroke(200, 30, 30);
  strokeWeight(2 * scale);
  circle(lx, ballY, leverBallR * 2);

  // 高光
  fill(255, 150, 150);
  noStroke();
  circle(lx - 3 * scale, ballY - 3 * scale, leverBallR * 0.7);
}

// === 拉杆逻辑 ===
function updateLever() {
  if (!leverDragging && !leverPulled) {
    leverY = lerp(leverY, leverTargetY, 0.15);
  }
}

function isOnLeverBall(mx, my) {
  const ballY = clamp(leverY, leverTopY + leverBallR, leverBaseY - 30 * scale);
  return dist(mx, my, leverBaseX, ballY) < leverBallR * 1.5;
}

function mousePressed() {
  startAudio();

  // 拉杆球头
  if (isOnLeverBall(mouseX, mouseY) && gameState === STATE.IDLE) {
    leverDragging = true;
    return false;
  }

  // 点击转轮区域也可触发旋转（移动端友好）
  if (gameState === STATE.IDLE) {
    const reelAreaX = reelX - 10 * scale;
    const reelAreaY = reelY - 5 * scale;
    const reelAreaW = REEL_COUNT * reelW + 20 * scale;
    const reelAreaH = reelH + 10 * scale;
    if (mouseX > reelAreaX && mouseX < reelAreaX + reelAreaW &&
        mouseY > reelAreaY && mouseY < reelAreaY + reelAreaH) {
      leverPulled = true;
      startSpin();
      return false;
    }
  }

  // 投注按钮
  if (gameState === STATE.IDLE) {
    const btnY = topBarY + 55 * scale;
    if (abs(mouseY - btnY) < btnSize / 2) {
      if (abs(mouseX - btnMinusX) < btnSize / 2) {
        adjustBet(-1);
        return false;
      }
      if (abs(mouseX - btnPlusX) < btnSize / 2) {
        adjustBet(1);
        return false;
      }
    }
  }

  return false;
}

function mouseDragged() {
  if (leverDragging && gameState === STATE.IDLE) {
    const maxY = leverBaseY - 30 * scale;
    leverY = constrain(mouseY, leverTopY, maxY);

    if (leverY > leverTopY + 60 * scale && !leverPulled) {
      leverPulled = true;
      startSpin();
    }
  }
  return false;
}

function mouseReleased() {
  if (leverDragging) {
    leverDragging = false;
    if (!leverPulled) {
      leverTargetY = leverTopY;
    }
  }
  return false;
}

function keyPressed() {
  if (gameState !== STATE.IDLE) return false;

  if (keyCode === ENTER || keyCode === RETURN || key === ' ') {
    startSpin();
    return false;
  }

  if (keyCode === UP_ARROW) { adjustBet(1); return false; }
  if (keyCode === DOWN_ARROW) { adjustBet(-1); return false; }

  return false;
}

function adjustBet(delta) {
  const steps = [1, 5, 10, 25, 50, 100, 500];
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (bet <= steps[i]) { idx = i; break; }
    if (i === steps.length - 1) idx = steps.length - 1;
  }

  if (delta > 0) {
    idx = min(idx + 1, steps.length - 1);
  } else {
    idx = max(idx - 1, 0);
  }

  let newBet = steps[idx];
  if (newBet === bet) {
    if (delta > 0) newBet = min(bet + 10, balance);
    else newBet = max(bet - 1, 1);
  }

  bet = constrain(newBet, 1, balance);
}

// === 游戏逻辑 ===
function startSpin() {
  if (gameState !== STATE.IDLE) return;
  if (bet > balance) {
    showMessage('余额不足!');
    return;
  }
  if (bet <= 0) {
    showMessage('请设置有效投注!');
    return;
  }

  startAudio();
  gameState = STATE.SPINNING;
  balance -= bet;
  winLines = [];
  winFlashTimer = 0;
  resultTimer = 0;
  message = '';

  for (let i = 0; i < REEL_COUNT; i++) {
    reelSymbols[i] = generateReel();
    reelStopping[i] = false;
    reelClickPlayed[i] = false;
    reelSpeeds[i] = random(0.18, 0.32);
    reelStopTimes[i] = frameCount + 30 + i * random(30, 55);
  }
  stopSoundPlayed = false;

  playSpinSound();
  showMessage('转动中...', 999);
}

function updateGameLogic() {
  if (gameState === STATE.RESULT) {
    resultTimer--;
    if (winFlashTimer > 0) winFlashTimer--;
    if (resultTimer <= 0) {
      gameState = STATE.IDLE;
      leverPulled = false;
      leverTargetY = leverTopY;
      if (balance <= 0) {
        balance = 1000;
        showMessage('已重置本金为 ¥1000, 继续游戏吧!', 120);
      }
    }
    return;
  }

  if (gameState !== STATE.SPINNING) return;

  for (let i = 0; i < REEL_COUNT; i++) {
    if (reelStopping[i]) {
      reelSpeeds[i] *= 0.92;
      reelOffsets[i] += reelSpeeds[i];
      reelOffsets[i] = reelOffsets[i] % REEL_LENGTH;

      if (reelSpeeds[i] < 0.008) {
        reelSpeeds[i] = 0;
        reelOffsets[i] = round(reelOffsets[i]) % REEL_LENGTH;
        if (!reelClickPlayed[i]) {
          reelClickPlayed[i] = true;
          playClickSound();
        }
      }
    } else if (frameCount >= reelStopTimes[i]) {
      reelStopping[i] = true;
      if (!stopSoundPlayed) {
        stopSoundPlayed = true;
        stopSpinSound();
      }
    } else {
      reelOffsets[i] += reelSpeeds[i];
      reelOffsets[i] = reelOffsets[i] % REEL_LENGTH;
    }
  }

  let allStopped = true;
  for (let i = 0; i < REEL_COUNT; i++) {
    if (reelSpeeds[i] > 0.001) allStopped = false;
  }

  if (allStopped) {
    stopSpinSound();
    settleResult();
  }
}

function settleResult() {
  // 读取结果网格
  for (let col = 0; col < REEL_COUNT; col++) {
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      const idx = ((getSymbolIndex(col, row) % REEL_LENGTH) + REEL_LENGTH) % REEL_LENGTH;
      resultGrid[col][row] = reelSymbols[col][idx];
    }
  }

  // 计算奖励
  const result = calculatePayout();
  const payout = result.total;
  winLines = result.lines;

  if (payout > 0) {
    balance += payout;
    winFlashTimer = 90;
    resultTimer = 120;
    gameState = STATE.RESULT;
    showMessage('🎉 赢得 ' + payout + ' 金币!', 150);

    if (payout >= bet * 20) {
      playBigWinSound();
      showMessage('🎊 大奖! 赢得 ' + payout + ' 金币! 🎊', 180);
    } else {
      playWinSound();
    }
  } else {
    resultTimer = 60;
    gameState = STATE.RESULT;
    showMessage('😢 未中奖, 再试一次!', 80);
  }

  // 更新拉杆状态
  if (!leverDragging) {
    leverTargetY = leverTopY;
    leverPulled = false;
  }
}

function calculatePayout() {
  let total = 0;
  const lines = [];

  // 1. 横向三连检测（三行）
  for (let row = 0; row < VISIBLE_ROWS; row++) {
    const sym0 = resultGrid[0][row];
    const sym1 = resultGrid[1][row];
    const sym2 = resultGrid[2][row];

    if (sym0 && sym1 && sym2 && sym0.name === sym1.name && sym1.name === sym2.name) {
      if (sym0.type !== 'scatter') {
        const win = bet * sym0.payout;
        total += win;
        for (let c = 0; c < REEL_COUNT; c++) {
          lines.push({ col: c, row: row });
        }
      }
    }
  }

  // 2. 特殊777检测
  if (resultGrid[0][1] && resultGrid[1][1] && resultGrid[2][1] &&
    resultGrid[0][1].name === 'seven' &&
    resultGrid[1][1].name === 'seven' &&
    resultGrid[2][1].name === 'seven') {
    // 777已在三连中计算，额外加bonus
    total += bet * 10;
  }

  // 3. 分散图案奖励（⭐）
  let scatterCount = 0;
  const scatterPositions = [];
  for (let col = 0; col < REEL_COUNT; col++) {
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      if (resultGrid[col][row] && resultGrid[col][row].type === 'scatter') {
        scatterCount++;
        scatterPositions.push({ col, row });
      }
    }
  }

  if (scatterCount >= 2) {
    const multiplier = scatterCount === 3 ? 5 : 2;
    const win = bet * multiplier;
    total += win;
    for (const pos of scatterPositions) {
      lines.push(pos);
    }
  }

  // 4. 任意两连（中间行）
  const midRow = 1;
  if (resultGrid[0][midRow] && resultGrid[1][midRow] &&
    resultGrid[0][midRow].name === resultGrid[1][midRow].name &&
    resultGrid[0][midRow].type !== 'scatter') {
    // 检查是否已有三连覆盖
    const alreadyThree = lines.some(l => l.col === 0 && l.row === midRow);
    if (!alreadyThree) {
      total += bet * 1;
      lines.push({ col: 0, row: midRow });
      lines.push({ col: 1, row: midRow });
    }
  }
  if (resultGrid[1][midRow] && resultGrid[2][midRow] &&
    resultGrid[1][midRow].name === resultGrid[2][midRow].name &&
    resultGrid[1][midRow].type !== 'scatter') {
    const alreadyThree = lines.some(l => l.col === 1 && l.row === midRow);
    if (!alreadyThree) {
      total += bet * 1;
      lines.push({ col: 1, row: midRow });
      lines.push({ col: 2, row: midRow });
    }
  }

  return { total, lines };
}

// === 辅助函数 ===
function clamp(val, minVal, maxVal) {
  return constrain(val, minVal, maxVal);
}