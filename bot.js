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

// Función de apoyo para obtener IDs si faltan
async function refreshAccountData(channelName) {
    const config = streamerAccounts[channelName];
    const riotKey = process.env.RIOT_API_KEY;
    const cluster = getCluster(config.region);
    
    try {
        const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(config.name)}/${encodeURIComponent(config.tag)}?api_key=${riotKey}`);
        config.puuid = acc.data.puuid;

        const summ = await axios.get(`https://${config.region}.api.riotgames.com/lol/summoner/v4/by-puuid/${config.puuid}?api_key=${riotKey}`);
        config.summonerId = summ.data.id;

        const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${config.summonerId}?api_key=${riotKey}`);
        const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
        
        if (soloQ && config.startWins === 0) {
            config.startWins = soloQ.wins;
            config.startLosses = soloQ.losses;
        }
        console.log(`[SISTEMA] Datos actualizados para ${channelName}`);
        return true;
    } catch (e) {
        console.error(`[ERROR] No se pudo obtener datos de Riot para ${channelName}: ${e.message}`);
        return false;
    }
}

client.on('connected', async () => {
    console.log('Conectado a Twitch. Iniciando precarga...');
    for (let channel in streamerAccounts) {
        await refreshAccountData(channel);
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

    if (!config) return;

    // Si faltan IDs, intentamos recuperarlos antes de fallar
    if (!config.puuid || !config.summonerId) {
        const ok = await refreshAccountData(channelName);
        if (!ok) return; // Si sigue fallando, abortamos
    }

    try {
        const cluster = getCluster(config.region);

        // --- COMANDO !RANK ---
        if (command === '!rank') {
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${config.summonerId}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "Sin rango en SoloQ actualmente.");
            const racha = soloQ.hotStreak ? "🔥 En racha!" : "";
            client.say(channel, `${config.name} está en ${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP). ${racha}`);
        }

        // --- COMANDO !STATS / !HOY / !SESSION ---
        if (command === '!stats' || command === '!hoy' || command === '!session') {
            const league = await axios.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${config.summonerId}?api_key=${riotKey}`);
            const soloQ = league.data.find(l => l.queueType === 'RANKED_SOLO_5x5');

            if (!soloQ) return client.say(channel, "No hay datos de rankeds para esta sesión.");
            
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;
            client.say(channel, `Sesión de ${config.name}: ${w}W - ${l}L (WR: ${wr}%). Total hoy: ${w+l} partidas.`);
        }

        // --- COMANDO !MATCH ---
        if (command === '!match' || command === '!lastmatch') {
            const history = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1&api_key=${riotKey}`);
            if (!history.data[0]) return client.say(channel, "No hay partidas recientes.");

            const match = await axios.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}?api_key=${riotKey}`);
            const p = match.data.info.participants.find(part => part.puuid === config.puuid);
            
            const win = p.win ? 'VICTORIA' : 'DERROTA';
            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const dmg = (p.totalDamageDealtToChampions / (match.data.info.gameDuration / 60)).toFixed(0);
            
            client.say(channel, `Última: ${win} con ${p.championName} (Nivel ${p.champLevel}). KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs}. Daño/min: ${dmg}.`);
        }

    } catch (error) {
        if (error.response && error.response.status === 403) {
            console.error("API KEY CADUCADA");
        } else {
            console.error("Error en comando:", error.message);
        }
    }
});

function getCluster(region) {
    region = region.toLowerCase();
    if (['na1', 'br1', 'la1', 'la2'].includes(region)) return 'americas';
    if (['kr', 'jp1'].includes(region)) return 'asia';
    return 'europe';
}
