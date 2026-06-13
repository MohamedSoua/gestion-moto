# 🏍️ Gestion Pièces Moto

Système complet de gestion pour magasin de pièces de rechange moto.

## Modules inclus
- 📦 Stock & inventaire (avec alertes de rupture)
- 🛒 Ventes & caisse (ticket PDF, crédit client)
- 🚚 Achats & réceptions fournisseurs
- 👥 Gestion des clients & crédits
- 📈 Rapports & statistiques

## Déploiement sur Render.com (gratuit)

### Étape 1 — Mettre le code sur GitHub
1. Crée un compte sur https://github.com
2. Clique "New repository", nomme-le `gestion-moto`, clique "Create repository"
3. Sur la page du repo, clique "uploading an existing file"
4. Glisse-dépose TOUS les fichiers de ce dossier (sauf node_modules)
5. Clique "Commit changes"

### Étape 2 — Déployer sur Render
1. Va sur https://render.com et crée un compte gratuit
2. Clique "New +" → "Web Service"
3. Connecte ton compte GitHub et sélectionne le repo `gestion-moto`
4. Configure :
   - Name: gestion-pieces-moto
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Clique "Create Web Service"
6. Attends 2-3 minutes → ton lien est prêt !

## Lancement en local (sur ton PC)
```
npm install
npm start
```
Ouvre http://localhost:3000
