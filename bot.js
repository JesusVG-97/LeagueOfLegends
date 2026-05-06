const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Multi-Channel Online'));
app.listen(process.env.PORT || 3000);

// --- CONFIGURACIÓN (Nombres de canales en MINÚSCULAS para evitar doble mensaje) ---
const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0 },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0 },
};

const client = new tmi.Client({
    options: { debug: false },
    identity: {
        username: 'bot_node', 
        password: process.env.TWITCH_TOKEN 
    },
    channels: Object.keys(streamerAccounts) 
});

client.on('connected', async () => {
    console.log('Bot conectado correctamente.');
    const riotKey = process.env.RIOT_API_KEY;
    
    for (let channel in streamerAccounts) {
        try {
            const config = streamerAccounts[channel];
            const cluster = getCluster(config.region);
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${acc.data.puuid}?api_key=${riotKey}`);
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.data.id}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
            if (soloQ) {
                streamerAccounts[channel].startWins = soloQ.wins;
                streamerAccounts[channel].startLosses = soloQ.losses;
            }
        } catch (e) { console.error(`Error inicializando ${channel}`); }
    }
});

client.connect().catch(console.error);

client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const command = message.toLowerCase().trim();
    // Limpiamos el nombre del canal para que coincida siempre
    const channelName = channel.replace('#', '').toLowerCase();
    const config = streamerAccounts[channelName];
    const riotKey = process.env.RIOT_API_KEY;

    if (!config) return;

    try {
        const cluster = getCluster(config.region);

        // 1. OBTENER PUUID (Común para todos los comandos)
        const accRes = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
        const puuid = accRes.data.puuid;

        // --- COMANDO !STATS / !HOY / !SESSION ---
        if (command === '!stats' || command === '!hoy' || command === '!session') {
            const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${puuid}?api_key=${riotKey}`);
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.data.id}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "No hay datos de rankeds.");
            
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            client.say(channel, `Sesion de ${config.name}: ${w}W - ${l}L (WR: ${wr}%). Total hoy: ${w+l} partidas.`);
        }

        // --- COMANDO !RANK / !ELO ---
        if (command === '!rank') {
            const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${puuid}?api_key=${riotKey}`);
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.data.id}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "Sin rango en SoloQ.");
            const racha = soloQ.hotStreak ? "En racha!" : "";
            client.say(channel, `${config.name} esta en ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP). ${racha}`);
        }

        // --- COMANDO !MATCH / !LASTMATCH ---
        if (command === '!match' || command === '!lastmatch') {
            const history = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${riotKey}`);
            if (!history.data[0]) return client.say(channel, "No hay partidas.");

            const match = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}?api_key=${riotKey}`);
            const p = match.data.info.participants.find(part => part.puuid === puuid);
            
            const win = p.win ? 'VICTORIA' : 'DERROTA';
            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const dmg = (p.totalDamageDealtToChampions / (match.data.info.gameDuration / 60)).toFixed(0);
            
            client.say(channel, `Ultima: ${win} con ${p.championName} (Nivel ${p.champLevel}). KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs}. Dano/min: ${dmg}. Oro: ${p.goldEarned}.`);
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
});

function getCluster(region) {
    region = region.toLowerCase();
    if (['na1', 'br1', 'la1', 'la2'].includes(region)) return 'americas';
    if (['kr', 'jp1'].includes(region)) return 'asia';
    return 'europe';
}
