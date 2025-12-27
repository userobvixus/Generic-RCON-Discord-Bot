/**
 * 🤖 BOT DISCORD - RCON ADMIN UNIVERSEL
 * Auteur : .obvixus
 */

const { Client, GatewayIntentBits } = require('discord.js');
const { Rcon } = require('rcon-client');

// ==============================================================================
// ⚙️ CONFIGURATION DES SERVEURS
// ==============================================================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "METTRE_TOKEN_ICI";

const CONFIG_SERVERS = {

    // --- SERVEUR 1 (Exemple) ---
    "REMPLACER_PAR_ID_SALON_DISCORD_1": { 
        nom: "Nom du Serveur 1", 
        ip: "77.93.xxx.xxx", 
        port: 25015,
        pass: "MotDePasseAdmin" 
    },

    // --- SERVEUR 2 (Exemple) ---
    "REMPLACER_PAR_ID_SALON_DISCORD_2": { 
        nom: "Nom du Serveur 2", 
        ip: "77.93.xxx.xxx", 
        port: 25020, 
        pass: "MotDePasseAdmin" 
    },


    // 👇 ZONE D'AJOUT DE SERVEURS 👇
    
    // Pour ajouter un serveur :
    // 1. Copiez tout le bloc grisé ci-dessous (du premier guillemet " jusqu'à la virgule finale ,).
    // 2. Collez-le juste au-dessus de ce commentaire.

    /*
    "ID_DU_SALON_DISCORD": { 
        nom: "Nom du Serveur", 
        ip: "IP_DU_SERVEUR", 
        port: 12345, 
        pass: "MotDePasseAdmin" 
    },
    */

};

// ==============================================================================
// 🚀 LE CODE DU BOT
// ==============================================================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// CORRECTION APPLIQUÉE ICI (ready -> clientReady)
client.once('clientReady', (c) => {
    console.log(`✅ Bot RCON connecté : ${c.user.tag}`);
    console.log(`📡 Gestion de ${Object.keys(CONFIG_SERVERS).length} serveurs.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.reply('Pong ! 🏓 Le bot est en ligne.');
        return;
    }

    const channelID = message.channel.id.trim();
    const targetServer = CONFIG_SERVERS[channelID];

    if (!targetServer || !message.content.startsWith('!')) return;

    const command = message.content.substring(1); 
    
    await message.react('⏳');

    const rcon = new Rcon({
        host: targetServer.ip,
        port: parseInt(targetServer.port),
        password: targetServer.pass,
        timeout: 5000 
    });

    try {
        await rcon.connect();
        const response = await rcon.send(command);
        
        try { await message.reactions.removeAll(); await message.react('✅'); } catch(e) {}

        let replyText = response;
        if (!response || response.length === 0) replyText = "✅ Commande exécutée (Serveur muet).";

        if (replyText.length > 1900) {
            message.reply(`💻 **[${targetServer.nom}]**\n\`\`\`${replyText.substring(0, 1900)}...\`\`\``);
        } else {
            message.reply(`💻 **[${targetServer.nom}]**\n\`\`\`${replyText}\`\`\``);
        }

        await rcon.end();

    } catch (error) {
        console.error(`[ERREUR] ${targetServer.nom} :`, error);
        try { await message.reactions.removeAll(); await message.react('❌'); } catch(e) {}
        message.reply(`❌ **Erreur sur ${targetServer.nom}**\n\`${error.message}\``);
        try { rcon.end(); } catch (e) {} 
    }
});

client.login(DISCORD_TOKEN);
