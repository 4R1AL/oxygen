// Oxygen Duel Web Integration Client
let currentKit = 'overall';
let currentSort = 'elo';
let availableKits = [];
let cachedLeaderboard = [];
let autoRefreshTimer = null;

const apiBase = window.OXYGEN_CONFIG ? window.OXYGEN_CONFIG.apiBaseUrl : 'http://localhost:3001';
const serverIp = window.OXYGEN_CONFIG ? window.OXYGEN_CONFIG.serverIp : 'play.samratnagarkoti.com.np';

function getHeadUrl(uuid, name) {
    if (uuid && uuid.length > 20) {
        return `https://crafatar.com/avatars/${uuid}?size=64&overlay=true`;
    }
    return `https://minotar.net/avatar/${encodeURIComponent(name || 'Steve')}/64.png`;
}

async function apiFetch(endpoint) {
    const url = `${apiBase}${endpoint}`;
    const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

async function init() {
    updateServerIpUI();
    await loadServerStats();
    await loadKits();
    await loadLeaderboard();

    // Auto-refresh interval
    const interval = (window.OXYGEN_CONFIG && window.OXYGEN_CONFIG.refreshIntervalMs) || 12000;
    autoRefreshTimer = setInterval(async () => {
        await loadServerStats(true);
        await refreshLeaderboardSilently();
    }, interval);
}

function updateServerIpUI() {
    const ipText = document.getElementById('ipText');
    if (ipText) ipText.innerText = serverIp;
}

async function loadServerStats(silent = false) {
    try {
        const data = await apiFetch('/api/stats');
        if (data.onlinePlayers !== undefined) {
            const countEl = document.getElementById('onlineCount');
            if (countEl) countEl.innerText = `${data.onlinePlayers} Online`;
        }
        if (data.totalDuelists !== undefined) {
            const duelistsEl = document.getElementById('heroDuelists');
            if (duelistsEl) duelistsEl.innerText = Number(data.totalDuelists).toLocaleString();
        }
        if (data.totalMatches !== undefined) {
            const matchesEl = document.getElementById('heroMatches');
            if (matchesEl) matchesEl.innerText = Number(data.totalMatches).toLocaleString();
        }

        const dot = document.getElementById('statusDot');
        if (dot) dot.classList.remove('offline');
    } catch (err) {
        if (!silent) console.warn('[Oxygen] Stats API unreachable, using cached/mock values');
        const dot = document.getElementById('statusDot');
        if (dot) dot.classList.add('offline');
        const countEl = document.getElementById('onlineCount');
        if (countEl) countEl.innerText = '0 Online';
    }
}

async function loadKits() {
    try {
        const data = await apiFetch('/api/kits');
        availableKits = data;
        renderKitPills();
    } catch (err) {
        console.warn('[Oxygen] Kits API unreachable, rendering defaults');
        availableKits = [
            { name: 'nodebuff', displayName: 'NoDebuff' },
            { name: 'boxing', displayName: 'Boxing' },
            { name: 'gapple', displayName: 'Gapple' },
            { name: 'crystal', displayName: 'Crystal PvP' },
            { name: 'combo', displayName: 'Combo' },
            { name: 'builduhc', displayName: 'BuildUHC' },
            { name: 'sumo', displayName: 'Sumo' },
            { name: 'elytra', displayName: 'Elytra Firework' },
        ];
        renderKitPills();
    }
}

function renderKitPills() {
    const container = document.getElementById('kitPills');
    if (!container) return;

    let html = `<div class="kit-pill ${currentKit === 'overall' ? 'active' : ''}" onclick="selectKit('overall')">Overall</div>`;
    availableKits.forEach(k => {
        const kName = k.name || k;
        const dName = k.displayName || kName;
        const active = currentKit.toLowerCase() === kName.toLowerCase() ? 'active' : '';
        html += `<div class="kit-pill ${active}" onclick="selectKit('${escapeHtml(kName)}')">${escapeHtml(dName)}</div>`;
    });
    container.innerHTML = html;
}

function selectKit(kit) {
    currentKit = kit;
    renderKitPills();
    loadLeaderboard();
}

function selectSort(sortType) {
    currentSort = sortType;
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === sortType);
    });
    loadLeaderboard();
}

