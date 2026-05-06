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

// --- FUNCIONES DE CÁLCULO ---

function calculateTotalElo(tier, rank, lp) {
    const tierValue = { 'IRON': 0, 'BRONZE': 400, 'SILVER': 800, 'GOLD': 1200, 'PLATINUM': 1600, 'EMERALD': 2000, 'DIAMOND': 2400, 'MASTER': 2800, 'GRANDMASTER': 3200, 'CHALLENGER': 3600 };
    const rankValue = { 'IV': 0, 'III': 100, 'II': 200, 'I': 300 };
    const t = tier ? tier.toUpperCase() : 'IRON';
    const r = rank || 'IV';
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(t)) return tierValue[t] + (lp || 0);
    return tierValue[t] + rankValue[r] + (lp || 0);
}

function eloToText(totalElo) {
    const tiers = [{ name: 'Challenger', val: 3600 }, { name: 'Grandmaster', val: 3200 }, { name: 'Master', val: 2800 }, { name: 'Diamond', val: 2400 }, { name: 'Emerald', val: 2000 }, { name: 'Platinum', val: 1600 }, { name: 'Gold', val: 1200 }, { name: 'Silver', val: 800 }, { name: 'Bronze', val: 400 }, { name: 'Iron', val: 0 }];
    const tier = tiers.find(t => totalElo >= t.val) || tiers[tiers.length - 1];
    if (totalElo >= 2800) return tier.name;
    const ranks = [{ n: 'I', v: 300 }, { n: 'II', v: 200 }, { n: 'III', v: 100 }, { n: 'IV', v: 0 }];
    const rank = ranks.find(r => (totalElo - tier.val) >= r.v) || ranks[3];
    return `${tier.name} ${rank.n}`;
}

async function getAverageElo(participants, region) {
    try {
        const promises = participants.map(p => riotRequest.get(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid || p.summonerId}`).catch(() => ({ data: [] })));
        const results = await Promise.all(promises);
        const elos = results.map(res => {
            const solo = res.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
            return solo ? calculateTotalElo(solo.tier, solo.rank, solo.leaguePoints) : null;
        }).filter(v => v !== null);
        return elos.length > 0 ? eloToText(elos.reduce((a, b) => a + b, 0) / elos.length) : "Desconocido";
    } catch (e) { return "Desconocido"; }
}

// --- LÓGICA DE COMANDOS ---

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
    } catch (e) { return null; }
}

client.on('message', async (channel, tags, message, self) => {
    if (self) return;
    const command = message.toLowerCase().trim();
    const channelName = channel.replace('#', '').toLowerCase();
    const config = streamerAccounts[channelName];
    if (!config) return;

    try {
        const cluster = getCluster(config.region);

        // --- !MATCH (PARTIDA ACTUAL EN VIVO) ---
        if (command === '!match') {
            try {
                const live = await riotRequest.get(`https://${config.region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${config.puuid}`);
                const game = live.data;
                const me = game.participants.find(p => p.puuid === config.puuid);
                const avgElo = await getAverageElo(game.participants, config.region);
                const mins = Math.floor(game.gameLength / 60);
                
                client.say(channel, `🎮 EN VIVO [Elo medio: ${avgElo}]: ${config.name} está jugando con un campeón (ID: ${me.championId}) hace ${mins} min. ¡A por ellos!`);
            } catch (e) {
                client.say(channel, `${config.name} no está en partida ahora mismo. Usa !lastmatch para ver la anterior.`);
            }
        }

        // --- !LASTMATCH / !ULTIMOGAME (PARTIDA TERMINADA) ---
        if (command === '!lastmatch' || command === '!ultimogame') {
            const history = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1`);
            const match = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}`);
            const p = match.data.info.participants.find(part => part.puuid === config.puuid);
            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const avgElo = await getAverageElo(match.data.info.participants, config.region);
            
            client.say(channel, `🏁 ÚLTIMA (${avgElo}): ${p.win ? 'VICTORIA' : 'DERROTA'} con ${p.championName}. KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs}. Oro: ${p.goldEarned}.`);
        }

        // --- !RANK ---
        if (command === '!rank') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "Sin rango.");
            client.say(channel, `${config.name}: ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP).`);
        }

    } catch (err) { console.error(err.message); }
});

function getCluster(region) { return ['na1', 'br1', 'la1', 'la2'].includes(region.toLowerCase()) ? 'americas' : 'europe'; }
client.on('connected', () => console.log('Bot Online ✅'));
client.connect();
