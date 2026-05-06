const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online ✅'));
app.listen(process.env.PORT || 3000);

const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0, puuid: "" },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, puuid: "" },
};

const processedMessages = new Set();
const client = new tmi.Client({
    identity: { username: 'bot_node', password: process.env.TWITCH_TOKEN },
    channels: Object.keys(streamerAccounts)
});

// Usamos el Header X-Riot-Token que es más estable para Apps
const riotRequest = axios.create({
    headers: { "X-Riot-Token": process.env.RIOT_API_KEY }
});

async function updateStats(channel) {
    const config = streamerAccounts[channel];
    const cluster = getCluster(config.region);
    try {
        // 1. Obtener PUUID si no lo tenemos
        if (!config.puuid) {
            const acc = await riotRequest.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}`);
            config.puuid = acc.data.puuid;
        }

        // 2. Obtener Liga usando BY-PUUID (el método que tienes aprobado en la lista)
        const league = await riotRequest.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${config.puuid}`);
        const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
        
        return soloQ || null;
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

        if (command === '!rank' || command === '!elo') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "Sin rango o error de API.");
            client.say(channel, `${config.name} está en ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP).`);
        }

        if (command === '!stats' || command === '!hoy') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "No hay datos.");
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            client.say(channel, `Hoy: ${w}W - ${l}L (WR: ${wr}%).`);
        }

        if (command === '!match') {
            const history = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1`);
            const match = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}`);
            const p = match.data.info.participants.find(part => part.puuid === config.puuid);
            client.say(channel, `Última: ${p.win ? 'VICTORIA' : 'DERROTA'} con ${p.championName} (${p.kills}/${p.deaths}/${p.assists}).`);
        }
    } catch (err) { console.error("Error:", err.message); }
});

function getCluster(region) {
    if (['na1', 'br1', 'la1', 'la2'].includes(region.toLowerCase())) return 'americas';
    return 'europe';
}

client.connect();
