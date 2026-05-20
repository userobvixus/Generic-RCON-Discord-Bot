/**
 * 🤖 BOT RCON ULTIMATE V12 (SECURITY IP LOCK + AUTO BATTLEMETRICS PERFECTED)
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
            console.log(`[SÉCURITÉ] Nouvelle IP autorisée : ${userIp}`);
        }
        res.redirect('/');
    } else {
        console.log(`[SÉCURITÉ] Tentative échouée depuis : ${req.ip}`);
        res.render('login', { error: "❌ Mot de passe incorrect" });
    }
});

app.get('/', checkAuth, (req, res) => {
    res.render('dashboard', { servers: getDb().servers, serverStates: serverStates });
});

// PASSAGE EN ASYNC POUR FORCER LE SCAN IMMÉDIAT
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
        discordChannelId: req.body.discordChannelId.trim(),
        adminRoleId: req.body.adminRoleId ? req.body.adminRoleId.trim() : "",
        logChannelId: req.body.logChannelId ? req.body.logChannelId.trim() : "",
        statusChannelId: req.body.statusChannelId ? req.body.statusChannelId.trim() : "",
        statusMessageId: null
    };
    db.servers.push(newServer);
    saveDb(db);
    
    // Force le bot à scanner tout de suite avant de recharger la page !
    await updateAllServersStatus(); 
    res.redirect('/');
});

// PASSAGE EN ASYNC POUR FORCER LE SCAN IMMÉDIAT
app.post('/edit-server', checkAuth, async (req, res) => {
    const db = getDb();
    const index = db.servers.findIndex(s => s.id === req.body.id);
    if (index !== -1) {
        const oldServer = db.servers[index];
        db.servers[index] = {
            ...oldServer,
            nom: req.body.nom,
            gameType: req.body.gameType,
            ip: req.body.ip.trim(),
            port: parseInt(req.body.port),
            queryPort: parseInt(req.body.queryPort),
            password: req.body.password.trim(),
            discordChannelId: req.body.discordChannelId.trim(),
            adminRoleId: req.body.adminRoleId ? req.body.adminRoleId.trim() : "",
            statusChannelId: req.body.statusChannelId ? req.body.statusChannelId.trim() : ""
        };
        saveDb(db);
        
        // Force le bot à scanner tout de suite avant de recharger la page !
        await updateAllServersStatus();
    }
    res.redirect('/');
});

app.post('/delete-server', checkAuth, (req, res) => {
    const db = getDb();
    db.servers = db.servers.filter(s => s.id !== req.body.id);
    delete serverStates[req.body.id]; // Nettoyage de la mémoire
    saveDb(db);
    res.redirect('/');
});

app.listen(PORT, () => console.log(`🌍 WEB: Port ${PORT}`));

// --- BOT DISCORD ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('clientReady', (c) => {
    console.log(`✅ Bot connecté : ${c.user.tag}`);
    console.log(`🔒 Système de sécurité IP activé.`);
    setInterval(updateAllServersStatus, 60000); 
    setTimeout(updateAllServersStatus, 3000);   
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;
    if (message.content === '!ping') return message.reply('Pong ! 🏓');

    const db = getDb();
    const targetServer = db.servers.find(s => s.discordChannelId === message.channel.id);
    
    if (targetServer) {
        if (targetServer.adminRoleId && !message.member.roles.cache.has(targetServer.adminRoleId)) {
            return message.reply("⛔ Permission refusée.");
        }

        let command = message.content.substring(1).trim();
        const args = command.split(/ +/);
        const action = args[0].toLowerCase();
        
        if (action === 'grade') {
            if (args.length < 3) return message.reply("❌ Usage incorrect. Exemple : `!grade 76561198000000000 VIP`");
            const steamId = args[1];
            const gradeName = args[2];
            if (['arkse', 'asa'].includes(targetServer.gameType)) command = `cheat setplayergroup ${steamId} ${gradeName}`;
            else return message.reply("❌ La commande de grade rapide est configurée uniquement pour les serveurs Ark.");
        }
        else if (action === 'steamid') {
            if (args.length < 2) return message.reply("❌ Usage : `!steamid <LienProfilSteam>`\nExemple : `!steamid https://steamcommunity.com/id/GabeN/`");
            const profileUrl = args[1];
            const profileMatch = profileUrl.match(/\/profiles\/([0-9]{17})/);
            if (profileMatch) return message.reply(`✅ Le SteamID64 est : **${profileMatch[1]}**`);

            try {
                await message.react('⏳');
                const cleanUrl = profileUrl.endsWith('/') ? profileUrl : profileUrl + '/';
                const response = await fetch(`${cleanUrl}?xml=1`);
                const text = await response.text();
                const idMatch = text.match(/<steamID64>([0-9]{17})<\/steamID64>/);
                try { await message.reactions.removeAll(); } catch(e){}
                if (idMatch) {
                    await message.react('✅');
                    message.reply(`✅ Le SteamID64 est : **${idMatch[1]}**`);
                } else {
                    await message.react('❌');
                    message.reply("❌ Impossible de trouver le SteamID64. Vérifie que le lien est valide.");
                }
            } catch (error) {
                console.error("Erreur récupération SteamID:", error);
                try { await message.reactions.removeAll(); await message.react('❌'); } catch(e){}
                message.reply("❌ Erreur de communication avec les serveurs de Steam.");
            }
            return;
        }
        else if (action === 'save') {
            const type = targetServer.gameType;
            if (['arkse', 'asa', 'rust', 'palworld', 'conan'].includes(type)) command = 'saveworld';
            if (['minecraft', 'pz', '7d2d'].includes(type)) command = 'save-all';
            if (['factorio'].includes(type)) command = '/save';
        }

        executeRcon(targetServer, command, message);
    }
});

async function executeRcon(server, command, message) {
    const rcon = new Rcon({ host: server.ip, port: parseInt(server.port), password: server.password, timeout: 5000 });
    try {
        await message.react('⏳');
        await rcon.connect();
        
        const sendPromise = rcon.send(command);
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("✅ Commande envoyée silencieusement"), 4000));
        const response = await Promise.race([sendPromise, timeoutPromise]);
        
        logAction(server, message.author, command, response);
        try { await message.reactions.removeAll(); await message.react('✅'); } catch(e){}

        let replyText = response || "✅ Exécuté.";
        if (replyText.length > 1900) replyText = replyText.substring(0, 1900) + "...";
        
        message.reply(`💻 **[${server.nom}]**\n\`\`\`${replyText}\`\`\``);
        await rcon.end();

    } catch (error) {
        console.error(error);
        try { await message.reactions.removeAll(); await message.react('❌'); } catch(e){}
        message.reply(`❌ **Erreur RCON** : ${error.message}`);
        try { rcon.end(); } catch(e) {}
    }
}

async function logAction(server, user, command, response) {
    if (!server.logChannelId) return;
    try {
        const channel = await client.channels.fetch(server.logChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`📜 Commande Admin`)
                .addFields({ name: 'Serveur', value: server.nom, inline: true }, { name: 'Admin', value: user.tag, inline: true }, { name: 'Cmd', value: `\`${command}\`` })
                .setTimestamp();
            channel.send({ embeds: [embed] });
        }
    } catch (e) {}
}

async function updateAllServersStatus() {
    const db = getDb();
    let dbChanged = false;

    for (const server of db.servers) {
        let currentState = { isOnline: false, players: "0/0", map: "---", extra: null };
        let finalPort = server.queryPort;

        try {
            // --- AUTOMATISATION BATTLEMETRICS (Pour ASA) ---
            if (['asa'].includes(server.gameType)) {
                try {
                    const bmSearchUrl = `https://api.battlemetrics.com/servers?filter[game]=arksa&filter[search]=${server.ip}`;
                    const searchRes = await fetch(bmSearchUrl, { headers: { 'Accept': 'application/json', 'User-Agent': 'CroustyBot/1.5' } });
                    
                    if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
                    
                    const bmData = await searchRes.json();
                    
                    if (bmData.data && bmData.data.length > 0) {
                        let serverData = bmData.data.find(s => s.attributes.ip === server.ip && s.attributes.port === server.queryPort);
                        if (!serverData) serverData = bmData.data.find(s => s.attributes.ip === server.ip);

                        if (serverData) {
                            const bmId = serverData.id;

                            const detailRes = await fetch(`https://api.battlemetrics.com/servers/${bmId}?include=player`, { 
                                headers: { 'Accept': 'application/json', 'User-Agent': 'CroustyBot/1.5' } 
                            });
                            
                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                const detailAttrs = detailData.data.attributes;
                                const fullDetails = detailAttrs.details || {};

                                currentState.isOnline = detailAttrs.status === 'online';
                                currentState.players = `${detailAttrs.players}/${detailAttrs.maxPlayers}`;
                                currentState.map = fullDetails.map || "Inconnue";
                                finalPort = detailAttrs.port;

                                let onlinePlayers = [];
                                if (detailData.included) {
                                    onlinePlayers = detailData.included
                                        .filter(inc => inc.type === 'player')
                                        .map(p => p.attributes.name);
                                }

                                // Extraction robuste des Plateformes
                                let platformsStr = 'PC (Steam)';
                                if (fullDetails.allowedPlatforms && Array.isArray(fullDetails.allowedPlatforms) && fullDetails.allowedPlatforms.length > 0) {
                                    platformsStr = fullDetails.allowedPlatforms.join(', ');
                                } else if (fullDetails.crossplay === true || String(fullDetails.crossplay).toLowerCase() === 'true') {
                                    platformsStr = 'PC (Steam), Xbox, PC (Windows Store), Playstation';
                                } else if (fullDetails.serverPlatforms && Array.isArray(fullDetails.serverPlatforms)) {
                                    platformsStr = fullDetails.serverPlatforms.join(', ');
                                }

                                // Extraction de la liste des Mods
                                let modsArray = [];
                                if (fullDetails.mods && Array.isArray(fullDetails.mods)) modsArray = fullDetails.mods;
                                else if (fullDetails.modIds && Array.isArray(fullDetails.modIds)) modsArray = fullDetails.modIds;

                                currentState.extra = {
                                    official: fullDetails.official ? 'True, Official' : 'False, Unofficial',
                                    pve: fullDetails.pve ? 'True' : 'False',
                                    crossplay: fullDetails.crossplay ? 'True' : 'False',
                                    platforms: platformsStr,
                                    mods: modsArray,
                                    playerNames: onlinePlayers,
                                    bmLink: `https://www.battlemetrics.com/servers/arksa/${bmId}`
                                };
                            } else {
                                throw new Error("Impossible de charger les détails BM.");
                            }
                        } else {
                            currentState.map = "Port introuvable sur BM";
                            currentState.extra = {}; 
                        }
                    } else {
                        currentState.map = "IP introuvable sur BM";
                        currentState.extra = {}; 
                    }
                } catch (e) {
                    console.error(`Erreur API BM pour ${server.nom}:`, e.message);
                    currentState.map = "Erreur API";
                    currentState.extra = {}; 
                }
            } 
            // --- SYSTÈME CLASSIQUE GAMEDIG ---
            else {
                let gamedigType = 'valve'; 
                let portsToScan = [server.queryPort];

                switch (server.gameType) {
                    case 'arkse': gamedigType = 'arkse'; portsToScan = [server.queryPort, server.queryPort+1, server.queryPort+15]; break;
                    case 'rust': gamedigType = 'rust'; portsToScan = [server.queryPort, server.queryPort+1]; break;
                    case 'minecraft': gamedigType = 'minecraft'; break; 
                    case 'palworld': gamedigType = 'palworld'; break;
                    default: gamedigType = 'valve'; portsToScan = [server.queryPort, server.queryPort+1]; break;
                }

                let success = false;
                for (const port of portsToScan) {
                    if (success) break;
                    try {
                        const state = await GameDig.query({ type: gamedigType, host: server.ip, port: port, socketTimeout: 2000, maxRetries: 0 });
                        currentState.isOnline = true;
                        currentState.players = `${state.players.length}/${state.maxplayers}`;
                        currentState.map = state.map || "Map Inconnue";
                        finalPort = port;
                        
                        currentState.extra = {
                            playerNames: state.players.map(p => p.name || 'Inconnu').filter(n => n)
                        };
                        success = true;
                    } catch (e) {}
                }
                
                if (!success) {
                    currentState.extra = {}; 
                }
            }

            serverStates[server.id] = currentState;

            // --- MISE À JOUR DU MESSAGE DISCORD ---
            if (server.statusChannelId) {
                const channel = await client.channels.fetch(server.statusChannelId).catch(()=>null);
                if (channel) {
                    const color = currentState.isOnline ? 0x2ecc71 : 0xe74c3c;
                    const statusText = currentState.isOnline ? '🟢 **EN LIGNE**' : '🔴 **HORS LIGNE**';
                    
                    let footerInfo = `Actualisé à ${new Date().toLocaleTimeString('fr-FR')}`;
                    if(currentState.isOnline && finalPort !== server.queryPort && !['asa'].includes(server.gameType)) {
                        footerInfo += ` • Port détecté : ${finalPort}`;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`📊 État du serveur : ${server.nom}`)
                        .setColor(color)
                        .addFields(
                            { name: 'Statut', value: statusText, inline: true },
                            { name: 'Joueurs', value: `👥 \`${currentState.players}\``, inline: true },
                            { name: 'Carte', value: `🗺️ ${currentState.map}`, inline: true }
                        )
                        .setFooter({ text: footerInfo });
                    
                    if (currentState.extra && currentState.extra.bmLink) {
                         embed.setURL(currentState.extra.bmLink);
                    } else if (currentState.isOnline && !['asa'].includes(server.gameType)) {
                         embed.addFields({ name: 'Connexion', value: `\`connect ${server.ip}:${finalPort}\``, inline: false });
                    }

                    if (server.statusMessageId) {
                        try {
                            const msg = await channel.messages.fetch(server.statusMessageId);
                            await msg.edit({ embeds: [embed] });
                        } catch (e) {
                            const msg = await channel.send({ embeds: [embed] });
                            server.statusMessageId = msg.id;
                            dbChanged = true;
                        }
                    } else {
                        const msg = await channel.send({ embeds: [embed] });
                        server.statusMessageId = msg.id;
                        dbChanged = true;
                    }
                }
            }

        } catch (e) { console.error(`Erreur Status ${server.nom}:`, e.message); }
    }

    if (dbChanged) saveDb(db);
}

client.login(DISCORD_TOKEN);
