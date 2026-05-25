/**
 * 🤖 BOT RCON
 */

const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Rcon } = require('rcon-client');
const { GameDig } = require('gamedig'); 
const express = require('express');
const bodyParser = require('body-parser');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; 
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123"; 
const DB_FILE = './database.json';

let serverStates = {}; 

if (!DISCORD_TOKEN) { console.error("❌ TOKEN MANQUANT"); process.exit(1); }

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ servers: [], authIps: [] }, null, 2));
}

function getDb() { 
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.authIps) db.authIps = []; 
    return db;
}
function saveDb(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// --- WEB SERVER ---
const app = express();
const PORT = process.env.SERVER_PORT || 3000; 

app.set('trust proxy', 1);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); 
app.set('view engine', 'ejs');
app.set('views', './views');

function checkAuth(req, res, next) {
    const userIp = req.ip; 
    const db = getDb();
    if (db.authIps.includes(userIp)) return next();
    res.render('login', { error: null });
}

app.post('/login', (req, res) => {
    const password = req.body.password;
    if (password === AUTH_PASSWORD) {
        const db = getDb();
        const userIp = req.ip;
        if (!db.authIps.includes(userIp)) {
            db.authIps.push(userIp);
            saveDb(db);
        }
        res.redirect('/');
    } else {
        res.render('login', { error: "❌ Mot de passe incorrect" });
    }
});

app.get('/', checkAuth, (req, res) => {
    res.render('dashboard', { servers: getDb().servers, serverStates: serverStates });
});

app.post('/add-server', checkAuth, async (req, res) => {
    const db = getDb();
    const newServer = {
        id: Date.now().toString(),
        nom: req.body.nom,
        gameType: req.body.gameType,
        ip: req.body.ip.trim(),
        port: parseInt(req.body.port),
        queryPort: parseInt(req.body.queryPort),
        password: req.body.password.trim(),
        discordChannelId: req.body.discordChannelId ? req.body.discordChannelId.trim() : "",
        adminRoleId: req.body.adminRoleId ? req.body.adminRoleId.trim() : "",
        logChannelId: req.body.logChannelId ? req.body.logChannelId.trim() : "",
        statusChannelId: req.body.statusChannelId ? req.body.statusChannelId.trim() : "",
        statusMessageId: null
    };
    db.servers.push(newServer);
    saveDb(db);
    await updateSingleServer(newServer.id);
    res.redirect('/');
});

app.post('/edit-server', checkAuth, async (req, res) => {
    const db = getDb();
    const index = db.servers.findIndex(s => s.id === req.body.id);
    if (index !== -1) {
        db.servers[index] = { 
            ...db.servers[index], 
            ...req.body, 
            port: parseInt(req.body.port), 
            queryPort: parseInt(req.body.queryPort),
            discordChannelId: req.body.discordChannelId ? req.body.discordChannelId.trim() : ""
        };
        saveDb(db);
        await updateSingleServer(req.body.id);
    }
    res.redirect('/');
});

app.post('/delete-server', checkAuth, (req, res) => {
    const db = getDb();
    db.servers = db.servers.filter(s => s.id !== req.body.id);
    delete serverStates[req.body.id];
    saveDb(db);
    res.redirect('/');
});

app.post('/refresh-server', checkAuth, async (req, res) => {
    await updateSingleServer(req.body.id);
    res.redirect('/');
});

// API : Web RCON Console
app.post('/api/rcon', checkAuth, async (req, res) => {
    const { serverId, command } = req.body;
    const db = getDb();
    const server = db.servers.find(s => s.id === serverId);
    if (!server) return res.json({ success: false, error: "Serveur introuvable" });

    const rcon = new Rcon({ host: server.ip, port: server.port, password: server.password, timeout: 5000 });
    try {
        await rcon.connect();
        
        let responseText = "";
        try {
            responseText = await Promise.race([
                rcon.send(command),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_NO_RESPONSE")), 3000))
            ]);
        } catch (raceError) {
            if (raceError.message === "TIMEOUT_NO_RESPONSE") {
                responseText = "✔️ Commande envoyée (Aucune réponse texte du serveur).";
            } else {
                throw raceError; 
            }
        }

        rcon.end().catch(()=>{}); 
        
        logAction(server, { tag: "Web_Console" }, command, responseText);
        res.json({ success: true, response: responseText });
    } catch (err) {
        try { rcon.end().catch(()=>{}); } catch(e){}
        res.json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`🌍 WEB: Port ${PORT}`));

// --- BOT DISCORD ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('clientReady', (c) => {
    console.log(`✅ Bot connecté : ${c.user.tag}`);
    setInterval(updateAllServersStatus, 60000); 
    setTimeout(updateAllServersStatus, 3000);   
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;
    if (message.content === '!ping') return message.reply('Pong ! 🏓');

    const db = getDb();
    // On s'assure que le serveur a bien un channel ID configuré avant de vérifier
    const targetServer = db.servers.find(s => s.discordChannelId && s.discordChannelId === message.channel.id);
    
    if (targetServer) {
        if (targetServer.adminRoleId && !message.member.roles.cache.has(targetServer.adminRoleId)) return message.reply("⛔ Permission refusée.");

        let command = message.content.substring(1).trim();
        const args = command.split(/ +/);
        const action = args[0].toLowerCase();
        
        if (action === 'grade') {
            if (args.length < 3) return message.reply("❌ Usage incorrect.");
            if (['arkse', 'asa'].includes(targetServer.gameType)) command = `cheat setplayergroup ${args[1]} ${args[2]}`;
            else return message.reply("❌ Uniquement pour les serveurs Ark.");
        } else if (action === 'steamid') {
            return message.reply("Fonctionnalité en cours de restructuration API.");
        } else if (action === 'save') {
            if (['arkse', 'asa', 'rust', 'palworld', 'conan'].includes(targetServer.gameType)) command = 'saveworld';
            if (['minecraft', 'pz', '7d2d'].includes(targetServer.gameType)) command = 'save-all';
        }

        executeRcon(targetServer, command, message);
    }
});

