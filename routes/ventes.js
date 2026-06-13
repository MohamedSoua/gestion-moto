const express = require('express');
const router = express.Router();
const { getDb, query, run, save } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  const { date, client_id } = req.query;
  let sql = 'SELECT * FROM ventes WHERE 1=1';
  const params = [];
  if (date) { sql += ' AND date(date) = ?'; params.push(date); }
  if (client_id) { sql += ' AND client_id = ?'; params.push(client_id); }
  sql += ' ORDER BY date DESC';
  const ventes = query(db, sql, params);
  ventes.forEach(v => { v.items = query(db, 'SELECT * FROM vente_items WHERE vente_id=?', [v.id]); });
  res.json(ventes);
});
router.get('/stats', async (req, res) => {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const todayV = query(db, "SELECT * FROM ventes WHERE date(date)=?", [today]);
  const monthV = query(db, "SELECT * FROM ventes WHERE strftime('%Y-%m',date)=?", [month]);
  const creditsRow = query(db, "SELECT SUM(credit_du) as total FROM clients");
  res.json({ ca_jour: todayV.reduce((s,v)=>s+v.total,0), nb_ventes_jour: todayV.length, ca_mois: monthV.reduce((s,v)=>s+v.total,0), nb_ventes_mois: monthV.length, credits_en_attente: creditsRow[0]?.total || 0 });
});
router.post('/', async (req, res) => {
  const db = await getDb();
  const { client_id, client_nom, items, remise, mode_paiement, notes } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Panier vide' });
  const sous_total = items.reduce((s, i) => s + i.prix_unitaire * i.quantite, 0);
  const total = sous_total * (1 - (remise || 0) / 100);
  const statut = mode_paiement === 'Crédit' ? 'crédit' : 'payé';
  const r = run(db, `INSERT INTO ventes (client_id,client_nom,remise,sous_total,total,mode_paiement,statut,notes) VALUES (?,?,?,?,?,?,?,?)`, [client_id || null, client_nom || 'Anonyme', remise || 0, sous_total, total, mode_paiement || 'Espèces', statut, notes || '']);
  const venteId = r.lastInsertRowid;
  items.forEach(item => {
    run(db, `INSERT INTO vente_items (vente_id,piece_id,piece_ref,piece_nom,prix_unitaire,quantite,total) VALUES (?,?,?,?,?,?,?)`, [venteId, item.piece_id, item.piece_ref, item.piece_nom, item.prix_unitaire, item.quantite, item.prix_unitaire * item.quantite]);
    run(db, 'UPDATE pieces SET quantite = MAX(0, quantite - ?) WHERE id = ?', [item.quantite, item.piece_id]);
  });
  if (statut === 'crédit' && client_id) run(db, 'UPDATE clients SET credit_du = credit_du + ? WHERE id = ?', [total, client_id]);
  save(db);
  res.json({ id: venteId, total });
});
module.exports = router;
