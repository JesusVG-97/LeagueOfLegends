const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Session Tracker Online'));
app.listen(process.env.PORT || 3000);

// --- CONFIGURACIÓN Y MEMORIA DE SESIÓN ---
const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0 },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0 },
};

const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'bot_node', 
        password: process.env.TWITCH_TOKEN 
    },
    channels: Object.keys(streamerAccounts) 
});

// Al conectar, guardamos los stats iniciales para calcular la sesión
client.on('connected', async () => {
    console.log('Bot conectado. Cargando stats iniciales de sesion...');
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
        } catch (e) { console.error(`Error cargando sesion para ${channel}`); }
    }
});

client.connect().catch(console.error);

client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const command = message.toLowerCase().trim();
    const channelName = channel.replace('#', '').toLowerCase();
    const riotKey = process.env.RIOT_API_KEY;
    const config = streamerAccounts[channelName];

    if (!config) return; 

    try {
        const cluster = getCluster(config.region);

        // --- COMANDO !SESSION (VICTORIAS/DERROTAS DEL DIA) ---
        if (command === '!session' || command === '!hoy' || command === '!stats') {
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${acc.data.puuid}?api_key=${riotKey}`);
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.data.id}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "No hay datos de rankeds para hoy.");

            const currentWins = soloQ.wins - config.startWins;
            const currentLosses = soloQ.losses - config.startLosses;
            const totalSession = currentWins + currentLosses;
            const wrSession = totalSession > 0 ? ((currentWins / totalSession) * 100).toFixed(1) : 0;

            client.say(channel, `Sesion de ${config.name}: ${currentWins}W - ${currentLosses}L (WR: ${wrSession}%).`);
        }

        // --- COMANDO !MATCH (CON MULTIKILLS) ---
        if (command === '!match' || command === '!lastmatch') {
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            const history = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${acc.data.puuid}/ids?start=0&count=1&api_key=${riotKey}`);
            
            if (!history.data[0]) return client.say(channel, "No hay partidas.");

            const match = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}?api_key=${riotKey}`);
            const p = match.data.info.participants.find(part => part.puuid === acc.data.puuid);

            let multi = "";
            if (p.pentaKills > 0) multi = "PENTAKILL! ";
            else if (p.quadraKills > 0) multi = "QUADRAKILL! ";

            const win = p.win ? 'VICTORIA' : 'DERROTA';
            client.say(channel, `Ultima: ${win} con ${p.championName}. KDA: ${p.kills}/${p.deaths}/${p.assists}. ${multi}Dano/min: ${(p.totalDamageDealtToChampions/(match.data.info.gameDuration/60)).toFixed(0)}. Visio: ${p.visionScore}.`);
        }

        // --- COMANDO !RANK ---
        if (command === '!rank' || command === '!elo') {
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${acc.data.puuid}?api_key=${riotKey}`);
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.data.id}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "Sin rango.");
            
            const racha = soloQ.hotStreak ? "En racha!" : "";
            client.say(channel, `${config.name} esta en ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP). ${racha}`);
        }

    } catch (e) { console.error("Error comando:", e.message); }
});

function getCluster(region) {
    region = region.toLowerCase();
    if (['na1', 'br1', 'la1', 'la2'].includes(region)) return 'americas';
    if (['kr', 'jp1'].includes(region)) return 'asia';
    return 'europe';
}
