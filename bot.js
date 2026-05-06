const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online ✅'));
app.listen(process.env.PORT || 3000);

// --- CONFIGURACIÓN ---
const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0, puuid: "", summonerId: "" },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, puuid: "", summonerId: "" },
};

const processedMessages = new Set();

const client = new tmi.Client({
    options: { debug: false },
    identity: {
        username: 'bot_node', 
        password: process.env.TWITCH_TOKEN 
    },
    channels: Object.keys(streamerAccounts) 
});

// --- PRECARGA MAESTRA ---
client.on('connected', async () => {
    console.log('Conectado. Obteniendo IDs de Riot...');
    const riotKey = process.env.RIOT_API_KEY;
    
    for (let channel in streamerAccounts) {
        try {
            const config = streamerAccounts[channel];
            const cluster = getCluster(config.region);
            
            // 1. Obtener PUUID (desde Riot ID)
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
            streamerAccounts[channel].puuid = acc.data.puuid;

            // 2. Obtener Summoner ID (¡ESTO ES LO QUE NECESITA EL RANK!)
            const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${acc.data.puuid}?api_key=${riotKey}`);
            streamerAccounts[channel].summonerId = summ.data.id;

            // 3. Obtener victorias iniciales
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.data.id}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
            
            if (soloQ) {
                streamerAccounts[channel].startWins = soloQ.wins;
                streamerAccounts[channel].startLosses = soloQ.losses;
                console.log(`[OK] IDs y Stats cargados para ${channel}`);
            }
        } catch (e) { 
            console.error(`[ERROR] No se pudo inicializar ${channel}: Verificar si el nombre/tag están bien.`); 
        }
    }
});

client.connect().catch(console.error);

client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    // Evitar doble mensaje
    if (processedMessages.has(tags.id)) return;
    processedMessages.add(tags.id);
    if (processedMessages.size > 100) {
        const firstValue = processedMessages.values().next().value;
        processedMessages.delete(firstValue);
    }

    const command = message.toLowerCase().trim();
    const channelName = channel.replace('#', '').toLowerCase();
    const config = streamerAccounts[channelName];
    const riotKey = process.env.RIOT_API_KEY;

    // Si no cargó los IDs al principio, no hacemos nada
    if (!config || !config.puuid || !config.summonerId) return;

    try {
        const cluster = getCluster(config.region);

        // --- COMANDO !RANK / !ELO ---
        if (command === '!rank' || command === '!elo') {
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${config.summonerId}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "Sin rango en SoloQ.");
            const racha = soloQ.hotStreak ? "🔥 En racha!" : "";
            client.say(channel, `${config.name} está en ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP). ${racha}`);
        }

        // --- COMANDO !STATS / !HOY ---
        if (command === '!stats' || command === '!hoy' || command === '!session') {
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${config.summonerId}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "No hay datos de rankeds.");
            
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            client.say(channel, `Sesión de ${config.name}: ${w}W - ${l}L (WR: ${wr}%). Total hoy: ${w+l} partidas.`);
        }

        // --- COMANDO !MATCH (SIN CAMBIOS) ---
        if (command === '!match' || command === '!lastmatch') {
            const history = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1&api_key=${riotKey}`);
            if (!history.data[0]) return client.say(channel, "No hay partidas.");

            const match = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}?api_key=${riotKey}`);
            const p = match.data.info.participants.find(part => part.puuid === config.puuid);
            
            const win = p.win ? 'VICTORIA' : 'DERROTA';
            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const dmg = (p.totalDamageDealtToChampions / (match.data.info.gameDuration / 60)).toFixed(0);
            
            client.say(channel, `Última: ${win} con ${p.championName} (Nivel ${p.champLevel}). KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs}. Daño/min: ${dmg}. Oro: ${p.goldEarned} Vision: ${p.visionScore}.`);
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
