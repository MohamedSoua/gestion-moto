const express = require('express');
const router = express.Router();
const { getDb, query, run, save } = require('../db/database');

// ACHATS
router.get('/achats', async (req, res) => {
  const db = await getDb();
  const achats = query(db, 'SELECT * FROM achats ORDER BY date DESC');
  achats.forEach(a => { a.items = query(db, 'SELECT * FROM achat_items WHERE achat_id=?', [a.id]); });
  res.json(achats);
});
router.post('/achats', async (req, res) => {
  const db = await getDb();
  const { fournisseur_id, fournisseur_nom, items, notes } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Aucune pièce' });
  const total = items.reduce((s, i) => s + (i.prix_unitaire * i.quantite), 0);
  const r = run(db, `INSERT INTO achats (fournisseur_id,fournisseur_nom,total,notes) VALUES (?,?,?,?)`,
    [fournisseur_id || null, fournisseur_nom || 'Non précisé', total, notes || '']);
  items.forEach(i => run(db, `INSERT INTO achat_items (achat_id,piece_id,piece_nom,quantite,prix_unitaire,total) VALUES (?,?,?,?,?,?)`,
    [r.lastInsertRowid, i.piece_id || null, i.piece_nom, i.quantite, i.prix_unitaire, i.prix_unitaire * i.quantite]));
  save(db); res.json({ id: r.lastInsertRowid });
});
router.patch('/achats/:id/receptionner', async (req, res) => {
  const db = await getDb();
  const items = query(db, 'SELECT * FROM achat_items WHERE achat_id=?', [req.params.id]);
  items.forEach(i => { if (i.piece_id) run(db, 'UPDATE pieces SET quantite = quantite + ? WHERE id=?', [i.quantite, i.piece_id]); });
  run(db, "UPDATE achats SET statut='reçu' WHERE id=?", [req.params.id]);
  save(db); res.json({ ok: true });
});

// FOURNISSEURS
router.get('/fournisseurs', async (req, res) => {
  const db = await getDb();
  res.json(query(db, 'SELECT * FROM fournisseurs ORDER BY nom'));
});
router.post('/fournisseurs', async (req, res) => {
  const db = await getDb();
  const { nom, telephone, adresse, specialite, delai_livraison, notes } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom obligatoire' });
  const r = run(db, `INSERT INTO fournisseurs (nom,telephone,adresse,specialite,delai_livraison,notes) VALUES (?,?,?,?,?,?)`,
    [nom, telephone||'', adresse||'', specialite||'', delai_livraison||'', notes||'']);
  save(db); res.json({ id: r.lastInsertRowid });
});
router.put('/fournisseurs/:id', async (req, res) => {
  const db = await getDb();
  const { nom, telephone, adresse, specialite, delai_livraison, notes } = req.body;
  run(db, `UPDATE fournisseurs SET nom=?,telephone=?,adresse=?,specialite=?,delai_livraison=?,notes=? WHERE id=?`,
    [nom, telephone||'', adresse||'', specialite||'', delai_livraison||'', notes||'', req.params.id]);
  save(db); res.json({ ok: true });
});
router.delete('/fournisseurs/:id', async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM fournisseurs WHERE id=?', [req.params.id]);
  save(db); res.json({ ok: true });
});

// CLIENTS
router.get('/clients', async (req, res) => {
  const db = await getDb();
  res.json(query(db, 'SELECT * FROM clients ORDER BY nom'));
});
router.post('/clients', async (req, res) => {
  const db = await getDb();
  const { nom, telephone, moto, notes } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom obligatoire' });
  const r = run(db, `INSERT INTO clients (nom,telephone,moto,notes) VALUES (?,?,?,?)`, [nom, telephone||'', moto||'', notes||'']);
  save(db); res.json({ id: r.lastInsertRowid });
});
router.put('/clients/:id', async (req, res) => {
  const db = await getDb();
  const { nom, telephone, moto, notes } = req.body;
  run(db, `UPDATE clients SET nom=?,telephone=?,moto=?,notes=? WHERE id=?`, [nom, telephone||'', moto||'', notes||'', req.params.id]);
  save(db); res.json({ ok: true });
});
router.patch('/clients/:id/encaisser', async (req, res) => {
  const db = await getDb();
  run(db, 'UPDATE clients SET credit_du = MAX(0, credit_du - ?) WHERE id=?', [req.body.montant, req.params.id]);
  save(db); res.json({ ok: true });
});
router.delete('/clients/:id', async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM clients WHERE id=?', [req.params.id]);
  save(db); res.json({ ok: true });
});

