// ===== UTILS =====
const dt = n => (parseFloat(n)||0).toFixed(3)+' DT';
const api = async (url, method='GET', body=null) => {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
};
const statusBadge = p => {
  if (p.quantite === 0) return '<span class="badge badge-out">Rupture</span>';
  if (p.quantite <= p.seuil_alerte) return '<span class="badge badge-low">Stock faible</span>';
  return '<span class="badge badge-ok">En stock</span>';
};
const esc = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ===== NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => showPage(el.dataset.page));
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  const renders = {dashboard:renderDashboard,stock:renderStock,ventes:renderVentes,historique:renderHistorique,achats:renderAchats,fournisseurs:renderFournisseurs,clients:renderClients,caisse:renderCaisse,rapports:renderRapports};
  if (renders[name]) renders[name]();
}

// ===== MODAL =====
function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
document.getElementById('modal-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });

function closeTicket() { document.getElementById('ticket-overlay').classList.remove('open'); }
document.getElementById('ticket-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeTicket(); });

function showTicket(v) {
  document.getElementById('ticket-body').innerHTML = `
    <div style="font-family:monospace;font-size:13px;line-height:1.9">
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:16px;font-weight:700">🏍️ PIÈCES MOTO</div>
        <div style="font-size:11px;color:#6b7280">${new Date(v.date).toLocaleString('fr-FR')}</div>
        <div style="font-size:11px">Vente #${String(v.id).padStart(6,'0')}</div>
        <div>Client: <strong>${esc(v.client_nom)}</strong></div>
      </div>
      <div style="border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:8px 0;margin:8px 0">
        ${(v.items||[]).map(i=>`<div style="display:flex;justify-content:space-between"><span>${esc(i.piece_nom)} ×${i.quantite}</span><span>${(i.prix_unitaire*i.quantite).toFixed(3)} DT</span></div>`).join('')}
      </div>
      ${v.remise>0?`<div style="display:flex;justify-content:space-between"><span>Remise (${v.remise}%)</span><span style="color:#991b1b">- ${(v.sous_total*v.remise/100).toFixed(3)} DT</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;margin-top:6px"><span>TOTAL</span><span>${dt(v.total)}</span></div>
      <div style="margin-top:8px;font-size:12px;color:#6b7280">Paiement: ${esc(v.mode_paiement)}</div>
      <div style="text-align:center;margin-top:14px;font-size:11px;color:#9ca3af">Merci pour votre confiance !</div>
    </div>`;
  document.getElementById('ticket-overlay').classList.add('open');
}

// ===== DASHBOARD =====
async function renderDashboard() {
  const el = document.getElementById('page-dashboard');
  const [stats, stockStats, ventes, caisseJour] = await Promise.all([
    api('/api/ventes/stats'),
    api('/api/pieces/stats'),
    api('/api/ventes?limit=5')
  ]);
  const alertes = await api('/api/pieces?statut=low');
  const ruptures = await api('/api/pieces?statut=out');
  const allAlertes = [...alertes, ...ruptures];

  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📊 Tableau de bord</div><div class="page-sub">${new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div></div>
      <button class="btn btn-primary" onclick="showPage('ventes')">+ Nouvelle vente</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">CA aujourd'hui</div><div class="stat-value green">${dt(stats.ca_jour)}</div></div>
      <div class="stat-card" style="border:1.5px solid #166534"><div class="stat-label">🎯 Profit net aujourd'hui</div><div class="stat-value green">${dt(stats.profit_net_jour)}</div></div>
      <div class="stat-card"><div class="stat-label">Ventes aujourd'hui</div><div class="stat-value blue">${stats.nb_ventes_jour}</div></div>
      <div class="stat-card"><div class="stat-label">CA ce mois</div><div class="stat-value">${dt(stats.ca_mois)}</div></div>
      <div class="stat-card"><div class="stat-label">Valeur du stock</div><div class="stat-value">${dt(stockStats.valeur_stock)}</div></div>
      <div class="stat-card"><div class="stat-label">Ruptures</div><div class="stat-value red">${stockStats.ruptures}</div></div>
      <div class="stat-card"><div class="stat-label">Crédits en attente</div><div class="stat-value orange">${dt(stats.credits_en_attente)}</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">⚠️ Alertes stock</span><a class="btn btn-sm" onclick="showPage('stock')">Voir tout</a></div>
        ${allAlertes.length ? allAlertes.slice(0,8).map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #f3f4f6;font-size:13px"><span>${esc(p.nom)}</span><span>${statusBadge(p)} <span style="color:#6b7280;margin-left:4px">${p.quantite} u.</span></span></div>`).join('') : '<div class="empty-state"><div class="icon">✅</div><p>Aucune alerte</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🕐 Dernières ventes</span><a class="btn btn-sm" onclick="showPage('historique')">Voir tout</a></div>
        ${ventes.length ? ventes.slice(0,6).map(v=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #f3f4f6;font-size:13px"><span>${new Date(v.date).toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})} — ${esc(v.client_nom)}</span><span style="font-weight:600;color:#166534">${dt(v.total)}</span></div>`).join('') : '<div class="empty-state"><div class="icon">🛒</div><p>Aucune vente</p></div>'}
      </div>
    </div>`;
}

// ===== STOCK =====
let stockFilters = {search:'',moto:'',cat:'',statut:''};
async function renderStock() {
  const el = document.getElementById('page-stock');
  const stats = await api('/api/pieces/stats');
  const params = new URLSearchParams(Object.fromEntries(Object.entries(stockFilters).filter(([,v])=>v)));
  const pieces = await api('/api/pieces?'+params);

  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📦 Stock & inventaire</div><div class="page-sub">Toutes les pièces de rechange</div></div>
      <button class="btn btn-primary" onclick="modalPiece()">+ Ajouter une pièce</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Références</div><div class="stat-value">${stats.total}</div></div>
      <div class="stat-card"><div class="stat-label">Valeur du stock</div><div class="stat-value blue">${dt(stats.valeur_stock)}</div></div>
      <div class="stat-card"><div class="stat-label">Stock faible</div><div class="stat-value orange">${stats.stock_faible}</div></div>
      <div class="stat-card"><div class="stat-label">Ruptures</div><div class="stat-value red">${stats.ruptures}</div></div>
    </div>
    <div class="toolbar">
      <div class="search-box" style="flex:2"><input type="text" placeholder="Rechercher par nom ou référence..." value="${stockFilters.search}" oninput="stockFilters.search=this.value;renderStock()"></div>
      <select style="width:140px" onchange="stockFilters.moto=this.value;renderStock()">
        <option value="">Tous modèles</option>
        ${['Overston','Forza','Booster','Altro','Yamaha','Honda','Suzuki'].map(m=>`<option ${stockFilters.moto===m?'selected':''}>${m}</option>`).join('')}
      </select>
      <select style="width:130px" onchange="stockFilters.cat=this.value;renderStock()">
        <option value="">Catégories</option>
        ${['Filtration','Freinage','Transmission','Moteur','Électricité','Carrosserie','Autre'].map(c=>`<option ${stockFilters.cat===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <select style="width:130px" onchange="stockFilters.statut=this.value;renderStock()">
        <option value="">Tout le stock</option>
        <option value="ok" ${stockFilters.statut==='ok'?'selected':''}>En stock</option>
        <option value="low" ${stockFilters.statut==='low'?'selected':''}>Stock faible</option>
        <option value="out" ${stockFilters.statut==='out'?'selected':''}>Rupture</option>
      </select>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Référence</th><th>Désignation</th><th>Modèle(s)</th><th>Catégorie</th><th>Prix achat</th><th>Prix vente</th><th>Qté</th><th>État</th><th class="actions-col"></th></tr></thead>
        <tbody>
          ${pieces.length ? pieces.map(p=>`
            <tr>
              <td><span class="ref">${esc(p.ref)}</span></td>
              <td style="font-weight:600">${esc(p.nom)}</td>
              <td>${p.motos.map(m=>`<span class="tag">${esc(m)}</span>`).join('')}</td>
              <td><span class="badge badge-gray">${esc(p.categorie)}</span></td>
              <td>${dt(p.prix_achat)}</td>
              <td style="font-weight:600;color:#1565a0">${dt(p.prix_vente)}</td>
              <td style="font-weight:700;font-size:16px">${p.quantite}</td>
              <td>${statusBadge(p)}</td>
              <td class="actions-col"><div style="display:flex;gap:4px">
                <button class="btn btn-xs" onclick='ajusterQty(${p.id},"${esc(p.nom)}",${p.quantite})'>+/- Qté</button>
                <button class="btn btn-xs" onclick='modalPiece(${JSON.stringify(p).replace(/'/g,"&#39;")})'>✏️</button>
                <button class="btn btn-xs btn-danger" onclick="deletePiece(${p.id})">🗑</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="9"><div class="empty-state"><div class="icon">📦</div><p>Aucune pièce trouvée</p></div></td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function pieceFormHtml(p={}) {
  const motos = ['Overston','Forza','Booster','Altro','Yamaha','Honda','Suzuki'];
  const cats = ['Filtration','Freinage','Transmission','Moteur','Électricité','Carrosserie','Autre'];
  const pm = Array.isArray(p.motos) ? p.motos : (p.motos ? JSON.parse(p.motos) : []);
  return `
    <div class="form-grid-2">
      <div class="form-row"><label>Référence *</label><input id="f-ref" value="${esc(p.ref||'')}" placeholder="OV-FLT-001"></div>
      <div class="form-row"><label>Désignation *</label><input id="f-nom" value="${esc(p.nom||'')}" placeholder="Filtre à air"></div>
    </div>
    <div class="form-row"><label>Modèles compatibles</label>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px">${motos.map(m=>`<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;font-weight:400"><input type="checkbox" value="${m}" ${pm.includes(m)?'checked':''}> ${m}</label>`).join('')}</div>
    </div>
    <div class="form-grid-2">
      <div class="form-row"><label>Prix achat (DT) *</label><input id="f-pachat" type="number" step="0.001" value="${p.prix_achat||''}"></div>
      <div class="form-row"><label>Prix vente (DT) *</label><input id="f-pvente" type="number" step="0.001" value="${p.prix_vente||''}"></div>
    </div>
    <div class="form-grid-2">
      <div class="form-row"><label>Quantité en stock</label><input id="f-qty" type="number" value="${p.quantite||0}"></div>
      <div class="form-row"><label>Seuil alerte</label><input id="f-seuil" type="number" value="${p.seuil_alerte||5}"></div>
    </div>
    <div class="form-row"><label>Catégorie</label>
      <select id="f-cat">${cats.map(c=>`<option ${p.categorie===c?'selected':''}>${c}</option>`).join('')}</select>
    </div>`;
}

function modalPiece(p) {
  const editing = p && p.id;
  openModal(editing ? 'Modifier la pièce' : 'Ajouter une pièce', pieceFormHtml(p||{}),
    `<button class="btn" onclick="closeModal()">Annuler</button>
     <button class="btn btn-primary" onclick="savePiece(${editing?p.id:'null'})">Enregistrer</button>`);
}

async function savePiece(id) {
  const ref = document.getElementById('f-ref').value.trim();
  const nom = document.getElementById('f-nom').value.trim();
  if (!ref||!nom) { alert('Référence et désignation obligatoires'); return; }
  const data = {
    ref, nom,
    motos: [...document.querySelectorAll('#modal-body input[type=checkbox]:checked')].map(c=>c.value),
    prix_achat: parseFloat(document.getElementById('f-pachat').value)||0,
    prix_vente: parseFloat(document.getElementById('f-pvente').value)||0,
    quantite: parseInt(document.getElementById('f-qty').value)||0,
    seuil_alerte: parseInt(document.getElementById('f-seuil').value)||5,
    categorie: document.getElementById('f-cat').value
  };
  if (id) await api('/api/pieces/'+id, 'PUT', data);
  else await api('/api/pieces', 'POST', data);
  closeModal(); renderStock();
}

async function ajusterQty(id, nom, current) {
  const q = prompt(`Quantité actuelle: ${current}\nNouvelle quantité pour "${nom}":`);
  if (q===null||q==='') return;
  const n = parseInt(q);
  if (isNaN(n)||n<0) { alert('Quantité invalide'); return; }
  await api('/api/pieces/'+id+'/quantite', 'PATCH', {quantite:n});
  renderStock();
}

async function deletePiece(id) {
  if (!confirm('Supprimer cette pièce définitivement ?')) return;
  await api('/api/pieces/'+id, 'DELETE');
  renderStock();
}

// ===== VENTES (POS) =====
let cart = [];
async function renderVentes() {
  const el = document.getElementById('page-ventes');
  const [pieces, clients] = await Promise.all([api('/api/pieces'), api('/api/clients')]);
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🛒 Nouvelle vente</div></div>
      <select id="vente-client" style="width:200px">
        <option value="">Client anonyme</option>
        ${clients.map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join('')}
      </select>
    </div>
    <div class="pos-layout">
      <div>
        <div class="toolbar">
          <div class="search-box" style="flex:1"><input type="text" id="pos-search" placeholder="Chercher une pièce..." oninput="filterPosPieces()"></div>
          <select id="pos-moto" style="width:140px" onchange="filterPosPieces()">
            <option value="">Tous modèles</option>
            ${[...new Set(pieces.flatMap(p=>p.motos))].sort().map(m=>`<option>${m}</option>`).join('')}
          </select>
        </div>
        <div class="card">
          <table>
            <thead><tr><th>Référence</th><th>Désignation</th><th>Modèle(s)</th><th>Prix vente</th><th>Stock</th><th></th></tr></thead>
            <tbody id="pos-tbody">
              ${pieces.map(p=>`
                <tr class="pos-row" data-nom="${esc(p.nom).toLowerCase()}" data-ref="${esc(p.ref).toLowerCase()}" data-motos="${esc(JSON.stringify(p.motos)).toLowerCase()}">
                  <td><span class="ref">${esc(p.ref)}</span></td>
                  <td style="font-weight:600">${esc(p.nom)}</td>
                  <td>${p.motos.map(m=>`<span class="tag">${esc(m)}</span>`).join('')}</td>
                  <td style="font-weight:600;color:#1565a0">${dt(p.prix_vente)}</td>
                  <td>${statusBadge(p)}</td>
                  <td><button class="btn btn-sm btn-primary" onclick='addToCart(${JSON.stringify(p).replace(/'/g,"&#39;")})' ${p.quantite===0?'disabled':''}>Ajouter</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="pos-cart">
        <div class="cart-header">🛒 Panier</div>
        <div id="cart-items"></div>
        <div id="cart-total-section" class="cart-total-section"></div>
        <div style="padding:12px 16px">
          <div class="form-row" style="margin-bottom:10px"><label>Remise globale (%)</label><input type="number" id="remise" value="0" min="0" max="100" oninput="renderCart()"></div>
          <div class="form-row" style="margin-bottom:12px"><label>Mode de paiement</label>
            <select id="paiement-mode"><option>Espèces</option><option>Chèque</option><option>Virement</option><option>Crédit</option></select>
          </div>
          <button class="btn btn-success" style="width:100%;justify-content:center;font-size:14px;padding:11px" onclick="validerVente()">✅ Valider la vente</button>
          <button class="btn" style="width:100%;justify-content:center;margin-top:6px" onclick="viderPanier()">🗑 Vider le panier</button>
        </div>
      </div>
    </div>`;
  renderCart();
}

function filterPosPieces() {
  const q = (document.getElementById('pos-search').value||'').toLowerCase();
  const moto = (document.getElementById('pos-moto').value||'').toLowerCase();
  document.querySelectorAll('.pos-row').forEach(row => {
    const matchQ = !q || row.dataset.nom.includes(q) || row.dataset.ref.includes(q);
    const matchM = !moto || row.dataset.motos.includes(moto);
    row.style.display = (matchQ && matchM) ? '' : 'none';
  });
}

function addToCart(p) {
  const existing = cart.find(c=>c.id===p.id);
  if (existing) { if (existing.qty >= p.quantite) { alert('Stock insuffisant'); return; } existing.qty++; }
  else cart.push({...p, qty:1});
  renderCart();
}

function renderCart() {
  const remise = parseFloat(document.getElementById('remise')?.value)||0;
  const cartEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total-section');
  if (!cartEl) return;
  if (!cart.length) { cartEl.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">Panier vide</div>'; totalEl.innerHTML=''; return; }
  cartEl.innerHTML = cart.map((c,i)=>`
    <div class="cart-item">
      <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nom)}</div><div style="font-size:11px;color:#6b7280">${dt(c.prix_vente)} / u.</div></div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
        <span style="font-weight:600;min-width:20px;text-align:center">${c.qty}</span>
        <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
        <button class="qty-btn" onclick="removeCart(${i})" style="color:#991b1b;margin-left:2px">✕</button>
      </div>
    </div>`).join('');
  const sous = cart.reduce((s,c)=>s+c.prix_vente*c.qty,0);
  const disc = sous*remise/100;
  const total = sous-disc;
  totalEl.innerHTML = `
    <div class="total-row"><span>Sous-total</span><span>${dt(sous)}</span></div>
    ${remise>0?`<div class="total-row" style="color:#991b1b"><span>Remise (${remise}%)</span><span>- ${dt(disc)}</span></div>`:''}
    <div class="total-row final"><span>TOTAL</span><span>${dt(total)}</span></div>`;
}

function changeQty(i,d) {
  cart[i].qty+=d;
  if (cart[i].qty<=0) cart.splice(i,1);
  else if (cart[i].qty>cart[i].quantite) { cart[i].qty=cart[i].quantite; alert('Stock max atteint'); }
  renderCart();
}
function removeCart(i) { cart.splice(i,1); renderCart(); }
function viderPanier() { cart=[]; renderCart(); }

async function validerVente() {
  if (!cart.length) { alert('Le panier est vide.'); return; }
  const remise = parseFloat(document.getElementById('remise').value)||0;
  const mode = document.getElementById('paiement-mode').value;
  const clientId = document.getElementById('vente-client').value;
  const clientNom = clientId ? document.querySelector(`#vente-client option[value="${clientId}"]`)?.textContent : 'Anonyme';
  const items = cart.map(c=>({piece_id:c.id,piece_ref:c.ref,piece_nom:c.nom,prix_unitaire:c.prix_vente,quantite:c.qty}));
  const result = await api('/api/ventes','POST',{client_id:clientId||null,client_nom:clientNom,items,remise,mode_paiement:mode});
  if (result.error) { alert(result.error); return; }
  const vente = {id:result.id,date:new Date().toISOString(),client_nom:clientNom,items,remise,sous_total:cart.reduce((s,c)=>s+c.prix_vente*c.qty,0),total:result.total,mode_paiement:mode};
  cart=[];
  showTicket(vente);
  renderVentes();
}

// ===== HISTORIQUE =====
async function renderHistorique() {
  const el = document.getElementById('page-historique');
  const dateVal = el._dateFilter || '';
  const ventes = await api('/api/ventes'+(dateVal?'?date='+dateVal:''));
  const ca = ventes.reduce((s,v)=>s+v.total,0);
  const credits = ventes.filter(v=>v.statut==='crédit').reduce((s,v)=>s+v.total,0);
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📋 Historique des ventes</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="date" id="histo-date" value="${dateVal}" style="width:160px" oninput="document.getElementById('page-historique')._dateFilter=this.value;renderHistorique()">
        <button class="btn" onclick="document.getElementById('page-historique')._dateFilter='';renderHistorique()">Tout</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Nb ventes</div><div class="stat-value">${ventes.length}</div></div>
      <div class="stat-card"><div class="stat-label">Chiffre d'affaires</div><div class="stat-value green">${dt(ca)}</div></div>
      <div class="stat-card"><div class="stat-label">En crédit</div><div class="stat-value orange">${dt(credits)}</div></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Client</th><th>Articles</th><th>Montant</th><th>Paiement</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${ventes.length ? ventes.map(v=>`
            <tr>
              <td><span class="ref">#${String(v.id).padStart(6,'0')}</span></td>
              <td>${new Date(v.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
              <td>${esc(v.client_nom)}</td>
              <td style="font-size:12px;color:#6b7280">${(v.items||[]).map(i=>esc(i.piece_nom)+'×'+i.quantite).join(', ')}</td>
              <td style="font-weight:700;color:#166534">${dt(v.total)}</td>
              <td>${esc(v.mode_paiement)}</td>
              <td>${v.statut==='crédit'?'<span class="badge badge-low">Crédit</span>':'<span class="badge badge-ok">Payé</span>'}</td>
              <td><button class="btn btn-xs" onclick='showTicket(${JSON.stringify(v).replace(/'/g,"&#39;")})'>🧾</button></td>
            </tr>`).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="icon">📋</div><p>Aucune vente</p></div></td></tr>'}
        </tbody>
      </table>
    </div>`;
}

// ===== ACHATS =====
async function renderAchats() {
  const el = document.getElementById('page-achats');
  const achats = await api('/api/achats');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🚚 Achats & réceptions</div></div>
      <button class="btn btn-primary" onclick="modalAchat()">+ Nouvel achat</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Fournisseur</th><th>Pièces</th><th>Total</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${achats.length ? achats.map(a=>`
            <tr>
              <td><span class="ref">#${String(a.id).padStart(5,'0')}</span></td>
              <td>${new Date(a.date).toLocaleDateString('fr-FR')}</td>
              <td>${esc(a.fournisseur_nom)}</td>
              <td style="font-size:12px;color:#6b7280">${(a.items||[]).map(i=>esc(i.piece_nom)+'×'+i.quantite).join(', ')}</td>
              <td style="font-weight:700">${dt(a.total)}</td>
              <td>${a.statut==='reçu'?'<span class="badge badge-ok">Reçu</span>':'<span class="badge badge-blue">Commandé</span>'}</td>
              <td>${a.statut==='commandé'?`<button class="btn btn-xs btn-success" onclick="receptionnerAchat(${a.id})">✅ Réceptionner</button>`:''}</td>
            </tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="icon">🚚</div><p>Aucun achat</p></div></td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function modalAchat() {
  const [pieces, fournisseurs] = await Promise.all([api('/api/pieces'), api('/api/fournisseurs')]);
  window._achatLignes = [{piece_id:'',piece_nom:'',quantite:1,prix_unitaire:0}];
  const renderLignes = () => {
    document.getElementById('achat-lignes').innerHTML = window._achatLignes.map((l,i)=>`
      <div style="display:grid;grid-template-columns:1fr 70px 90px 28px;gap:6px;margin-bottom:6px;align-items:center">
        <select onchange="window._achatLignes[${i}].piece_id=this.value;const p=window._achatLignesData.find(x=>x.id==this.value);if(p){window._achatLignes[${i}].piece_nom=p.nom;window._achatLignes[${i}].prix_unitaire=p.prix_achat;this.closest('div').querySelector('input:last-of-type').value=p.prix_achat}">
          <option value="">— Pièce —</option>${pieces.map(p=>`<option value="${p.id}" ${l.piece_id==p.id?'selected':''}>${esc(p.nom)}</option>`).join('')}
        </select>
        <input type="number" value="${l.quantite}" min="1" placeholder="Qté" oninput="window._achatLignes[${i}].quantite=parseInt(this.value)||1">
        <input type="number" value="${l.prix_unitaire}" step="0.001" placeholder="P.U (DT)" oninput="window._achatLignes[${i}].prix_unitaire=parseFloat(this.value)||0">
        <button class="btn btn-xs btn-danger" onclick="window._achatLignes.splice(${i},1);(${renderLignes.toString()})()">✕</button>
      </div>`).join('')+`<button class="btn btn-sm" onclick="window._achatLignes.push({piece_id:'',piece_nom:'',quantite:1,prix_unitaire:0});(${renderLignes.toString()})()">+ Ligne</button>`;
  };
  window._achatLignesData = pieces;
  openModal('Nouvel achat',`
    <div class="form-grid-2">
      <div class="form-row"><label>Date</label><input id="a-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-row"><label>Fournisseur</label><select id="a-fourn"><option value="">— Choisir —</option>${fournisseurs.map(f=>`<option value="${f.id}" data-nom="${esc(f.nom)}">${esc(f.nom)}</option>`).join('')}<option value="autre">Autre</option></select></div>
    </div>
    <div class="form-row"><label>Pièces achetées</label><div id="achat-lignes"></div></div>`,
    `<button class="btn" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveAchat()">Enregistrer</button>`);
  renderLignes();
}

async function saveAchat() {
  const items = window._achatLignes.filter(l=>l.piece_id);
  if (!items.length) { alert('Ajoutez au moins une pièce.'); return; }
  const sel = document.getElementById('a-fourn');
  const fournisseurId = sel.value;
  const fournisseurNom = fournisseurId && fournisseurId!=='autre' ? sel.options[sel.selectedIndex].dataset.nom : 'Non précisé';
  await api('/api/achats','POST',{fournisseur_id:fournisseurId&&fournisseurId!=='autre'?fournisseurId:null,fournisseur_nom:fournisseurNom,items});
  closeModal(); renderAchats();
}

async function receptionnerAchat(id) {
  if (!confirm('Confirmer la réception ? Le stock sera mis à jour.')) return;
  await api('/api/achats/'+id+'/receptionner','PATCH');
  renderAchats();
}

// ===== FOURNISSEURS =====
async function renderFournisseurs() {
  const el = document.getElementById('page-fournisseurs');
  const fournisseurs = await api('/api/fournisseurs');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🏭 Fournisseurs</div></div>
      <button class="btn btn-primary" onclick="modalFournisseur()">+ Ajouter</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Nom</th><th>Téléphone</th><th>Adresse</th><th>Spécialité</th><th>Délai moyen</th><th></th></tr></thead>
        <tbody>
          ${fournisseurs.length ? fournisseurs.map(f=>`
            <tr>
              <td style="font-weight:600">${esc(f.nom)}</td>
              <td>${esc(f.telephone)}</td><td>${esc(f.adresse)}</td><td>${esc(f.specialite)}</td><td>${esc(f.delai_livraison)}</td>
              <td><div style="display:flex;gap:4px">
                <button class="btn btn-xs" onclick='modalFournisseur(${JSON.stringify(f).replace(/'/g,"&#39;")})'>✏️</button>
                <button class="btn btn-xs btn-danger" onclick="deleteFournisseur(${f.id})">🗑</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="icon">🏭</div><p>Aucun fournisseur</p></div></td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function modalFournisseur(f={}) {
  openModal(f.id?'Modifier le fournisseur':'Ajouter un fournisseur',`
    <div class="form-grid-2">
      <div class="form-row"><label>Nom *</label><input id="fo-nom" value="${esc(f.nom||'')}"></div>
      <div class="form-row"><label>Téléphone</label><input id="fo-tel" value="${esc(f.telephone||'')}"></div>
    </div>
    <div class="form-grid-2">
      <div class="form-row"><label>Adresse</label><input id="fo-adr" value="${esc(f.adresse||'')}"></div>
      <div class="form-row"><label>Délai livraison</label><input id="fo-delai" value="${esc(f.delai_livraison||'')}"></div>
    </div>
    <div class="form-row"><label>Spécialité</label><input id="fo-spec" value="${esc(f.specialite||'')}"></div>`,
    `<button class="btn" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveFournisseur(${f.id||'null'})">Enregistrer</button>`);
}

async function saveFournisseur(id) {
  const nom = document.getElementById('fo-nom').value.trim();
  if (!nom) { alert('Nom obligatoire'); return; }
  const data = {nom,telephone:document.getElementById('fo-tel').value,adresse:document.getElementById('fo-adr').value,specialite:document.getElementById('fo-spec').value,delai_livraison:document.getElementById('fo-delai').value};
  if (id) await api('/api/fournisseurs/'+id,'PUT',data);
  else await api('/api/fournisseurs','POST',data);
  closeModal(); renderFournisseurs();
}

async function deleteFournisseur(id) {
  if (!confirm('Supprimer ce fournisseur ?')) return;
  await api('/api/fournisseurs/'+id,'DELETE');
  renderFournisseurs();
}

// ===== CLIENTS =====
async function renderClients() {
  const el = document.getElementById('page-clients');
  const clients = await api('/api/clients');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">👥 Clients</div></div>
      <button class="btn btn-primary" onclick="modalClient()">+ Ajouter</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Nom</th><th>Téléphone</th><th>Moto</th><th>Crédit dû</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${clients.length ? clients.map(c=>`
            <tr>
              <td style="font-weight:600">${esc(c.nom)}</td>
              <td>${esc(c.telephone)}</td><td>${esc(c.moto)||'—'}</td>
              <td style="font-weight:600;color:${c.credit_du>0?'#991b1b':'#166534'}">${dt(c.credit_du)}</td>
              <td style="font-size:12px;color:#6b7280">${esc(c.notes)||'—'}</td>
              <td><div style="display:flex;gap:4px">
                ${c.credit_du>0?`<button class="btn btn-xs btn-success" onclick="encaisserCredit(${c.id},${c.credit_du})">💰 Encaisser</button>`:''}
                <button class="btn btn-xs" onclick='modalClient(${JSON.stringify(c).replace(/'/g,"&#39;")})'>✏️</button>
                <button class="btn btn-xs btn-danger" onclick="deleteClient(${c.id})">🗑</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="icon">👥</div><p>Aucun client</p></div></td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function modalClient(c={}) {
  openModal(c.id?'Modifier le client':'Ajouter un client',`
    <div class="form-grid-2">
      <div class="form-row"><label>Nom *</label><input id="cl-nom" value="${esc(c.nom||'')}"></div>
      <div class="form-row"><label>Téléphone</label><input id="cl-tel" value="${esc(c.telephone||'')}"></div>
    </div>
    <div class="form-row"><label>Modèle de moto</label><input id="cl-moto" value="${esc(c.moto||'')}"></div>
    <div class="form-row"><label>Notes</label><textarea id="cl-notes" rows="2">${esc(c.notes||'')}</textarea></div>`,
    `<button class="btn" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveClient(${c.id||'null'})">Enregistrer</button>`);
}

async function saveClient(id) {
  const nom = document.getElementById('cl-nom').value.trim();
  if (!nom) { alert('Nom obligatoire'); return; }
  const data = {nom,telephone:document.getElementById('cl-tel').value,moto:document.getElementById('cl-moto').value,notes:document.getElementById('cl-notes').value};
  if (id) await api('/api/clients/'+id,'PUT',data);
  else await api('/api/clients','POST',data);
  closeModal(); renderClients();
}

async function encaisserCredit(id, creditDu) {
  const m = parseFloat(prompt(`Crédit dû: ${dt(creditDu)}\nMontant encaissé (DT):`));
  if (isNaN(m)||m<=0) return;
  await api('/api/clients/'+id+'/encaisser','PATCH',{montant:m});
  renderClients();
}

async function deleteClient(id) {
  if (!confirm('Supprimer ce client ?')) return;
  await api('/api/clients/'+id,'DELETE');
  renderClients();
}

// ===== RAPPORTS =====
async function renderRapports() {
  const el = document.getElementById('page-rapports');
  const jours = el._jours || 30;
  const data = await api('/api/rapports?jours='+jours);
  const credits = await api('/api/clients');
  const clientsCredit = credits.filter(c=>c.credit_du>0);
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📈 Rapports & statistiques</div></div>
      <select style="width:160px" onchange="document.getElementById('page-rapports')._jours=this.value;renderRapports()">
        <option value="7" ${jours==7?'selected':''}>7 derniers jours</option>
        <option value="30" ${jours==30?'selected':''}>30 derniers jours</option>
        <option value="90" ${jours==90?'selected':''}>3 derniers mois</option>
        <option value="365" ${jours==365?'selected':''}>Cette année</option>
      </select>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">CA (période)</div><div class="stat-value green">${dt(data.ca)}</div></div>
      <div class="stat-card"><div class="stat-label">Nb ventes</div><div class="stat-value blue">${data.nb_ventes}</div></div>
      <div class="stat-card"><div class="stat-label">Panier moyen</div><div class="stat-value">${dt(data.panier_moyen)}</div></div>
      <div class="stat-card"><div class="stat-label">Crédits en attente</div><div class="stat-value orange">${dt(data.credits_en_attente)}</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">🏆 Top 10 pièces vendues</span></div>
        ${data.top_pieces.length ? data.top_pieces.map((p,i)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #f3f4f6;font-size:13px">
            <span><strong style="color:#6b7280;margin-right:6px">#${i+1}</strong>${esc(p.nom)}</span>
            <span class="badge badge-blue">${p.qty} vendus</span>
          </div>`).join('') : '<div class="empty-state"><div class="icon">📦</div><p>Aucune vente sur cette période</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">💰 Crédits en attente</span></div>
        ${clientsCredit.length ? clientsCredit.map(c=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #f3f4f6;font-size:13px">
            <div><div style="font-weight:600">${esc(c.nom)}</div><div style="font-size:11px;color:#6b7280">${esc(c.telephone)}</div></div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;color:#991b1b">${dt(c.credit_du)}</span>
              <button class="btn btn-xs btn-success" onclick="encaisserCredit(${c.id},${c.credit_du});setTimeout(renderRapports,500)">💰</button>
            </div>
          </div>`).join('') : '<div class="empty-state"><div class="icon">💰</div><p>Aucun crédit en attente</p></div>'}
      </div>
    </div>`;
}

// ===== INIT =====
renderDashboard();

// ===== CAISSE JOURNALIERE =====
async function renderCaisse() {
  const el = document.getElementById('page-caisse');
  const today = new Date().toISOString().slice(0, 10);
  const date = el._date || today;
  const data = await api('/api/caisse?date=' + date);
  const hist = await api('/api/caisse/historique?jours=30');

  const profitColor = data.profit_net >= 0 ? 'green' : 'red';

  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">💰 Caisse journalière</div><div class="page-sub">Recettes, dépenses et profit net</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="date" value="${date}" style="width:160px" onchange="document.getElementById('page-caisse')._date=this.value;renderCaisse()">
        <button class="btn" onclick="document.getElementById('page-caisse')._date='${today}';renderCaisse()">Aujourd'hui</button>
        <button class="btn btn-primary" onclick="modalDepense('${date}')">+ Ajouter dépense</button>
      </div>
    </div>

    <!-- KPI du jour -->
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat-card">
        <div class="stat-label">CA du jour</div>
        <div class="stat-value blue">${dt(data.ca)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">${data.nb_ventes} vente(s)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Coût des pièces vendues</div>
        <div class="stat-value" style="color:#6b7280">- ${dt(data.cout_pieces)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profit brut</div>
        <div class="stat-value ${data.profit_brut >= 0 ? 'green' : 'red'}">${dt(data.profit_brut)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dépenses</div>
        <div class="stat-value orange">- ${dt(data.total_depenses)}</div>
      </div>
      <div class="stat-card" style="border:2px solid ${data.profit_net >= 0 ? '#166534' : '#991b1b'}">
        <div class="stat-label">🎯 Profit net</div>
        <div class="stat-value ${profitColor}" style="font-size:26px">${dt(data.profit_net)}</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Dépenses du jour -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">💸 Dépenses du jour</span>
          <button class="btn btn-sm btn-primary" onclick="modalDepense('${date}')">+ Ajouter</button>
        </div>
        ${data.depenses.length ? `
          <table>
            <thead><tr><th>Libellé</th><th>Catégorie</th><th>Montant</th><th></th></tr></thead>
            <tbody>
              ${data.depenses.map(d => `
                <tr>
                  <td style="font-weight:500">${esc(d.libelle)}</td>
                  <td><span class="badge badge-gray">${esc(d.categorie)}</span></td>
                  <td style="font-weight:600;color:#991b1b">${dt(d.montant)}</td>
                  <td><button class="btn btn-xs btn-danger" onclick="deleteDepense(${d.id})">🗑</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div style="padding:10px 14px;background:#fef3c7;font-size:13px;font-weight:600;display:flex;justify-content:space-between">
            <span>Total dépenses</span><span style="color:#92400e">${dt(data.total_depenses)}</span>
          </div>` :
          '<div class="empty-state"><div class="icon">💸</div><p>Aucune dépense ce jour</p></div>'
        }
      </div>

      <!-- Ventes du jour -->
      <div class="card">
        <div class="card-header"><span class="card-title">🛒 Ventes du jour</span></div>
        ${data.ventes.length ? `
          <table>
            <thead><tr><th>Heure</th><th>Client</th><th>Paiement</th><th>Montant</th></tr></thead>
            <tbody>
              ${data.ventes.map(v => `
                <tr>
                  <td style="color:#6b7280">${new Date(v.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td>${esc(v.client_nom)}</td>
                  <td><span class="badge badge-gray">${esc(v.mode_paiement)}</span></td>
                  <td style="font-weight:600;color:#166534">${dt(v.total)}</td>
                </tr>`).join('')}
            </tbody>
          </table>` :
          '<div class="empty-state"><div class="icon">🛒</div><p>Aucune vente ce jour</p></div>'
        }
      </div>
    </div>

    <!-- Historique 30 jours -->
    <div class="card">
      <div class="card-header"><span class="card-title">📅 Historique — 30 derniers jours</span></div>
      <table>
        <thead><tr><th>Date</th><th>Ventes</th><th>CA</th><th>Coût pièces</th><th>Dépenses</th><th>Profit brut</th><th>Profit net</th></tr></thead>
        <tbody>
          ${hist.length ? hist.map(h => `
            <tr style="cursor:pointer" onclick="document.getElementById('page-caisse')._date='${h.jour}';renderCaisse()">
              <td style="font-weight:500">${new Date(h.jour+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'})}</td>
              <td>${h.nb_ventes}</td>
              <td style="color:#1565a0;font-weight:600">${dt(h.ca)}</td>
              <td style="color:#6b7280">- ${dt(h.cout_pieces)}</td>
              <td style="color:#b45309">- ${dt(h.depenses)}</td>
              <td style="font-weight:600;color:${h.profit_brut>=0?'#166534':'#991b1b'}">${dt(h.profit_brut)}</td>
              <td><span class="badge ${h.profit_net>=0?'badge-ok':'badge-out'}" style="font-size:12px">${dt(h.profit_net)}</span></td>
            </tr>`).join('') :
            '<tr><td colspan="7"><div class="empty-state"><div class="icon">📅</div><p>Aucun historique</p></div></td></tr>'
          }
        </tbody>
      </table>
    </div>`;
}

function modalDepense(date) {
  const cats = ['Loyer','Électricité','Transport','Salaire','Fournitures','Téléphone','Autre'];
  openModal('Ajouter une dépense', `
    <div class="form-row"><label>Libellé *</label><input id="dep-lib" placeholder="ex: Loyer du mois, Électricité..."></div>
    <div class="form-grid-2">
      <div class="form-row"><label>Montant (DT) *</label><input id="dep-montant" type="number" step="0.001" placeholder="0.000"></div>
      <div class="form-row"><label>Catégorie</label>
        <select id="dep-cat">${cats.map(c=>`<option>${c}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row"><label>Date</label><input id="dep-date" type="date" value="${date}"></div>`,
    `<button class="btn" onclick="closeModal()">Annuler</button>
     <button class="btn btn-primary" onclick="saveDepense()">Enregistrer</button>`);
}

async function saveDepense() {
  const libelle = document.getElementById('dep-lib').value.trim();
  const montant = parseFloat(document.getElementById('dep-montant').value);
  if (!libelle || !montant) { alert('Libellé et montant obligatoires'); return; }
  await api('/api/depenses', 'POST', {
    libelle, montant,
    categorie: document.getElementById('dep-cat').value,
    date: document.getElementById('dep-date').value
  });
  closeModal(); renderCaisse();
}

async function deleteDepense(id) {
  if (!confirm('Supprimer cette dépense ?')) return;
  await api('/api/depenses/' + id, 'DELETE');
  renderCaisse();
}
