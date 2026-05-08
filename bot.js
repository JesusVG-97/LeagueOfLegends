const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online'));
app.listen(process.env.PORT || 3000);

// --- MAPEO DE CAMPEONES (ACTUALIZADO HASTA AMBESSA) ---
const champMap = {
    1: "Annie", 2: "Olaf", 3: "Galio", 4: "Twisted Fate", 5: "Xin Zhao", 6: "Urgot", 7: "LeBlanc", 8: "Vladimir", 9: "Fiddlesticks", 10: "Kayle", 11: "Master Yi", 12: "Alistar", 13: "Ryze", 14: "Sion", 15: "Sivir", 16: "Soraka", 17: "Teemo", 18: "Tristana", 19: "Warwick", 20: "Nunu", 21: "Miss Fortune", 22: "Ashe", 23: "Tryndamere", 24: "Jax", 25: "Morgana", 26: "Zilean", 27: "Singed", 28: "Evelynn", 29: "Twitch", 30: "Karthus", 31: "Cho'Gath", 32: "Amumu", 33: "Rammus", 34: "Anivia", 35: "Shaco", 36: "Dr. Mundo", 37: "Sona", 38: "Kassadin", 39: "Irelia", 40: "Janna", 41: "Gangplank", 42: "Corki", 43: "Karma", 44: "Taric", 45: "Veigar", 48: "Trundle", 50: "Swain", 51: "Caitlyn", 53: "Blitzcrank", 54: "Malphite", 55: "Katarina", 56: "Nocturne", 57: "Maokai", 58: "Renekton", 59: "Jarvan IV", 60: "Elise", 61: "Orianna", 62: "Wukong", 63: "Brand", 64: "Lee Sin", 67: "Vayne", 68: "Rumble", 69: "Cassiopeia", 72: "Skarner", 74: "Heimerdinger", 75: "Nasus", 76: "Nidalee", 77: "Udyr", 78: "Poppy", 79: "Gragas", 80: "Pantheon", 81: "Ezreal", 82: "Mordekaiser", 83: "Yorick", 84: "Akali", 85: "Kennen", 86: "Garen", 89: "Leona", 90: "Malzahar", 91: "Talon", 92: "Riven", 96: "Kog'Maw", 98: "Shen", 99: "Lux", 101: "Xerath", 102: "Shyvana", 103: "Ahri", 104: "Graves", 105: "Fizz", 106: "Volibear", 107: "Rengar", 110: "Varus", 111: "Nautilus", 112: "Viktor", 113: "Sejuani", 114: "Fiora", 115: "Ziggs", 117: "Lulu", 119: "Draven", 120: "Hecarim", 121: "Khazix", 122: "Darius", 126: "Jayce", 127: "Lissandra", 131: "Diana", 133: "Quinn", 134: "Syndra", 136: "Aurelion Sol", 141: "Kayn", 142: "Zoe", 143: "Zyra", 145: "Kaisa", 147: "Seraphine", 150: "Gnar", 154: "Zac", 157: "Yasuo", 161: "Velkoz", 163: "Taliyah", 164: "Camille", 166: "Akshan", 200: "Belveth", 201: "Braum", 202: "Jhin", 203: "Kindred", 221: "Zeri", 222: "Jinx", 223: "Tahm Kench", 233: "Briar", 234: "Viego", 235: "Senna", 236: "Lucian", 238: "Zed", 240: "Kled", 245: "Ekko", 246: "Qiyana", 254: "Vi", 266: "Aatrox", 267: "Nami", 268: "Azir", 350: "Yuumi", 360: "Samira", 412: "Thresh", 420: "Illaoi", 421: "RekSai", 427: "Ivern", 429: "Kalista", 432: "Bard", 497: "Rakan", 498: "Xayah", 516: "Ornn", 517: "Sylas", 518: "Neeko", 523: "Aphelios", 526: "Rell", 555: "Pyke", 711: "Vex", 777: "Yone", 799: "Smolder", 875: "Sett", 876: "Lillia", 887: "Gwen", 888: "Renata", 895: "Nilah", 897: "KSante", 902: "Milio", 910: "Hwei", 950: "Naafiri", 1000: "Ambessa"
};
// --- MAPEO DE RUNAS
const runasCompletasMap = {
                     // --- ESTILOS / RAMAS ---
                    8000: "Precisión", 
                    8100: "Dominación", 
                    8200: "Brujería", 
                    8300: "Inspiración", 
                    8400: "Valor",
                    // PRECISIÓN
                    8005: "PTA", 8008: "Lethal Tempo", 8010: "Conquistador", 8021: "Pies Veloces",
                    9101: "Sobrecuración", 9111: "Triunfo", 8009: "Claridad",
                    9104: "Presteza", 9105: "Tenacidad", 9103: "Linaje",
                    8014: "Golpe de Gracia", 8017: "Derribado", 8299: "Último Esfuerzo",
                    // DOMINACIÓN
                    8112: "Electrocutar", 8124: "Depredador", 8128: "Cosecha Oscura", 9923: "HoB",
                    8126: "Golpe Bajo", 8139: "Sabor a Sangre", 8143: "Impacto Súbito",
                    8136: "Zombi", 8120: "Poro", 8138: "Colección Globos",
                    8135: "Caza Voraz", 8134: "Caza Ingeniosa", 8105: "Caza Incesante", 8106: "Caza Definitiva",
                    // BRUJERÍA
                    8214: "Aery", 8229: "Cometa", 8230: "Fase Veloz",
                    8224: "Orbe Anulador", 8226: "Flujo Maná", 8275: "Capa del Nimbo",
                    8210: "Trascendencia", 8234: "Celeridad", 8233: "Concentración Absoluta",
                    8237: "Piroláser", 8232: "Caminar sobre Agua", 8236: "Tormenta Creciente",
                    // VALOR
                    8437: "Garras", 8439: "Aftershock", 8465: "Protector",
                    8446: "Demoler", 8463: "Fuente de Vida", 8401: "Golpe de Escudo",
                    8429: "Condicionamiento", 8444: "Fuerzas Renovadas", 8473: "Revestimiento",
                    8451: "Sobrecrecimiento", 8453: "Revitalizar", 8242: "Inquebrantable",
                    // INSPIRACIÓN
                    8351: "Glacial", 8360: "Libro de Hechizos", 8369: "First Strike",
                    8306: "Destello Hextech", 8304: "Calzado Mágico", 8313: "Sincronía Perfecta",
                    8321: "Mercado Futuro", 8316: "Entrega Galletas", 8345: "Calzado", 
                    8347: "Perspicacia Cósmica", 8410: "Velocidad de Aproximación", 8352: "Tónico",
                    // ESTADÍSTICAS (Shards)
                    5008: "Fuerza Adaptable", 5005: "Vel. Ataque", 5007: "Haste",
                    5002: "Armadura", 5003: "Resist. Mágica", 5001: "Vida"
                };

