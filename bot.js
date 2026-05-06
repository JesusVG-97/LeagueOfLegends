const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

// --- 1. MANTENER VIVO EN RENDER ---
const app = express();
app.get('/', (req, res) => res.send('Bot Multicanal Personalizado Online'));
app.listen(process.env.PORT || 3000);

// --- 2. CONFIGURACIÓN DE CUENTAS POR CANAL ---
const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1" },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1" },
};

// --- 3. CLIENTE DE TWITCH ---
const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'bot_node', 
        password: process.env.TWITCH_TOKEN 
    },
    channels: Object.keys(streamerAccounts) 
});

client.connect().catch(console.error);

// --- 4. LÓGICA DE COMANDOS ---
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const command = message.toLowerCase().trim();
    const channelName = channel.replace('#', '').toLowerCase();
    const riotKey = process.env.RIOT_API_KEY;

    const config = streamerAccounts[channelName];
    if (!config) return; 

    // Solo reacciona a !match o !lastmatch
    if (command === '!match' || command === '!lastmatch') {
        try {
            const cluster = getCluster(config.region);

            // 1. Obtener PUUID
            const accountRes = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            const puuid = accountRes.data.puuid;

            // 2. Obtener ID de la última partida
            const historyRes = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${riotKey}`);
            const matchId = historyRes.data[0];

            if (!matchId) return client.say(channel, "No se encontraron partidas recientes.");

            // 3. Obtener detalles de la partida
            const matchRes = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${riotKey}`);
            const p = matchRes.data.info.participants.find(part => part.puuid === puuid);

            const winStatus = p.win ? 'VICTORIA' : 'DERROTA';
            client.say(channel, `Ultima partida de ${config.name}: ${winStatus} con ${p.championName}. KDA: ${p.kills}/${p.deaths}/${p.assists}.`);

        } catch (error) {
            console.error(`Error en canal ${channelName}:`, error.message);
            if (error.response && error.response.status === 404) {
                client.say(channel, `Error: No se encontro la cuenta de Riot ${config.name}#${config.tag}`);
            }
        }
    }
});

// --- FUNCIONES AUXILIARES ---
function getCluster(region) {
    region = region.toLowerCase();
    if (['na1', 'br1', 'la1', 'la2'].includes(region)) return 'americas';
    if (['kr', 'jp1'].includes(region)) return 'asia';
    return 'europe';
}