async function executeRcon(server, command, message) {
    const rcon = new Rcon({ host: server.ip, port: server.port, password: server.password, timeout: 5000 });
    try {
        await message.react('⏳');
        await rcon.connect();
        
        let replyText = "";
        try {
            replyText = await Promise.race([
                rcon.send(command),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_NO_RESPONSE")), 3000))
            ]);
        } catch (raceError) {
            if (raceError.message === "TIMEOUT_NO_RESPONSE") {
                replyText = "✅ Commande envoyée (Aucune réponse texte du serveur).";
            } else {
                throw raceError;
            }
        }
        
        logAction(server, message.author, command, replyText);
        try { await message.reactions.removeAll(); await message.react('✅'); } catch(e){}

        if (!replyText || replyText.trim() === "") replyText = "✅ Exécuté (Réponse vide).";
        if (replyText.length > 1900) replyText = replyText.substring(0, 1900) + "...";
        message.reply(`💻 **[${server.nom}]**\n\`\`\`${replyText}\`\`\``);
        
        rcon.end().catch(()=>{});

    } catch (error) {
        console.error("Erreur RCON:", error.message);
        try { await message.reactions.removeAll(); await message.react('❌'); } catch(e){}
        message.reply(`❌ **Erreur RCON** : ${error.message}`);
    }
}

async function logAction(server, user, command, response) {
    if (!server.logChannelId) return;
    try {
        const channel = await client.channels.fetch(server.logChannelId);
        if (channel) {
            const embed = new EmbedBuilder().setColor(0xFFA500).setTitle(`📜 Commande Admin`).addFields(
                { name: 'Serveur', value: server.nom, inline: true }, { name: 'Admin', value: user.tag || user.username || "Système", inline: true }, { name: 'Cmd', value: `\`${command}\`` }
            ).setTimestamp();
            channel.send({ embeds: [embed] });
        }
    } catch (e) {}
}

async function updateAllServersStatus() {
    const db = getDb();
    for (const server of db.servers) {
        await updateSingleServer(server.id);
    }
}