const streamerAccounts = {
    "xuclacubatas_": { name: "XuclaCubatas", tag: "ESP", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, startTier: "", startRank: "", puuid: "" },
    "marquez25": { name: "Marquez 25", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, startTier: "", startRank: "", puuid: "" },
    "uristylin": { name: "Uri Stylin", tag: "EUW", region: "euw1", startWins: 0, startLosses: 0, startLP: 0, startTier: "", startRank: "", puuid: "" },
};

let lastResetDate = new Date().getDate();
const processedMessages = new Set();

const client = new tmi.Client({
    identity: { username: 'bot_node', password: process.env.TWITCH_TOKEN },
    channels: Object.keys(streamerAccounts)
});

const riotRequest = axios.create({
    headers: { "X-Riot-Token": process.env.RIOT_API_KEY }
});

// --- FUNCIONES CORE ---

async function resetStatsIfNewDay() {
    const now = new Date();
    if (now.getDate() !== lastResetDate) {
        lastResetDate = now.getDate();
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
    }
}
setInterval(resetStatsIfNewDay, 60000);

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

function calculateAvgFromElos(elos) {
    if (!elos || elos.length === 0) return "Desconocido";
    const sum = elos.reduce((a, b) => a + b, 0);
    const avg = sum / elos.length;
    return eloToText(avg);
}
async function getAverageElo(participants, region) {
    const elos = await Promise.all(participants.map(async (p) => {
        try {
            // Un pequeño delay para no saturar a Riot
            const res = await riotRequest.get(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid || p.summonerId}`);
            const soloQ = res.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
            return soloQ ? calculateTotalElo(soloQ.tier, soloQ.rank, soloQ.leaguePoints) : null;
        } catch (e) { return null; }
    }));
    const validElos = elos.filter(v => v !== null);
    return calculateAvgFromElos(validElos);
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
    if (!config) return null;
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

// --- EVENTOS ---

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

        if (command === '!stats' || command === '!hoy' || command === '!rank') {
            const soloQ = await updateStats(channelName);
            if (!soloQ) return client.say(channel, "Sin datos de Ranked SoloQ.");

            // 1. Cálculos de Stats del día
            const w = soloQ.wins - config.startWins;
            const l = soloQ.losses - config.startLosses;
            const currentEloTotal = calculateTotalElo(soloQ.tier, soloQ.rank, soloQ.leaguePoints);
            const startEloTotal = calculateTotalElo(config.startTier, config.startRank, config.startLP);
            const lpDiff = currentEloTotal - startEloTotal;
            const wr = (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(0) : 0;

            // 2. Cálculos de Rango y Progreso
            const isApex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(soloQ.tier.toUpperCase());
            let metaInfo = "";

            if (isApex) {
                metaInfo = `${soloQ.tier} ${soloQ.leaguePoints} LP`;
            } else {
                const lpParaSubir = 100 - soloQ.leaguePoints;
                const meta = soloQ.rank === "I" ? getNextTier(soloQ.tier) : `${soloQ.tier} ${getNextRank(soloQ.rank)}`;
                metaInfo = `${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP) ┃ Faltan ${lpParaSubir} LP para ${meta}`;
            }

            // 3. Mensaje Unificado
            client.say(channel, `HOY: ${w}W - ${l}L (${lpDiff >= 0 ? "+" : ""}${lpDiff} LP) ┃ WR: ${wr}% ┃ ${metaInfo}`);
        }
if (command === '!match') {
    try {
        if (!config.puuid) await updateStats(channelName);

        const url = `https://${config.region.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${config.puuid}`;
        const activeResponse = await riotRequest.get(url);
        const liveData = activeResponse.data;

        // Traductor de rangos para mostrar nombres completos
        const traductorRangos = {
            'IRON': 'Hierro', 'BRONZE': 'Bronce', 'SILVER': 'Plata', 'GOLD': 'Oro',
            'PLATINUM': 'Platino', 'EMERALD': 'Esmeralda', 'DIAMOND': 'Diamante',
            'MASTER': 'Maestro', 'GRANDMASTER': 'Gran Maestro', 'CHALLENGER': 'Aspirante'
        };

        const runasMapShort = {
            8000: "Precisión", 8100: "Dominación", 8200: "Brujería", 8300: "Inspiración", 8400: "Valor",
            8005: "Ataque", 8008: "Lethal", 8010: "Conq", 8021: "Fleet", 8112: "Electro",
            8124: "Predator", 8128: "DH", 9923: "HoB", 8214: "Aery", 8229: "Cometa",
            8230: "Fase", 8437: "Garras", 8439: "Aftershock", 8351: "Glacial", 8360: "Libro", 8369: "FirstStrike"
        };

        const me = liveData.participants.find(p => p.puuid === config.puuid);
        const runasResumen = `${runasMapShort[me.perks.perkIds[0]] || "Runa"} + ${runasMapShort[me.perks.perkSubStyle] || "Sec"}`;

        const playerDetails = await Promise.all(liveData.participants.map(async (p) => {
            try {
                const res = await riotRequest.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid}`);
                const soloQ = res.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
                
                let eloLargo = "Unranked";
                if (soloQ) {
                    const tierEsp = traductorRangos[soloQ.tier] || soloQ.tier;
                    // Si es Maestro o superior, no lleva número (I, II, etc)
                    const esTierAlta = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(soloQ.tier);
                    eloLargo = esTierAlta ? tierEsp : `${tierEsp} ${soloQ.rank}`;
                }

                return {
                    champ: champMap[p.championId] || "Champ",
                    team: p.teamId,
                    eloNum: soloQ ? calculateTotalElo(soloQ.tier, soloQ.rank, soloQ.leaguePoints) : null,
                    eloTxt: eloLargo,
                    isSmite: p.spell1Id === 11 || p.spell2Id === 11,
                    puuid: p.puuid
                };
            } catch (e) {
                return { champ: "Champ", team: p.teamId, eloNum: null, eloTxt: "???", isSmite: false };
            }
        }));

        const elosValidos = playerDetails.map(p => p.eloNum).filter(v => v !== null);
        const avgElo = calculateAvgFromElos(elosValidos);

        // Formato sin nombre y sin paréntesis: Campeón Elo
        const formatPlayer = (p) => `${p.champ} ${p.eloTxt}`;
        
        const aliados = playerDetails.filter(p => p.team === me.teamId && p.puuid !== me.puuid)
            .sort((a, b) => b.isSmite - a.isSmite).map(formatPlayer).join(", ");
        
        const rivales = playerDetails.filter(p => p.team !== me.teamId)
            .sort((a, b) => b.isSmite - a.isSmite).map(formatPlayer).join(", ");

        const mensajeFinal = `[PARTIDA] ${config.name}: ${champMap[me.championId]} (${runasResumen}) ┃ AVG: ${avgElo} ┃ ALIADOS: ${aliados} ┃ RIVALES: ${rivales}`;

        client.say(channel, mensajeFinal);

    } catch (e) {
        client.say(channel, e.response && e.response.status === 404 ? `${config.name} no está en partida.` : "Error en !match.");
    }
}
       
       if (command === '!lastmatch' || command === '!ultimogame') {
            try {
                if (!config.puuid) await updateStats(channelName);
                
                const history = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${config.puuid}/ids?start=0&count=1`);
                if (!history.data[0]) return client.say(channel, "Sin historial disponible.");

                const match = await riotRequest.get(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${history.data[0]}`);
                const info = match.data.info;
                const p = info.participants.find(part => part.puuid === config.puuid);
                
                // --- LÓGICA DE RUNAS (MATCH V5) ---
                const primaryStyle = p.perks.styles.find(s => s.description === 'primaryStyle');
                const subStyle = p.perks.styles.find(s => s.description === 'subStyle');
                
                const clave = runasCompletasMap[primaryStyle?.selections[0].perk] || "Runa";
                const rSecundaria = subStyle?.selections.map(s => runasCompletasMap[s.perk] || s.perk).join(", ") || "Secundaria";

                // --- DATOS PARTIDA ---
                // Nota: Sacar el elo medio de una partida pasada requiere 10 peticiones más. 
                // Úsalo con moderación para no recibir ban de Riot.
                const avgEloText = await getAverageElo(info.participants, config.region);
                
                const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
                const durationMins = info.gameDuration / 60;
                const dmg = (p.totalDamageDealtToChampions / durationMins).toFixed(0);

                const mensajeCompleto = `${avgEloText} ${p.win ? 'VICTORIA ' : 'DERROTA '} con ${champMap[p.championId]} (${p.kills}/${p.deaths}/${p.assists}) ┃ CS: ${cs} (${(cs/durationMins).toFixed(1)}/m) ┃ Daño/m: ${dmg} ┃ Runas: ${clave} + (${rSecundaria})`;

                client.say(channel, mensajeCompleto);

            } catch (e) {
                console.error(e);
                client.say(channel, "Error al obtener el último match. ¿Quizás la API de Riot está saturada?");
            }
        }
if (command === '!bans') {
            try {
                if (!config.puuid) await updateStats(channelName);
                const url = `https://${config.region.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${config.puuid}`;
                const response = await riotRequest.get(url);
                const bans = response.data.bannedChampions;

                if (!bans || bans.length === 0) return client.say(channel, "No hay baneos.");

                const nombresBaneados = bans.map(b => champMap[b.championId] || null).filter(n => n !== null);
                
                // Los primeros 5 son un equipo, los siguientes 5 el otro
                const azul = nombresBaneados.slice(0, 5).join(", ");
                const rojo = nombresBaneados.slice(5, 10).join(", ");

                client.say(channel, `[BANS] Azul: ${azul || "Ninguno"} ┃ Rojo: ${rojo || "Ninguno"}`);
            } catch (e) {
                client.say(channel, e.response && e.response.status === 404 ? `${config.name} no está en partida.` : "Error en !bans.");
            }
        }

        // --- COMANDO !RUNAS (CORREGIDO) ---
        if (command === '!perks' || command === '!runas') {
    try {
        if (!config.puuid) await updateStats(channelName);
        const url = `https://${config.region.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${config.puuid}`;
        const response = await riotRequest.get(url);
        const me = response.data.participants.find(p => p.puuid === config.puuid);

        // Mapeamos los IDs de las runas que Riot SI nos deje ver
        const nombres = me.perks.perkIds.map(id => runasCompletasMap[id] || `ID:${id}`);
        
        const clave = nombres[0] || "Desconocida";
        // Aquí usamos perkStyle y perkSubStyle para que nunca salga vacío
        const ramaPrincipal = runasCompletasMap[me.perks.perkStyle] || "Principal";
        const ramaSecundaria = runasCompletasMap[me.perks.perkSubStyle] || "Secundaria";

        // Limpiamos los datos para que no salgan comas feas si faltan IDs
        const menores = nombres.slice(1, 4).filter(n => n && !n.includes("ID:")).join(", ");
        const secundarias = nombres.slice(4, 6).filter(n => n && !n.includes("ID:")).join(", ");

        let msg = `[RUNAS] ${config.name}: ${clave} (${ramaPrincipal}`;
        if (menores) msg += `: ${menores}`;
        msg += `) ┃ Sec: ${ramaSecundaria}`;
        if (secundarias) msg += `: ${secundarias}`;

        client.say(channel, msg);
    } catch (e) {
        client.say(channel, e.response && e.response.status === 404 ? `${config.name} no está en partida.` : "Error en !runas.");
    }
}

        if (command.startsWith('!insulto')) {
            const poolInsultos = [
                "eres más lento que un Nautilus con lag.",
                "tienes menos puntería que un Minion.",
                "¿tu teclado solo tiene la tecla de morir?",
                "eres más inútil que el flash de un Shaco.",
                "hasta el Escurridizo del río farmea mejor que tú.",
                "tu KDA parece el número de emergencias.",
                "te falta más visión que a Lee Sin.",
                "eres el motivo por el cual el surrender existe."
            ];
            const insultoRandom = poolInsultos[Math.floor(Math.random() * poolInsultos.length)];
            const args = message.split(' ');
            let target = args[1] ? args[1] : `@${config.name}`;
            client.say(channel, `${target}, ${insultoRandom}`);
        }

    } catch (err) { console.error("Error", err.message); }
});

client.connect();
