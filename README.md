# 📚 Guide d'Installation : Bot Discord RCON Universel

* Ce bot vous permet d'administrer vos serveurs de jeux (Ark, Rust, Minecraft, Palworld, etc.) directement depuis vos salons Discord. Suivez ce guide étape par étape pour le configurer.

## 🛠️ Étape 1 : Création du Bot sur Discord

* Avant d'installer le serveur chez nous, vous devez créer "l'identité" de votre bot chez Discord.
* 1. Rendez-vous sur le **[Discord Developer Portal](https://discord.com/developers/applications)**.


* 2. Cliquez sur le bouton **New Application** (en haut à droite).


* 3. Donnez un nom à votre Bot (ex: *Admin Serveur Ark*) et validez.


* 4. Dans le menu de gauche, cliquez sur l'onglet **Bot**.


* 5. Modifiez le nom d'utilisateur si besoin, puis cliquez sur **Reset Token** pour générer votre jeton secret.


* ⚠️ **IMPORTANT :** Copiez ce **Token** et gardez-le précieusement (vous en aurez besoin à l'Étape 3). Ne le partagez jamais.

### ⚠️ Réglage OBLIGATOIRE (Sinon le bot sera sourd)

* Toujours dans l'onglet **Bot**, descendez jusqu'à la section **Privileged Gateway Intents**.
* Vous **DEVEZ** cocher la case suivante :
* ✅ **MESSAGE CONTENT INTENT**


* *Sans cette option, le bot ne pourra pas lire vos commandes !*
* Cliquez sur **Save Changes** en bas de page.

## 🔗 Étape 2 : Inviter le Bot sur votre serveur

* 1. Dans le menu de gauche, allez sur **OAuth2** > **URL Generator**.


* 2. Dans la colonne **Scopes**, cochez : `bot`.


* 3. Dans la colonne **Bot Permissions** qui apparaît, cochez : `Administrator`.


* *(Note : L'option Administrateur est recommandée pour éviter tout souci de permission dans les salons privés, mais vous pouvez restreindre si vous savez ce que vous faites).*
* 4. Tout en bas, copiez l'URL générée (`Generated URL`).


* 5. Collez cette URL dans votre navigateur, choisissez votre serveur Discord et cliquez sur **Autoriser**.



## 🚀 Étape 3 : Installation sur le Panel

* Maintenant que le bot existe sur Discord, il faut l'héberger.
* 1. Allez sur votre panel de gestion de serveur.


* 2. Créez un nouveau serveur en choisissant la catégorie :


* 📂 **Applications**


* 3. Sélectionnez l'Egg (Version) nommé : **Generic RCON Discord Bot**. (Si vous ne l'avez pas, ouvrez un ticket sur le discord de CroustyCloud)


* 4. Durant l'installation (ou dans l'onglet *Startup*), une case **Discord Bot Token** vous est demandée.


* Collez ici le **Token** que vous avez copié à l'Étape 1.


* 5. Démarrez le serveur une première fois pour qu'il installe les fichiers.



## 📝 Étape 4 : Configuration des serveurs de jeux

* Une fois le serveur installé, vous devez lui dire quels serveurs de jeux il doit gérer et dans quels salons Discord.

### 1. Activer le Mode Développeur (Pour récupérer les IDs)

* Pour configurer le bot, vous avez besoin des "Identifiants" (ID) de vos salons Discord.
* Sur Discord, allez dans **Paramètres Utilisateur**.
* Allez dans l'onglet **Avancé**.
* Activez l'option **Mode Développeur**.
* *Maintenant, quand vous faites un Clic-Droit sur un salon, vous avez l'option "Copier l'identifiant".*

### 2. Modifier le fichier de configuration

* 1. Sur le panel, allez dans l'onglet **Files** (Fichiers).


* 2. Ouvrez le fichier `rcon-discord.js`.


* 3. Cherchez la section `CONFIG_SERVERS`. C'est ici que tout se passe.


* Vous verrez des blocs comme celui-ci :

```javascript
"REMPLACER_PAR_ID_SALON_DISCORD_1": { 
        nom: "Nom du Serveur", 
        ip: "IP.DE.VOTRE.SERVEUR", 
        port: 25015,
        pass: "VotreMotDePasseAdmin" 
    },

```

* **ID SALON :** Remplacez `"REMPLACER_PAR_ID..."` par l'ID de votre salon Discord (Clic droit sur le salon > Copier l'identifiant).
* **IP :** L'adresse IP de votre serveur de jeu (sans le port).
* **PORT :** ⚠️ Attention, mettez le **PORT RCON** et non le port de connexion au jeu ! (Souvent visible dans l'onglet "Startup" ou "Network" de votre serveur de jeu).
* **PASS :** Votre mot de passe Admin (AdminPassword / RconPassword).

### 3. Ajouter plusieurs serveurs (Cluster)

* Pour ajouter d'autres serveurs, c'est très simple :
* 1. **Copiez tout le bloc** ci-dessus (de la première guillemet `"` jusqu'à la virgule finale `,`).


* 2. **Collez-le** juste en dessous du précédent.


* 3. Modifiez les informations pour le nouveau serveur.


* *Astuce : Veillez à ce que chaque bloc se termine bien par une virgule `,` pour qu'ils s'enchaînent correctement.*

## ✅ Étape 5 : Lancement et Test

* 1. Sauvegardez le fichier `rcon-discord.js`.


* 2. Allez dans la **Console** et cliquez sur **Restart**.


* 3. Attendez de voir le message : `✅ Bot RCON connecté`.


* 4. Sur Discord, dans le salon configuré, tapez la commande : `!ping`.


* Le bot doit répondre : `Pong ! 🏓`.


* 5. Essayez une commande de jeu, par exemple pour Ark : `!ListPlayers`.


* **Félicitations, votre bot est opérationnel !**