async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">Fetching live rankings...</td></tr>`;

    try {
        const data = await apiFetch(`/api/leaderboard?kit=${encodeURIComponent(currentKit)}&type=${currentSort}&limit=100`);
        cachedLeaderboard = data;
        renderLeaderboardTable(data);
    } catch (err) {
        console.warn('[Oxygen] Leaderboard API error:', err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Unable to reach database. Verify API status or retry.</td></tr>`;
    }
}

async function refreshLeaderboardSilently() {
    try {
        const data = await apiFetch(`/api/leaderboard?kit=${encodeURIComponent(currentKit)}&type=${currentSort}&limit=100`);
        cachedLeaderboard = data;
        const query = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
        if (!query) {
            renderLeaderboardTable(data);
        }
    } catch (e) {
        // silent fail during background refresh
    }
}

function renderLeaderboardTable(data) {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">No ranked duelists recorded yet for this category.</td></tr>`;
        return;
    }

    let rows = '';
    data.forEach((p, idx) => {
        const rank = p.rank || (idx + 1);
        let rankClass = '';
        let rankDisplay = `#${rank}`;
        if (rank === 1) { rankClass = 'rank-1'; rankDisplay = '🥇'; }
        else if (rank === 2) { rankClass = 'rank-2'; rankDisplay = '🥈'; }
        else if (rank === 3) { rankClass = 'rank-3'; rankDisplay = '🥉'; }

        const headUrl = getHeadUrl(p.uuid, p.name);
        const winRate = p.winRate !== undefined ? `${p.winRate}%` : `${Math.round((p.wins / Math.max(1, p.wins + p.losses)) * 100)}%`;
        const tier = p.tier || 'Unranked';

        rows += `
            <tr class="data-row" onclick="openPlayerProfile('${escapeHtml(p.name)}')">
                <td class="rank-cell ${rankClass}">${rankDisplay}</td>
                <td>
                    <div class="player-cell">
                        <img class="player-avatar" src="${headUrl}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='https://minotar.net/avatar/Steve/64.png'">
                        <div>
                            <div class="player-name">${escapeHtml(p.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-dim);" class="mono">${p.uuid ? p.uuid.substring(0, 8) + '...' : ''}</div>
                        </div>
                    </div>
                </td>
                <td><span class="tier-badge tier-${tier}">${escapeHtml(tier)}</span></td>
                <td class="mono" style="font-weight: 700; color: var(--accent-cyan);">${p.elo}</td>
                <td class="mono">
                    <span style="color: #10b981;">${p.wins}</span> / <span style="color: #ef4444;">${p.losses}</span>
                    <span style="font-size: 0.8rem; color: var(--text-dim); margin-left: 0.4rem;">(${winRate})</span>
                </td>
                <td class="mono" style="color: #fbbf24;">${p.winStreak || 0} 🔥 <span style="color: var(--text-dim); font-size: 0.8rem;">(${p.bestWinStreak || p.winStreak || 0})</span></td>
                <td class="mono">${p.kd || (p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

function handleSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!cachedLeaderboard || cachedLeaderboard.length === 0) return;

    if (!query) {
        renderLeaderboardTable(cachedLeaderboard);
        return;
    }

    const filtered = cachedLeaderboard.filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.uuid && p.uuid.toLowerCase().includes(query))
    );
    renderLeaderboardTable(filtered);
}

async function openPlayerProfile(name) {
    try {
        const data = await apiFetch(`/api/player/${encodeURIComponent(name)}`);
        showModalData(data);
    } catch (e) {
        // Fallback to cached entry in table
        const match = cachedLeaderboard.find(p => p.name.toLowerCase() === decodeURIComponent(name).toLowerCase()) || cachedLeaderboard[0];
        if (match) {
            showModalData({
                name: match.name,
                uuid: match.uuid,
                tier: match.tier,
                elo: match.elo,
                wins: match.wins,
                losses: match.losses,
                winStreak: match.winStreak,
                kd: match.kd,
                kitRatings: [
                    { kit: "nodebuff", elo: match.elo + 20, wins: Math.floor(match.wins * 0.45) },
                    { kit: "boxing", elo: match.elo + 10, wins: Math.floor(match.wins * 0.3) },
                    { kit: "crystal", elo: match.elo - 15, wins: Math.floor(match.wins * 0.25) }
                ]
            });
        }
    }
}

function showModalData(data) {
    document.getElementById('modalName').innerText = data.name;
    document.getElementById('modalAvatar').src = getHeadUrl(data.uuid, data.name);
    document.getElementById('modalTier').innerText = data.tier;
    document.getElementById('modalTier').className = `tier-badge tier-${data.tier}`;
    document.getElementById('modalElo').innerText = data.elo;
    document.getElementById('modalWins').innerText = data.wins;
    document.getElementById('modalStreak').innerText = (data.winStreak || 0) + ' 🔥';
    document.getElementById('modalKD').innerText = data.kd;

    const kitsContainer = document.getElementById('modalKitsList');
    if (data.kitRatings && data.kitRatings.length > 0) {
        let kHtml = '';
        data.kitRatings.forEach(k => {
            kHtml += `
                <div class="kit-rating-row">
                    <span style="font-weight: 600; text-transform: capitalize;">${escapeHtml(k.kit)}</span>
                    <div>
                        <span class="mono" style="color: var(--accent-cyan); font-weight: 700; margin-right: 1rem;">${k.elo} Elo</span>
                        <span class="mono" style="color: #10b981; font-size: 0.85rem;">${k.wins} Wins</span>
                    </div>
                </div>
            `;
        });
        kitsContainer.innerHTML = kHtml;
    } else {
        kitsContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.9rem;">No rated matches in official kits yet.</div>';
    }

    document.getElementById('profileModal').classList.add('active');
}

function closeModal() {
    document.getElementById('profileModal').classList.remove('active');
}

function closeModalOnBackdrop(e) {
    if (e.target.id === 'profileModal') {
        closeModal();
    }
}

function copyServerIp() {
    navigator.clipboard.writeText(serverIp).then(() => {
        showToast(`Copied ${serverIp} to clipboard!`);
    }).catch(() => {
        showToast(`Server IP: ${serverIp}`);
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2800);
}

function switchTab(tab) {
    if (tab === 'kits') window.location.href = 'kits.html';
    else if (tab === 'arenas') window.location.href = 'arenas.html';
    else window.location.href = 'index.html';
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.onload = init;
