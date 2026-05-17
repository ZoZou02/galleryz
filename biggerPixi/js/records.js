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

export function saveRecord(scoreVal, durationSec) {
    let records = loadRecords();
    const record = { score: scoreVal, duration: Math.floor(durationSec), ts: Date.now() };
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
    if (records.length < MAX_RECORDS) return true;
    return scoreVal > records[records.length - 1].score;
}

export function renderRecordsTable() {
    const records = loadRecords();
    const tbody = document.querySelector('#records-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-records">暂无记录</td></tr>';
        return;
    }

    records.forEach((r, i) => {
        const date = new Date(r.ts);
        const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' +
            String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        let rankIcon = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + rankIcon + (i + 1) + '</td>' +
            '<td>' + formatScore(r.score) + '</td>' +
            '<td>' + formatTime(r.duration) + '</td>' +
            '<td>' + dateStr + '</td>';
        if (i === 0) tr.classList.add('top-record');
        tbody.appendChild(tr);
    });
}