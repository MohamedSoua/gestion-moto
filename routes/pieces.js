const express = require('express');
const router = express.Router();
const { getDb, query, run, save } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  const { search, moto, categorie, statut } = req.query;
  let sql = 'SELECT * FROM pieces WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (nom LIKE ? OR ref LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (moto) { sql += ' AND motos LIKE ?'; params.push(`%${moto}%`); }
  if (categorie) { sql += ' AND categorie = ?'; params.push(categorie); }
  sql += ' ORDER BY nom';
  let pieces = query(db, sql, params).map(p => ({ ...p, motos: JSON.parse(p.motos || '[]') }));
  if (statut === 'out') pieces = pieces.filter(p => p.quantite === 0);
  else if (statut === 'low') pieces = pieces.filter(p => p.quantite > 0 && p.quantite <= p.seuil_alerte);
  else if (statut === 'ok') pieces = pieces.filter(p => p.quantite > p.seuil_alerte);
  res.json(pieces);
});
router.get('/stats', async (req, res) => {
  const db = await getDb();
  const pieces = query(db, 'SELECT * FROM pieces').map(p => ({ ...p, motos: JSON.parse(p.motos || '[]') }));
  res.json({ total: pieces.length, valeur_stock: pieces.reduce((s, p) => s + p.prix_achat * p.quantite, 0), ruptures: pieces.filter(p => p.quantite === 0).length, stock_faible: pieces.filter(p => p.quantite > 0 && p.quantite <= p.seuil_alerte).length });
});
router.post('/', async (req, res) => {
  const db = await getDb();
  const { ref, nom, motos, categorie, prix_achat, prix_vente, quantite, seuil_alerte } = req.body;
  if (!ref || !nom) return res.status(400).json({ error: 'Référence et nom obligatoires' });
  const r = run(db, `INSERT INTO pieces (ref,nom,motos,categorie,prix_achat,prix_vente,quantite,seuil_alerte) VALUES (?,?,?,?,?,?,?,?)`, [ref, nom, JSON.stringify(motos || []), categorie || 'Autre', prix_achat || 0, prix_vente || 0, quantite || 0, seuil_alerte || 5]);
  save(db); res.json({ id: r.lastInsertRowid });
});
router.put('/:id', async (req, res) => {
  const db = await getDb();
  const { ref, nom, motos, categorie, prix_achat, prix_vente, quantite, seuil_alerte } = req.body;
  run(db, `UPDATE pieces SET ref=?,nom=?,motos=?,categorie=?,prix_achat=?,prix_vente=?,quantite=?,seuil_alerte=? WHERE id=?`, [ref, nom, JSON.stringify(motos || []), categorie || 'Autre', prix_achat || 0, prix_vente || 0, quantite || 0, seuil_alerte || 5, req.params.id]);
  save(db); res.json({ ok: true });
});
router.patch('/:id/quantite', async (req, res) => {
  const db = await getDb();
  run(db, 'UPDATE pieces SET quantite=? WHERE id=?', [req.body.quantite, req.params.id]);
  save(db); res.json({ ok: true });
});
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM pieces WHERE id=?', [req.params.id]);
  save(db); res.json({ ok: true });
});
module.exports = router;
