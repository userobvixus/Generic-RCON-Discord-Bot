# 📚 Guide d'Installation : Generic RCON Discord Bot

Ce bot nouvelle génération vous permet d'administrer vos serveurs de jeux (Ark, Rust, Minecraft, Palworld, etc.) via Discord. Il inclut désormais un **Dashboard Web** pour une configuration facile et un **Scanner de Statut** en temps réel.

Suivez ce guide étape par étape pour le configurer.

## 🛠️ Étape 1 : Création du Bot sur Discord

Avant d'installer le serveur, vous devez créer "l'identité" de votre bot chez Discord.

1. Rendez-vous sur le **[Discord Developer Portal](https://discord.com/developers/applications)**.
2. Cliquez sur le bouton **New Application** (en haut à droite).
3. Donnez un nom à votre Bot (ex: *Admin Serveur Ark*) et validez.
4. Dans le menu de gauche, cliquez sur l'onglet **Bot**.
5. Modifiez le nom d'utilisateur si besoin, puis cliquez sur **Reset Token** pour générer votre jeton secret.
6. ⚠️ **IMPORTANT :** Copiez ce **Token** et gardez-le précieusement (vous en aurez besoin à l'Étape 3). Ne le partagez jamais.

### ⚠️ Réglage OBLIGATOIRE (Sinon le bot sera sourd)

Toujours dans l'onglet **Bot**, descendez jusqu'à la section **Privileged Gateway Intents**.
Vous **DEVEZ** cocher la case suivante :

* ✅ **MESSAGE CONTENT INTENT**
* *(Optionnel mais recommandé)* ✅ **SERVER MEMBERS INTENT**

*Sans ces options, le bot ne pourra pas lire vos commandes !*
Cliquez sur **Save Changes** en bas de page.

## 🔗 Étape 2 : Inviter le Bot sur votre serveur

1. Dans le menu de gauche, allez sur **OAuth2** > **URL Generator**.
2. Dans la colonne **Scopes**, cochez : `bot`.
3. Dans la colonne **Bot Permissions** qui apparaît, cochez : `Administrator`.
*(Note : L'option Administrateur est recommandée pour éviter tout souci, mais vous pouvez restreindre les droits si vous savez ce que vous faites).*
4. Tout en bas, copiez l'URL générée (`Generated URL`).
5. Collez cette URL dans votre navigateur, choisissez votre serveur Discord et cliquez sur **Autoriser**.

---

## 🚀 Étape 3 : Installation sur le Panel

Maintenant que le bot existe sur Discord, installons-le sur votre hébergement Pterodactyl.

1. Allez sur votre Panel Pterodactyl.
2. 2. Créez un nouveau serveur en choisissant la catégorie :
* 📂 **Bots pour Discord - Teamspeak - Twitch et serveurs de jeux**
3. Sélectionnez l'Egg nommé : **Jeux Vidéo : Generic RCON Discord Bot**. (Si vous ne l'avez pas, ouvrez un ticket sur le discord de CroustyCloud)
4. Durant l'installation (ou dans l'onglet **Startup**), vous devez remplir les variables suivantes :
* 🔐 **Discord Bot Token :** Collez ici le **Token** que vous avez copié à l'Étape 1.
* 🌐 **Git Repo URL :** Laissez la valeur par défaut.
* 🔑 **Mot de Passe Web :** Définissez un mot de passe sécurisé.
* *Ce mot de passe vous sera demandé pour accéder au Dashboard de configuration si vous vous connectez depuis une nouvelle adresse IP.*




5. **Démarrez le serveur.**
* *Note : Le premier démarrage peut prendre environ 1 minute le temps que le bot télécharge les fichiers et installe les modules nécessaires via GitHub.*



---

## 📝 Étape 4 : Configuration via le Dashboard Web

Fini les fichiers de configuration compliqués ! Tout se gère maintenant via une interface web moderne.

### 1. Accéder au Dashboard

1. Une fois le serveur démarré, regardez dans la console ou l'onglet **Network** pour trouver l'adresse de votre bot.
* L'adresse ressemble à : `http://IP-DU-PANEL:PORT` (ex: `http://77.93.141.XX:25000`).


2. Ouvrez ce lien dans votre navigateur internet.
3. Une page de sécurité va s'afficher : **Entrez le "Mot de Passe Web"** que vous avez défini à l'étape précédente.

### 2. Ajouter vos serveurs de jeux

Sur le Dashboard, cliquez sur le bouton **"Ajouter un serveur"** et remplissez le formulaire :

* **Nom du Serveur :** Le nom affiché sur le panel et Discord.
* **Type de Jeu :** Sélectionnez votre jeu (Ark, Rust, Minecraft, Palworld, etc.) pour que le scanner fonctionne correctement.
* **IP Serveur :** L'adresse IP de votre serveur de jeu (sans le port).
* **Port RCON :** Le port utilisé pour les commandes admin (souvent différent du port de jeu !).
* **Port Query :** Le port de connexion au jeu (utilisé pour voir si le serveur est en ligne).
* **Mot de passe RCON :** Le mot de passe admin de votre serveur de jeu.
* **ID Salon Commandes :** L'identifiant du salon Discord où le bot écoutera les commandes (Activez le *Mode Développeur* sur Discord pour faire Clic-Droit > Copier l'identifiant).

Cliquez sur **Ajouter**. Le bot est instantanément mis à jour, pas besoin de redémarrer !

---

## ✅ Étape 5 : Utilisation et Fonctionnalités

Votre bot est maintenant prêt ! Voici ce qu'il peut faire :

### 📊 Statut en Temps Réel

Le bot scanne vos serveurs toutes les minutes.

* Si vous avez renseigné un **ID Salon Status** dans la configuration, le bot postera (ou modifiera) un message avec l'état du serveur, le nombre de joueurs, la carte et un bouton de connexion.

### 💻 Commandes Discord

Dans le salon que vous avez configuré (ID Salon Commandes) :

* **`!ping`** : Vérifie si le bot répond.
* **`!save`** : Sauvegarde le monde (commande adaptée automatiquement selon le jeu : `saveworld` pour Ark/Rust, `save-all` pour Minecraft).
* ** Commandes du Jeu (RCON Direct)** :
Le bot agit comme une console à distance. Pour **toutes les autres commandes qui existent déjà sur votre jeu**, il suffit de les taper dans le salon Discord en ajoutant simplement un `!` devant.
* *Exemple :* Pour kicker un joueur, tapez `!kick Pseudo`.
* *Exemple :* Pour faire une annonce, tapez `!broadcast Bonjour à tous`.
* *Exemple :* Pour changer l'heure, tapez `!time set day`.
* **En bref :** `!` + `NomDeLaCommande`.



### 🔒 Sécurité

* Le Dashboard Web est protégé par votre mot de passe.
* Vous pouvez restreindre l'utilisation du bot à un rôle spécifique en renseignant l'**ID Rôle Admin** dans la configuration du serveur sur le Dashboard.
