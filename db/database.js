const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'moto.db');

let _db = null;

async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    _db = new SQL.Database(data);
  } else {
    _db = new SQL.Database();
  }
  _db.run(`PRAGMA foreign_keys = ON;`);
  initSchema(_db);
  seedData(_db);
  save(_db);
  return _db;
}

function save(db) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL, nom TEXT NOT NULL,
      motos TEXT DEFAULT '[]', categorie TEXT DEFAULT 'Autre',
      prix_achat REAL DEFAULT 0, prix_vente REAL DEFAULT 0,
      quantite INTEGER DEFAULT 0, seuil_alerte INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fournisseurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, telephone TEXT,
      adresse TEXT, specialite TEXT, delai_livraison TEXT, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, telephone TEXT,
      moto TEXT, notes TEXT, credit_du REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, client_nom TEXT DEFAULT 'Anonyme',
      remise REAL DEFAULT 0, sous_total REAL DEFAULT 0, total REAL DEFAULT 0,
      mode_paiement TEXT DEFAULT 'Espèces', statut TEXT DEFAULT 'payé', notes TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS vente_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, vente_id INTEGER NOT NULL, piece_id INTEGER,
      piece_ref TEXT, piece_nom TEXT, prix_unitaire REAL, quantite INTEGER, total REAL
    );
    CREATE TABLE IF NOT EXISTS achats (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fournisseur_id INTEGER, fournisseur_nom TEXT,
      total REAL DEFAULT 0, statut TEXT DEFAULT 'commandé', notes TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS achat_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, achat_id INTEGER NOT NULL, piece_id INTEGER,
      piece_nom TEXT, quantite INTEGER, prix_unitaire REAL, total REAL
    );
    CREATE TABLE IF NOT EXISTS depenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      libelle TEXT NOT NULL,
      montant REAL NOT NULL,
      categorie TEXT DEFAULT 'Autre',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedData(db) {
  const count = db.exec("SELECT COUNT(*) as n FROM pieces");
  if (count[0]?.values[0][0] > 0) return;
  const pieces = [
    ['OV-FLT-001','Filtre à air','["Overston","Forza"]','Filtration',4.5,8.0,23,5],
    ['OV-FRN-002','Plaquettes de frein avant','["Overston"]','Freinage',7.2,14.0,3,5],
    ['BS-CHN-001','Chaîne de transmission','["Booster"]','Transmission',12.0,22.0,0,3],
    ['FZ-BOG-001',"Bougie d'allumage NGK",'["Forza","Booster","Altro"]','Moteur',2.8,5.5,18,6],
    ['OV-HUI-001','Huile moteur 10W40 (1L)','["Overston","Forza"]','Moteur',6.0,11.0,4,8],
    ['AL-FLT-002','Filtre à huile','["Altro","Overston"]','Filtration',3.5,7.0,11,4],
  ];
  pieces.forEach(p => db.run(`INSERT INTO pieces (ref,nom,motos,categorie,prix_achat,prix_vente,quantite,seuil_alerte) VALUES (?,?,?,?,?,?,?,?)`, p));
  db.run(`INSERT INTO fournisseurs (nom,telephone,adresse,specialite,delai_livraison) VALUES (?,?,?,?,?)`,
    ['Pièces Auto Tunis','71 000 001','Tunis','Filtration, Moteur','2-3 jours']);
  db.run(`INSERT INTO fournisseurs (nom,telephone,adresse,specialite,delai_livraison) VALUES (?,?,?,?,?)`,
    ['Moto Supply Sfax','74 000 002','Sfax','Freinage, Transmission','3-5 jours']);
}

function query(db, sql, params=[]) {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch(e) { console.error('Query error:', sql, e.message); return []; }
}

function run(db, sql, params=[]) {
  try {
    db.run(sql, params);
    const idRes = db.exec("SELECT last_insert_rowid() as id");
    const lastId = idRes[0]?.values[0][0] || null;
    return { lastInsertRowid: lastId };
  } catch(e) { console.error('Run error:', sql, e.message); return { lastInsertRowid: null }; }
}

module.exports = { getDb, query, run, save };
