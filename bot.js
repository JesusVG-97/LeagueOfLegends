const tmi = require('tmi.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot LOL Online'));
app.listen(process.env.PORT || 3000);

// --- MAPEO DE CAMPEONES (ACTUALIZADO HASTA AMBESSA) ---
const champMap = {
    1: "Annie", 2: "Olaf", 3: "Galio", 4: "Twisted Fate", 5: "Xin Zhao", 6: "Urgot", 7: "LeBlanc", 8: "Vladimir", 9: "Fiddlesticks", 10: "Kayle", 11: "Master Yi", 12: "Alistar", 13: "Ryze", 14: "Sion", 15: "Sivir", 16: "Soraka", 17: "Teemo", 18: "Tristana", 19: "Warwick", 20: "Nunu", 21: "Miss Fortune", 22: "Ashe", 23: "Tryndamere", 24: "Jax", 25: "Morgana", 26: "Zilean", 27: "Singed", 28: "Evelynn", 29: "Twitch", 30: "Karthus", 31: "Cho'Gath", 32: "Amumu", 33: "Rammus", 34: "Anivia", 35: "Shaco", 36: "Dr. Mundo", 37: "Sona", 38: "Kassadin", 39: "Irelia", 40: "Janna", 41: "Gangplank", 42: "Corki", 43: "Karma", 44: "Taric", 45: "Veigar", 48: "Trundle", 50: "Swain", 51: "Caitlyn", 53: "Blitzcrank", 54: "Malphite", 55: "Katarina", 56: "Nocturne", 57: "Maokai", 58: "Renekton", 59: "Jarvan IV", 60: "Elise", 61: "Orianna", 62: "Wukong", 63: "Brand", 64: "Lee Sin", 67: "Vayne", 68: "Rumble", 69: "Cassiopeia", 72: "Skarner", 74: "Heimerdinger", 75: "Nasus", 76: "Nidalee", 77: "Udyr", 78: "Poppy", 79: "Gragas", 80: "Pantheon", 81: "Ezreal", 82: "Mordekaiser", 83: "Yorick", 84: "Akali", 85: "Kennen", 86: "Garen", 89: "Leona", 90: "Malzahar", 91: "Talon", 92: "Riven", 96: "Kog'Maw", 98: "Shen", 99: "Lux", 101: "Xerath", 102: "Shyvana", 103: "Ahri", 104: "Graves", 105: "Fizz", 106: "Volibear", 107: "Rengar", 110: "Varus", 111: "Nautilus", 112: "Viktor", 113: "Sejuani", 114: "Fiora", 115: "Ziggs", 117: "Lulu", 119: "Draven", 120: "Hecarim", 121: "Khazix", 122: "Darius", 126: "Jayce", 127: "Lissandra", 131: "Diana", 133: "Quinn", 134: "Syndra", 136: "Aurelion Sol", 141: "Kayn", 142: "Zoe", 143: "Zyra", 145: "Kaisa", 147: "Seraphine", 150: "Gnar", 154: "Zac", 157: "Yasuo", 161: "Velkoz", 163: "Taliyah", 164: "Camille", 166: "Akshan", 200: "Belveth", 201: "Braum", 202: "Jhin", 203: "Kindred", 221: "Zeri", 222: "Jinx", 223: "Tahm Kench", 233: "Briar", 234: "Viego", 235: "Senna", 236: "Lucian", 238: "Zed", 240: "Kled", 245: "Ekko", 246: "Qiyana", 254: "Vi", 266: "Aatrox", 267: "Nami", 268: "Azir", 350: "Yuumi", 360: "Samira", 412: "Thresh", 420: "Illaoi", 421: "RekSai", 427: "Ivern", 429: "Kalista", 432: "Bard", 497: "Rakan", 498: "Xayah", 516: "Ornn", 517: "Sylas", 518: "Neeko", 523: "Aphelios", 526: "Rell", 555: "Pyke", 711: "Vex", 777: "Yone", 799: "Smolder", 875: "Sett", 876: "Lillia", 887: "Gwen", 888: "Renata", 895: "Nilah", 897: "KSante", 901: "Hwei", 902: "Milio", 910: "Hwei", 950: "Naafiri", 1000: "Ambessa"
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
                if (!config.puuid) await updateStats(channelName);

                const url = `https://${config.region.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${config.puuid}`;
                const activeResponse = await riotRequest.get(url);
                const liveData = activeResponse.data;

                // 1. Diccionario de Runas (Clave + Secundaria)
                const runasMap = {
                    8000: "Precisión", 8100: "Dominación", 8200: "Brujería", 8300: "Inspiración", 8400: "Valor",
                    8005: "PTA", 8008: "Lethal Tempo", 8010: "Conqueror", 8021: "Fleet",
                    8112: "Electrocute", 8124: "Predator", 8128: "Dark Harvest", 9923: "HoB",
                    8214: "Aery", 8229: "Cometa", 8230: "Fase", 8437: "Garras", 8439: "Aftershock",
                    8351: "Glacial", 8360: "Libro", 8369: "First Strike"
                };

                const me = liveData.participants.find(p => p.puuid === config.puuid);
                
                // Formato runas: Clave + Rama Secundaria
                const runeClave = runasMap[me.perks.perkIds[0]] || "Runa";
                const runeSecu = runasMap[me.perks.perkSubStyle] || "Sec";
                const runasCompletas = `${runeClave} + ${runeSecu}`;

                // 2. Obtener Elo de TODOS los jugadores
                // Esto puede tardar 1-2 segundos
                const playerDetails = await Promise.all(liveData.participants.map(async (p) => {
                    const res = await riotRequest.get(`https://${config.region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid}`).catch(() => ({ data: [] }));
                    const soloQ = res.data.find(l => l.queueType === 'RANKED_SOLO_5x5');
                    const eloTxt = soloQ ? `${soloQ.tier.charAt(0)}${soloQ.rank}` : "Unranked"; // Ej: E3, D1
                    
                    return {
                        name: p.riotIdGameName || "Anon",
                        champ: champMap[p.championId] || "Champ",
                        team: p.teamId,
                        elo: eloTxt,
                        isSmite: p.spell1Id === 11 || p.spell2Id === 11,
                        puuid: p.puuid
                    };
                }));

                // 3. Calcular Elo Medio (usando tu función de antes)
                const avgElo = await getAverageElo(liveData.participants, config.region);

                // 4. Organizar Aliados y Rivales
                // Intentamos poner al Jungla (smite) el segundo por convención
                const sortTeam = (teamId) => {
                    const team = playerDetails.filter(p => p.team === teamId);
                    return team.sort((a, b) => b.isSmite - a.isSmite); // El que tiene smite arriba
                };

                const formatPlayer = (p) => `${p.name}(${p.champ} ${p.elo})`;

                const misAliados = sortTeam(me.teamId).filter(p => p.puuid !== me.puuid).map(formatPlayer).join(", ");
                const misRivales = sortTeam(me.teamId === 100 ? 200 : 100).map(formatPlayer).join(", ");

                // MENSAJES
                client.say(channel, `[PARTIDA] ${config.name}: ${champMap[me.championId]} (${runasCompletas}) | Elo Medio: ${avgElo}`);
                client.say(channel, `ALIADOS: ${misAliados}`);
                client.say(channel, `RIVALES: ${misRivales}`);

            } catch (e) {
                if (e.response && e.response.status === 404) {
                    client.say(channel, `${config.name} no está en partida.`);
                } else {
                    console.error(e);
                    client.say(channel, "Error al obtener detalles.");
                }
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
            client.say(channel, `MEDIA: ${avgEloText}: ${p.win ? 'VICTORIA' : 'DERROTA'} con ${p.championName}. KDA: ${p.kills}/${p.deaths}/${p.assists}. CS: ${cs} (${(cs/(info.gameDuration/60)).toFixed(1)}/m). Daño/m: ${dmg} Vision: ${p.visionScore}`);
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
