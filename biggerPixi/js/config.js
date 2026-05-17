export const GAME_WIDTH = 350;
export const GAME_HEIGHT = 550;
export const WALL_THICKNESS = 20;
export const PANEL_WIDTH = 425;
export const PANEL_HEIGHT = 768;
export const GAME_OFFSET_X = (PANEL_WIDTH - GAME_WIDTH) / 2;
export const GAME_OFFSET_Y = (PANEL_WIDTH - GAME_WIDTH) / 2 - 10;

export const PHYSICS = {
    gravity: 1.2,
    restitution: 0.2,
    friction: 0.1,
    density: 0.001
};

export const DIFFICULTY = {
    initialFruitMaxLevel: 4,
    dangerTimeoutSeconds: 5
};

export const FRUITS = [
    { name: '👽',     radius: 16, color: '#9B59B6', score: 10,  row: 0 },
    { name: '残杀',   radius: 22, color: '#E74C3C', score: 20,  row: 1 },
    { name: '口几口', radius: 28, color: '#F39C12', score: 30,  row: 2 },
    { name: '象姐',   radius: 34, color: '#F1C40F', score: 40,  row: 3 },
    { name: '芙老大', radius: 38, color: '#8BC34A', score: 50,  row: 4 },
    { name: '牧牧川', radius: 44, color: '#E67E22', score: 60,  row: 5 },
    { name: '抽子',   radius: 50, color: '#FFB6C1', score: 70,  row: 6 },
    { name: '悠姆帕', radius: 54, color: '#FFD700', score: 80,  row: 7 },
    { name: '鸟哥',   radius: 58, color: '#D2691E', score: 90,  row: 8 },
    { name: '李哥',   radius: 62, color: '#2ECC71', score: 100, row: 9 },
    { name: 'GEE',    radius: 66, color: '#27AE60', score: 150, row: 10 }
];

export const ANIM = {
    frameDuration: 50,
    loopDelay: 2000,
    hitDuration: 300,
    mergeScaleShrinkDuration: 80,
    mergeScaleGrowDuration: 120,
    mergeScaleMin: 0.5,
    mergeScaleMax: 1.2
};

export const MERGE_AUDIO_CFG = {
    delay_time: 80,
    base_pitch: 0.7,
    pitch_per_level: 0.2
};

export const SKILLS = {
    btnW: 90, btnH: 52,
    btnGap: 18,
    btnY: GAME_OFFSET_Y + GAME_HEIGHT + 42,
    ufoMaxUses: 2,
    ufoDuration: 3500,
    ufoUpAccel: 0.0080,
    ufoMaxUpSpeed: 2.5,
    ufoDamping: 0.97,
    ufoUpBaseline: 0.2,
    alienDropCharge: 10
};

export const EGG_ANIM = {
    closeDuration: 80,
    closedDelay: 180,
    openDuration: 400,
    maxAngle: Math.PI / 4.0
};

export const BOOP_FRAMES = 5;
export const BOOP_FRAME_DURATION = 50;

export const RECORDS_KEY = 'gb_merge_records_pixi';
export const MAX_RECORDS = 10;

export const DROP_DELAY = 500;

export const VOICE_CFG = {
    voiceVariants: [],
    voiceChance: 0.35
};

export function formatScore(n) {
    return n.toLocaleString('en-US');
}

export function formatTime(seconds) {
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

export function getAnimationFrameIndex(elapsed, offset = 0) {
    const playSequence = [0, 1, 2, 3, 1, 0];
    const sequenceLength = playSequence.length;
    const duration = sequenceLength * ANIM.frameDuration;
    const cycleLength = duration + ANIM.loopDelay;
    const t = ((elapsed + offset) % cycleLength + cycleLength) % cycleLength;

    if (t < duration) {
        return playSequence[Math.floor(t / ANIM.frameDuration) % sequenceLength];
    }
    return 0;
}