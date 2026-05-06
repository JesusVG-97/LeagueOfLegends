const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online'));
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
    if (totalElo >= 2800) return `${tier.name} (${(totalElo - tier.val).toFixed(0)} LP)`;
    const ranks = [{ n: 'I', v: 300 }, { n: 'II', v: 200 }, { n: 'III', v: 100 }, { n: 'IV', v: 0 }];
    const remainder = totalElo - tier.val;
    const rank = ranks.find(r => remainder >= r.v) || ranks[ranks.length - 1];
    return `${tier.name} ${rank.n}`;
}

async function getAverageElo(participants, region) {
    try {
        const promises = participants.map(p => 
            riotRequest.get(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid || p.summonerId}`)
            .catch(() => ({ data: [] }))
        );
        const results = await Promise.all(promises);
        const elos = results.map(res => {
            const soloQ = res.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
            return soloQ ? calculateTotalElo(soloQ.tier, soloQ.rank, soloQ.leaguePoints) : null;
        }).filter(val => val !== null);
        if (elos.length === 0) return "Desconocido";
        const avg = elos.reduce((a, b) => a + b, 0) / elos.length;
        return eloToText(avg);
    } catch (e) { return "Error"; }
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
    return ['na1', 'br1', 'la1', 'la2'].includes(region.toLowerCase()) ? 'americas' : 'europe';
}

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

client.on('connected', async () => {
    console.log('Bot conectado');
    for (let channel in streamerAccounts) {
        const soloQ = await updateStats(channel);
        if (soloQ) {
            streamerAccounts[channel].startWins = soloQ.wins;
            streamerAccounts[channel].startLosses = soloQ.losses;
            streamerAccounts[channel].startLP = soloQ.leaguePoints;
            streamerAccounts[channel].startTier = soloQ.tier;
            streamerAccounts[channel].startRank = soloQ.rank;
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
            if (!soloQ) return client.say(channel, "Sin rango");
            const isApex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(soloQ.tier.toUpperCase());
            if (isApex) {
                client.say(channel, `${config.name}: ${soloQ.tier} ${soloQ.leaguePoints} LP`);
            } else {
                const lpParaSubir = 100 - soloQ.leaguePoints;
                const meta = soloQ.rank === "I" ? getNextTier(soloQ.tier) : `${soloQ.tier} ${getNextRank(soloQ.rank)}`;
                client.say(channel, `${config.name}: ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP). Faltan ${lpParaSubir} LP para ${meta}`);
            }
        }

        if (command === '!stats' || command === '!hoy') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "Sin datos");
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const lpDiff = calculateTotalElo(soloQ.tier, soloQ.rank, soloQ.leaguePoints) - calculateTotalElo(config.startTier, config.startRank, config.startLP);
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            client.say(channel, `Hoy: ${w}W - ${l}L (${lpDiff >= 0 ? "+" : ""}${lpDiff} LP) | WR: ${wr}%`);
        }

        if (command === '!match') {
            try {
                const activeResponse = await riotRequest.get(`https://${config.region}.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${config.puuid}`);
                const liveData = activeResponse.data;
                const avgElo = await getAverageElo(liveData.participants, config.region);
                const timeMinutes = Math.floor(liveData.gameLength / 60);
                client.say(channel, "[PARTIDA ACTUAL] Elo medio: " + avgElo + ". Tiempo: " + (timeMinutes > 0 ? timeMinutes : 0) + " min. Usa !lastmatch para el historial");
            } catch (e) {
                client.say(channel, config.name + " no esta en partida ahora mismo. Usa !lastmatch para la ultima finalizada");
            }
        }

        if (command === '!lastmatch' || command === '!ultimogame') {
            const history = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1`);
            if (!history.data[0]) return client.say(channel, "Sin historial");
            const match = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}`);
            const info = match.data.info;
            const p = info.participants.find(part => part.puuid === config.puuid);
            const avgEloText = await getAverageElo(info.participants, config.region);
            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const dmg = (p.totalDamageDealtToChampions / (info.gameDuration / 60)).toFixed(0);
            client.say(channel, `[ULTIMA PARTIDA] (${avgEloText}): ${p.win ? 'VICTORIA' : 'DERROTA'} con ${p.championName}. KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs} (${(cs/(info.gameDuration/60)).toFixed(1)}/m). Daño/m: ${dmg}`);
        }

    } catch (err) { console.error("Error", err.message); }
});

client.connect();