async function updateSingleServer(serverId) {
    const db = getDb();
    const server = db.servers.find(s => s.id === serverId);
    if (!server) return;

    let currentState = { isOnline: false, players: "0/0", map: "---", extra: null };
    let finalPort = server.queryPort;

    try {
        if (['asa'].includes(server.gameType)) {
            try {
                const bmSearchUrl = `https://api.battlemetrics.com/servers?filter[game]=arksa&filter[search]=${server.ip}&page[size]=100`;
                const searchRes = await fetch(bmSearchUrl, { headers: { 'Accept': 'application/json' } });
                
                if (searchRes.ok) {
                    const bmData = await searchRes.json();
                    
                    if (bmData.data && bmData.data.length > 0) {
                        const serverData = bmData.data.find(s => 
                            (s.attributes.ip === server.ip || (s.attributes.address && s.attributes.address.includes(server.ip))) && 
                            (s.attributes.port == server.queryPort || s.attributes.portQuery == server.queryPort)
                        );

                        if (serverData) {
                            const bmId = serverData.id;
                            const detailRes = await fetch(`https://api.battlemetrics.com/servers/${bmId}?include=player`, { headers: { 'Accept': 'application/json' } });
                            
                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                const fullDetails = detailData.data.attributes.details || {};

                                currentState.isOnline = detailData.data.attributes.status === 'online';
                                currentState.players = `${detailData.data.attributes.players}/${detailData.data.attributes.maxPlayers}`;
                                currentState.map = fullDetails.map || "Inconnue";
                                finalPort = detailData.data.attributes.port;

                                let onlinePlayers = [];
                                if (detailData.included) onlinePlayers = detailData.included.filter(inc => inc.type === 'player').map(p => p.attributes.name);

                                let platformsStr = 'PC (Steam)';
                                if (fullDetails.allowedPlatforms && fullDetails.allowedPlatforms.length > 0) platformsStr = fullDetails.allowedPlatforms.join(', ');
                                else if (String(fullDetails.crossplay).toLowerCase() === 'true') platformsStr = 'PC (Steam), Xbox, Windows, PlayStation';

                                currentState.extra = {
                                    official: fullDetails.official ? 'True, Official' : 'False, Unofficial',
                                    pve: fullDetails.pve ? 'True' : 'False',
                                    crossplay: fullDetails.crossplay ? 'True' : 'False',
                                    platforms: platformsStr,
                                    mods: fullDetails.mods || fullDetails.modIds || [],
                                    playerNames: onlinePlayers,
                                    bmLink: `https://www.battlemetrics.com/servers/arksa/${bmId}`
                                };
                            }
                        } else {
                            currentState.map = "Port introuvable sur BM";
                            currentState.extra = {}; 
                        }
                    } else {
                        currentState.map = "IP introuvable sur BM";
                        currentState.extra = {}; 
                    }
                }
            } catch (e) {
                currentState.map = "Erreur API BM";
                currentState.extra = {}; 
            }
        } 
        else {
            let gamedigType = 'valve'; 
            let portsToScan = [server.queryPort];
            if (server.gameType === 'arkse') { gamedigType = 'arkse'; portsToScan = [server.queryPort, server.queryPort+1, server.queryPort+15]; }
            if (server.gameType === 'rust') gamedigType = 'rust';

            let success = false;
            for (const port of portsToScan) {
                if (success) break;
                try {
                    const state = await GameDig.query({ type: gamedigType, host: server.ip, port: port, socketTimeout: 2000, maxRetries: 0 });
                    currentState.isOnline = true;
                    currentState.players = `${state.players.length}/${state.maxplayers}`;
                    currentState.map = state.map || "Map Inconnue";
                    finalPort = port;
                    currentState.extra = { playerNames: state.players.map(p => p.name || 'Inconnu') };
                    success = true;
                } catch (e) {}
            }
            if (!success) currentState.extra = {}; 
        }

        serverStates[server.id] = currentState;

        // --- DISCORD EMBED BEAUTIFIER ---
        if (server.statusChannelId) {
            const channel = await client.channels.fetch(server.statusChannelId).catch(()=>null);
            if (channel) {
                const color = currentState.isOnline ? 0x2ecc71 : 0xe74c3c;
                let footerInfo = `Actualisé à ${new Date().toLocaleTimeString('fr-FR')}`;

                const embed = new EmbedBuilder()
                    .setTitle(currentState.isOnline ? `🟢 ${server.nom}` : `🔴 ${server.nom}`)
                    .setColor(color);
                
                if (currentState.isOnline) {
                    embed.addFields(
                        { name: '👥 Joueurs', value: `\`${currentState.players}\``, inline: true },
                        { name: '🗺️ Carte', value: `\`${currentState.map}\``, inline: true }
                    );

                    // Ajout des infos détaillées si elles existent (BM)
                    if (currentState.extra && currentState.extra.platforms) {
                        embed.addFields({ name: '⚙️ Mode', value: `\`${currentState.extra.pve === 'True' ? 'PVE' : 'PVP'}\``, inline: true });
                        
                        if (currentState.extra.mods && currentState.extra.mods.length > 0) {
                            embed.addFields({ name: '🧩 Mods Actifs', value: `\`${currentState.extra.mods.length} Mods\``, inline: true });
                        }
                        embed.addFields({ name: '🎮 Plateformes', value: `\`${currentState.extra.platforms}\``, inline: false });
                    }
                    
                    if (currentState.extra && currentState.extra.bmLink) {
                        embed.setURL(currentState.extra.bmLink);
                    } else if (!['asa'].includes(server.gameType)) {
                        embed.addFields({ name: '🔗 Connexion rapide', value: `\`connect ${server.ip}:${finalPort}\``, inline: false });
                    }
                } else {
                    embed.setDescription("Le serveur est actuellement injoignable ou en cours de redémarrage.");
                }

                embed.setFooter({ text: footerInfo });

                if (server.statusMessageId) {
                    try {
                        const msg = await channel.messages.fetch(server.statusMessageId);
                        await msg.edit({ embeds: [embed] });
                    } catch (e) {
                        const msg = await channel.send({ embeds: [embed] });
                        server.statusMessageId = msg.id;
                        saveDb(db);
                    }
                } else {
                    const msg = await channel.send({ embeds: [embed] });
                    server.statusMessageId = msg.id;
                    saveDb(db);
                }
            }
        }
    } catch (e) { console.error(`Erreur Status ${server.nom}:`, e.message); }
}

client.login(DISCORD_TOKEN);
