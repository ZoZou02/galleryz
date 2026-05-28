/**
 * 排行榜存储
 * 本地存储管理历史游戏记录
 */

import { RECORDS_KEY, MAX_RECORDS, formatScore, formatTime } from './config.js';

export function loadRecords() {
    try {
        const data = localStorage.getItem(RECORDS_KEY);
        if (!data) return [];
        const records = JSON.parse(data);
        if (!Array.isArray(records)) return [];
        return records.filter(r => typeof r.score === 'number' && typeof r.ts === 'number');
    } catch (e) { return []; }
}

export function saveRecord(scoreVal, durationSec, gbCount) {
    if (scoreVal <= 0) return;
    let records = loadRecords();
    const record = { score: scoreVal, duration: Math.floor(durationSec), ts: Date.now(), gb: gbCount || 0 };
    records.push(record);
    records.sort((a, b) => b.score - a.score);
    records = records.slice(0, MAX_RECORDS);
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
    return records;
}

export function getRecordRank(scoreVal, records) {
    let rank = 1;
    for (const r of records) {
        if (r.score > scoreVal) rank++;
        else break;
    }
    return rank;
}

export function isNewRecord(scoreVal, records) {
    if (scoreVal <= 0) return false;
    if (records.length === 0) return true;
    return scoreVal > records[0].score;
}

export function renderRecordsTable() {
    const records = loadRecords();
    const tbody = document.querySelector('#records-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-records">暂无记录</td></tr>';
        updateScrollHint();
        return;
    }

    records.forEach((r, i) => {
        const tr = document.createElement('tr');
        const gbTag = (r.gb && r.gb > 0) ? '<span class="gb-tag">G</span>' : '';
        tr.innerHTML =
            '<td>' + (i + 1) + '</td>' +
            '<td>' + formatScore(r.score)  + '</td>' +
            '<td>' + formatTime(r.duration)+ gbTag + '</td>';
        if (i === 0) {
            tr.classList.add('rank-1');
        } else if (i === 1) {
            tr.classList.add('rank-2');
        } else if (i === 2) {
            tr.classList.add('rank-3');
        }
        tbody.appendChild(tr);
    });

    updateScrollHint();
}

function updateScrollHint() {
    const wrap = document.querySelector('.records-table-wrap');
    if (!wrap) return;
    if (wrap.scrollHeight > wrap.clientHeight) {
        wrap.classList.add('overflow');
    } else {
        wrap.classList.remove('overflow', 'scrolled-bottom');
    }
}