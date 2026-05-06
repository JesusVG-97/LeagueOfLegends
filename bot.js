const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online ✅'));
app.listen(process.env.PORT || 3000);

const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, puuid: "" },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, puuid: "" },
    "UriStylin": { name: "Uri Stylin", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, puuid: "" },
};

const processedMessages = new Set();
const client = new tmi.Client({
    identity: { username: 'bot_node', password: process.env.TWITCH_TOKEN },
    channels: Object.keys(streamerAccounts)
});

const riotRequest = axios.create({
    headers: { "X-Riot-Token": process.env.RIOT_API_KEY }
});

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

client.on('connected', async () => {
    console.log('Conectado. Cargando elo inicial...');
    for (let channel in streamerAccounts) {
        const soloQ = await updateStats(channel);
        if (soloQ) {
            streamerAccounts[channel].startWins = soloQ.wins;
            streamerAccounts[channel].startLosses = soloQ.losses;
            streamerAccounts[channel].startLP = soloQ.leaguePoints;
            console.log(`[OK] ${channel} inicializado.`);
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

        // --- !RANK (Solo !rank, quitado !elo) ---
        if (command === '!rank') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "Sin rango o error de API.");
            
            const lpParaSubir = 100 - soloQ.leaguePoints;
            const racha = soloQ.hotStreak ? " ¡Está on fire!" : "";
            
            client.say(channel, `${config.name} está en ${soloQ.tier} ${soloQ.rank} con ${soloQ.leaguePoints} LP. (Le faltan ${lpParaSubir} LP para subir de rango). ${racha}`);
        }

        // --- !STATS / !HOY ---
        if (command === '!stats' || command === '!hoy') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "No hay datos disponibles.");
            
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const lpDiff = soloQ.leaguePoints - config.startLP;
            const lpSign = lpDiff >= 0 ? "+" : ""; // Para poner +20 o -20
            
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            client.say(channel, `Hoy: ${w}W - ${l}L (${lpSign}${lpDiff} LP) | WR: ${wr}% | Partidas: ${w+l}`);
        }

        // --- !MATCH ---
        if (command === '!match' || command === '!lastmatch') {
            const history = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1`);
            if (!history.data[0]) return client.say(channel, "No se encontraron partidas.");
            
            const match = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}`);
            const p = match.data.info.participants.find(part => part.puuid === config.puuid);

            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const win = p.win ? 'VICTORIA' : 'DERROTA';
            const dmg = (p.totalDamageDealtToChampions / (match.data.info.gameDuration / 60)).toFixed(0);
            client.say(channel, `Última: ${win} con ${p.championName} (Nivel ${p.champLevel}). KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs}. Daño/min: ${dmg}. Oro: ${p.goldEarned} Vision: ${p.visionScore}.`);
        }
    } catch (err) { console.error("Error en comando:", err.message); }
});

function getCluster(region) {
    if (['na1', 'br1', 'la1', 'la2'].includes(region.toLowerCase())) return 'americas';
    return 'europe';
}

client.connect();
