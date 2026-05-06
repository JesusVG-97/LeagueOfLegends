const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online ✅'));
app.listen(process.env.PORT || 3000);

const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, startTier: "", startRank: "", puuid: "" },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, startTier: "", startRank: "", puuid: "" },
    "uristylin": { name: "Uri Stylin", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, startTier: "", startRank: "", puuid: "" },
};

const processedMessages = new Set();
const client = new tmi.Client({
    identity: { username: 'bot_node', password: process.env.TWITCH_TOKEN },
    channels: Object.keys(streamerAccounts)
});

const riotRequest = axios.create({
    headers: { "X-Riot-Token": process.env.RIOT_API_KEY }
});

// --- FUNCIONES AUXILIARES ---

function calculateTotalElo(tier, rank, lp) {
    const tierValue = { 'IRON': 0, 'BRONZE': 400, 'SILVER': 800, 'GOLD': 1200, 'PLATINUM': 1600, 'EMERALD': 2000, 'DIAMOND': 2400, 'MASTER': 2800, 'GRANDMASTER': 2800, 'CHALLENGER': 2800 };
    const rankValue = { 'IV': 0, 'III': 100, 'II': 200, 'I': 300 };
    
    const t = tier ? tier.toUpperCase() : 'IRON';
    const r = rank || 'IV';
    
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(t)) {
        return tierValue[t] + lp;
    }
    return tierValue[t] + rankValue[r] + lp;
}

function getNextRank(rank) {
    const ranks = { 'IV': 'III', 'III': 'II', 'II': 'I' };
    return ranks[rank] || '';
}

function getNextTier(tier) {
    const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'];
    const index = tiers.indexOf(tier.toUpperCase());
    return tiers[index + 1] || 'MASTER';
}

function getCluster(region) {
    if (['na1', 'br1', 'la1', 'la2'].includes(region.toLowerCase())) return 'americas';
    return 'europe';
}

// --- LÓGICA DE RIOT ---

async function updateStats(channel) {
    const config = streamerAccounts[channel];
    const cluster = getCluster(config.region);
    try {
        if (!config.puuid) {
            const acc = await riotRequest.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}`);
            config.puuid = acc.data.puuid;
        }
        const league = await riotRequest.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${config.puuid}`);
        return league.data.find(l => l.queueType === 'RANKED_SOLO_5x5') || null;
    } catch (e) {
        console.error(`Error en API para ${channel}: ${e.message}`);
        return null;
    }
}

// --- EVENTOS DEL CLIENTE ---

client.on('connected', async () => {
    console.log('Conectado. Cargando elo inicial...');
    for (let channel in streamerAccounts) {
        const soloQ = await updateStats(channel);
        if (soloQ) {
            streamerAccounts[channel].startWins = soloQ.wins;
            streamerAccounts[channel].startLosses = soloQ.losses;
            streamerAccounts[channel].startLP = soloQ.leaguePoints;
            streamerAccounts[channel].startTier = soloQ.tier;
            streamerAccounts[channel].startRank = soloQ.rank;
            console.log(`[OK] ${channel} inicializado en ${soloQ.tier} ${soloQ.rank}.`);
        }
    }
});

client.on('message', async (channel, tags, message, self) => {
    if (self) return;
    if (processedMessages.has(tags.id)) return;
    processedMessages.add(tags.id);
    if (processedMessages.size > 100) processedMessages.delete(processedMessages.values().next().value);

    const command = message.toLowerCase().trim();
    const channelName = channel.replace('#', '').toLowerCase();
    const config = streamerAccounts[channelName];

    if (!config) return;

    try {
        const cluster = getCluster(config.region);

        if (command === '!rank') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "Sin rango o error de API.");
            
            const tier = soloQ.tier;
            const rank = soloQ.rank;
            const lp = soloQ.leaguePoints;
            const racha = soloQ.hotStreak ? " 🔥 ¡Está on fire!" : "";
            const isApex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase());

            if (isApex) {
                client.say(channel, `${config.name} está en ${tier} con ${lp} LP. ¡Top regional!${racha}`);
            } else {
                const lpParaSubir = 100 - lp;
                const metaTexto = rank === "I" ? `para la promoción a ${getNextTier(tier)}` : `para subir a ${tier} ${getNextRank(rank)}`;
                client.say(channel, `${config.name} está en ${tier} ${rank} con ${lp} LP. (Le faltan ${lpParaSubir} LP ${metaTexto}).${racha}`);
            }
        }

        if (command === '!stats' || command === '!hoy') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "No hay datos disponibles.");
            
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            
            const currentTotalElo = calculateTotalElo(soloQ.tier, soloQ.rank, soloQ.leaguePoints);
            const startTotalElo = calculateTotalElo(config.startTier, config.startRank, config.startLP);
            const lpDiff = currentTotalElo - startTotalElo;
            
            const lpSign = lpDiff >= 0 ? "+" : "";
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            
            client.say(channel, `Balance de hoy: ${w}W - ${l}L (${lpSign}${lpDiff} LP) | WR: ${wr}% | Total: ${w+l} partidas.`);
        }

        if (command === '!match' || command === '!lastmatch') {
            const history = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1`);
            if (!history.data[0]) return client.say(channel, "No se encontraron partidas.");
            
            const match = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}`);
            const p = match.data.info.participants.find(part => part.puuid === config.puuid);

            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const win = p.win ? 'VICTORIA' : 'DERROTA';
            const dmg = (p.totalDamageDealtToChampions / (match.data.info.gameDuration / 60)).toFixed(0);
            client.say(channel, `Última: ${win} con ${p.championName} (Nivel ${p.champLevel}). KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs}. Daño/min: ${dmg}. Oro: ${p.goldEarned} Visión: ${p.visionScore}.`);
        }
    } catch (err) { console.error("Error en comando:", err.message); }
});

client.connect();
