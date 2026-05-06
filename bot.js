const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

// --- 1. MANTENER VIVO EN RENDER ---
const app = express();
app.get('/', (req, res) => res.send('Bot Multicanal Personalizado Online'));
app.listen(process.env.PORT || 3000);

// --- 2. CONFIGURACIÓN DE CUENTAS POR CANAL ---
// Aquí mapeas: "nombre_del_canal_twitch": { datos_de_riot }
const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1" },
    "Marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1" },
};

// --- 3. CLIENTE DE TWITCH ---
const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'bot_node', 
        password: process.env.TWITCH_TOKEN 
    },
    // El bot se une a todos los canales definidos en tu lista superior
    channels: Object.keys(streamerAccounts) 
});

client.connect().catch(console.error);

// --- 4. LÓGICA DE COMANDOS ---
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const command = message.toLowerCase().trim();
    const channelName = channel.replace('#', '').toLowerCase();
    const riotKey = process.env.RIOT_API_KEY;

    // Verificar si el canal actual está en nuestra base de datos
    const config = streamerAccounts[channelName];
    if (!config) return; // Si el canal no está en la lista, el bot no responde

    if (command === '!elo' || command === '!match' || command === '!lastmatch') {
        try {
            const cluster = getCluster(config.region);

            // 1. Obtener PUUID usando los datos específicos del streamer
            const accountRes = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            const puuid = accountRes.data.puuid;

            // Lógica para !elo
            if (command === '!elo') {
                const summonerRes = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${puuid}?api_key=${riotKey}`);
                const leagueRes = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerRes.data.id}?api_key=${riotKey}`);
                const soloQ = leagueRes.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

                if (!soloQ) return client.say(channel, ` ${config.name} no tiene rango en SoloQ actualmente.`);
                
                const winrate = ((soloQ.wins / (soloQ.wins + soloQ.losses)) * 100).toFixed(1);
                client.say(channel, ` Rango de ${config.name}: ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP) - WR: ${winrate}%`);
            }

            // Lógica para !match / !lastmatch
            if (command === '!match' || command === '!lastmatch') {
                const historyRes = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${riotKey}`);
                const matchId = historyRes.data[0];

                if (!matchId) return client.say(channel, "No se encontraron partidas recientes.");

                const matchRes = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${riotKey}`);
                const p = matchRes.data.info.participants.find(part => part.puuid === puuid);

                const winStatus = p.win ? 'VICTORIA ' : 'DERROTA ';
                client.say(channel, ` Última de ${config.name}: ${winStatus} con ${p.championName}. KDA: ${p.kills}/${p.deaths}/${p.assists}.`);
            }

        } catch (error) {
            console.error(`Error en canal ${channelName}:`, error.message);
            // Solo avisar al chat si es un error crítico o no encuentra al jugador
            if (error.response && error.response.status === 404) {
                client.say(channel, `Error: No se encontró la cuenta de Riot ${config.name}#${config.tag}`);
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