// RAPPORTS
router.get('/rapports', async (req, res) => {
  const db = await getDb();
  const jours = parseInt(req.query.jours) || 30;
  const since = new Date(Date.now() - jours * 86400000).toISOString();
  const ventes = query(db, "SELECT * FROM ventes WHERE date >= ?", [since]);
  const items = query(db, "SELECT vi.*, v.date FROM vente_items vi JOIN ventes v ON vi.vente_id=v.id WHERE v.date >= ?", [since]);
  const ca = ventes.reduce((s, v) => s + v.total, 0);
  const creditsRow = query(db, "SELECT SUM(credit_du) as t FROM clients");
  const topMap = {};
  items.forEach(i => { topMap[i.piece_nom] = (topMap[i.piece_nom] || 0) + i.quantite; });
  const top_pieces = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([nom, qty]) => ({ nom, qty }));

  // Profit = CA - coût des pièces vendues
  const pieces = query(db, 'SELECT id, prix_achat FROM pieces');
  const prixAchat = {};
  pieces.forEach(p => { prixAchat[p.id] = p.prix_achat; });
  const cout_ventes = items.reduce((s, i) => s + (prixAchat[i.piece_id] || 0) * i.quantite, 0);
  const depenses = query(db, "SELECT SUM(montant) as t FROM depenses WHERE date >= ?", [since]);

  res.json({
    ca, nb_ventes: ventes.length, panier_moyen: ventes.length ? ca / ventes.length : 0,
    credits_en_attente: creditsRow[0]?.t || 0, top_pieces,
    cout_ventes, depenses_total: depenses[0]?.t || 0,
    profit_net: ca - cout_ventes - (depenses[0]?.t || 0)
  });
});

// CAISSE JOURNALIERE
router.get('/caisse', async (req, res) => {
  const db = await getDb();
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const ventes = query(db, "SELECT * FROM ventes WHERE date(date)=?", [date]);
  const items = query(db, "SELECT vi.* FROM vente_items vi JOIN ventes v ON vi.vente_id=v.id WHERE date(v.date)=?", [date]);
  const depenses = query(db, "SELECT * FROM depenses WHERE date=? ORDER BY created_at DESC", [date]);
  const pieces = query(db, 'SELECT id, prix_achat FROM pieces');

  const prixAchat = {};
  pieces.forEach(p => { prixAchat[p.id] = p.prix_achat; });

  const ca = ventes.reduce((s, v) => s + v.total, 0);
  const cout = items.reduce((s, i) => s + (prixAchat[i.piece_id] || 0) * i.quantite, 0);
  const total_depenses = depenses.reduce((s, d) => s + d.montant, 0);
  const profit_brut = ca - cout;
  const profit_net = profit_brut - total_depenses;

  res.json({ date, ca, nb_ventes: ventes.length, cout_pieces: cout, profit_brut, depenses, total_depenses, profit_net, ventes });
});

// DEPENSES
router.get('/depenses', async (req, res) => {
  const db = await getDb();
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  res.json(query(db, "SELECT * FROM depenses WHERE date=? ORDER BY created_at DESC", [date]));
});

router.post('/depenses', async (req, res) => {
  const db = await getDb();
  const { libelle, montant, categorie, date } = req.body;
  if (!libelle || !montant) return res.status(400).json({ error: 'Libellé et montant obligatoires' });
  const r = run(db, `INSERT INTO depenses (libelle, montant, categorie, date) VALUES (?,?,?,?)`,
    [libelle, montant, categorie || 'Autre', date || new Date().toISOString().slice(0, 10)]);
  save(db); res.json({ id: r.lastInsertRowid });
});

router.delete('/depenses/:id', async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM depenses WHERE id=?', [req.params.id]);
  save(db); res.json({ ok: true });
});

// HISTORIQUE CAISSE (liste des jours)
router.get('/caisse/historique', async (req, res) => {
  const db = await getDb();
  const jours = parseInt(req.query.jours) || 30;
  const since = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);

  const ventesParJour = query(db, `
    SELECT date(date) as jour, SUM(total) as ca, COUNT(*) as nb
    FROM ventes WHERE date(date) >= ? GROUP BY date(date) ORDER BY jour DESC`, [since]);

  const depensesParJour = query(db, `
    SELECT date, SUM(montant) as total FROM depenses
    WHERE date >= ? GROUP BY date`, [since]);

  const itemsParJour = query(db, `
    SELECT date(v.date) as jour, vi.piece_id, vi.quantite
    FROM vente_items vi JOIN ventes v ON vi.vente_id=v.id
    WHERE date(v.date) >= ?`, [since]);

  const pieces = query(db, 'SELECT id, prix_achat FROM pieces');
  const prixAchat = {};
  pieces.forEach(p => { prixAchat[p.id] = p.prix_achat; });

  const coutParJour = {};
  itemsParJour.forEach(i => {
    coutParJour[i.jour] = (coutParJour[i.jour] || 0) + (prixAchat[i.piece_id] || 0) * i.quantite;
  });

  const depMap = {};
  depensesParJour.forEach(d => { depMap[d.date] = d.total; });

  const result = ventesParJour.map(v => {
    const cout = coutParJour[v.jour] || 0;
    const dep = depMap[v.jour] || 0;
    return {
      jour: v.jour, ca: v.ca, nb_ventes: v.nb,
      cout_pieces: cout, depenses: dep,
      profit_brut: v.ca - cout,
      profit_net: v.ca - cout - dep
    };
  });

  res.json(result);
});

module.exports = router;
