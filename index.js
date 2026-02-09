/**
 * 🤖 BOT RCON ULTIMATE V11 (SECURITY IP LOCK)
 */

const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Rcon } = require('rcon-client');
const { GameDig } = require('gamedig'); 
const express = require('express');
const bodyParser = require('body-parser');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; 
// 👇 LE MOT DE PASSE (Défini dans Pterodactyl, ou "admin123" par défaut si oublié)
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123"; 
const DB_FILE = './database.json';

let serverStates = {}; 

if (!DISCORD_TOKEN) { console.error("❌ TOKEN MANQUANT"); process.exit(1); }

// Initialisation DB avec liste des IPs autorisées (authIps)
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ servers: [], authIps: [] }, null, 2));
}

function getDb() { 
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.authIps) db.authIps = []; // Sécurité pour les vieilles DB
    return db;
}
function saveDb(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// --- WEB SERVER ---
const app = express();
const PORT = process.env.SERVER_PORT || 3000; 

// IMPORTANT POUR PTERODACTYL (Permet de voir la vraie IP derrière le proxy)
app.set('trust proxy', 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');

// --- MIDDLEWARE DE SÉCURITÉ ---
// Cette fonction vérifie l'IP avant chaque page
function checkAuth(req, res, next) {
    const userIp = req.ip; // Récupère l'IP du visiteur
    const db = getDb();

    // Si l'IP est connue, on laisse passer
    if (db.authIps.includes(userIp)) {
        return next();
    }

    // Sinon, on redirige vers le login
    res.render('login', { error: null });
}

// Route Login (POST) : Vérification du mot de passe
app.post('/login', (req, res) => {
    const password = req.body.password;
    
    if (password === AUTH_PASSWORD) {
        // Mot de passe correct : On sauvegarde l'IP
        const db = getDb();
        const userIp = req.ip;
        
        if (!db.authIps.includes(userIp)) {
            db.authIps.push(userIp);
            saveDb(db);
            console.log(`[SÉCURITÉ] Nouvelle IP autorisée : ${userIp}`);
        }
        res.redirect('/');
    } else {
        // Mauvais mot de passe
        console.log(`[SÉCURITÉ] Tentative échouée depuis : ${req.ip}`);
        res.render('login', { error: "❌ Mot de passe incorrect" });
    }
});

// --- ROUTES PROTÉGÉES (On ajoute checkAuth partout) ---

app.get('/', checkAuth, (req, res) => {
    res.render('dashboard', { 
        servers: getDb().servers,
        serverStates: serverStates
    });
});

app.post('/add-server', checkAuth, (req, res) => {
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
    res.redirect('/');
});

app.post('/edit-server', checkAuth, (req, res) => {
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
    }
    res.redirect('/');
});

app.post('/delete-server', checkAuth, (req, res) => {
    const db = getDb();
    db.servers = db.servers.filter(s => s.id !== req.body.id);
    saveDb(db);
    res.redirect('/');
});

app.listen(PORT, () => console.log(`🌍 WEB: Port ${PORT}`));

// --- BOT DISCORD (Inchangé) ---
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
        
        // Alias
        if (command === 'save') {
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
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("✅ Commande envoyée"), 4000));
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
        
        let currentState = { isOnline: false, players: "0/0", map: "---" };
        let finalPort = server.queryPort;

        try {
            let gamedigType = 'valve'; 
            let portsToScan = [server.queryPort];

            switch (server.gameType) {
                case 'asa': gamedigType = 'asa'; portsToScan = [server.queryPort, server.queryPort+1, server.queryPort+2, server.queryPort+3, server.queryPort+15]; break;
                case 'arkse': gamedigType = 'arkse'; portsToScan = [server.queryPort, server.queryPort+1, server.queryPort+15]; break;
                case 'rust': gamedigType = 'rust'; portsToScan = [server.queryPort, server.queryPort+1]; break;
                case 'minecraft': gamedigType = 'minecraft'; break; 
                case 'palworld': gamedigType = 'palworld'; break;
                case 'pz': gamedigType = 'projectzomboid'; break;
                case 'vrising': gamedigType = 'vrising'; break;
                case 'conan': gamedigType = 'conanexiles'; portsToScan = [server.queryPort, server.queryPort+1]; break;
                case 'factorio': gamedigType = 'factorio'; break;
                case '7d2d': gamedigType = '7d2d'; break;
                case 'avorion': gamedigType = 'avorion'; break;
                case 'cs2': gamedigType = 'csgo'; break;
                case 'gmod': gamedigType = 'garrysmod'; break;
                case 'tf2': gamedigType = 'tf2'; break;
                case 'l4d2': gamedigType = 'l4d2'; break;
                default: gamedigType = 'valve'; portsToScan = [server.queryPort, server.queryPort+1]; break;
            }

            for (const port of portsToScan) {
                if (currentState.isOnline) break;
                try {
                    const state = await GameDig.query({ type: gamedigType, host: server.ip, port: port, socketTimeout: 2000, maxRetries: 0 });
                    currentState.isOnline = true;
                    currentState.players = `${state.players.length}/${state.maxplayers}`;
                    currentState.map = state.map || "Map Inconnue";
                    finalPort = port;
                } catch (e) {}
            }

            serverStates[server.id] = currentState;

            if (server.statusChannelId) {
                const channel = await client.channels.fetch(server.statusChannelId);
                if (channel) {
                    const color = currentState.isOnline ? 0x2ecc71 : 0xe74c3c;
                    const statusText = currentState.isOnline ? '🟢 **EN LIGNE**' : '🔴 **HORS LIGNE**';
                    
                    let footerInfo = `Actualisé à ${new Date().toLocaleTimeString('fr-FR')}`;
                    if(currentState.isOnline && finalPort !== server.queryPort) footerInfo += ` • Port détecté : ${finalPort}`;

                    const embed = new EmbedBuilder()
                        .setTitle(`📊 État du serveur : ${server.nom}`)
                        .setColor(color)
                        .addFields(
                            { name: 'Statut', value: statusText, inline: true },
                            { name: 'Joueurs', value: `👥 \`${currentState.players}\``, inline: true },
                            { name: 'Carte', value: `🗺️ ${currentState.map}`, inline: true },
                            { name: 'Connexion', value: `\`connect ${server.ip}:${finalPort}\``, inline: false }
                        )
                        .setFooter({ text: footerInfo });

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