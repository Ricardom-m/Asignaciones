// ═══════════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════════
const SK = 'asgn_records_v2';
const PK = 'asgn_persons_v1';
const PEND = 'asgn_pending';
const SYNC_LAST_KEY    = 'asgn_last_sync';
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
let   autoSyncTimer    = null;

function getLastSync() { return parseInt(localStorage.getItem(SYNC_LAST_KEY) || '0'); }
function setLastSync() { localStorage.setItem(SYNC_LAST_KEY, Date.now().toString()); }

const getRecords = () => { try { return JSON.parse(localStorage.getItem(SK)) || []; } catch(e) { return []; } };
const getPersons = () => { try { return JSON.parse(localStorage.getItem(PK)) || []; } catch(e) { return []; } };
const getPending = () => localStorage.getItem(PEND) === 'true';

function saveRecords(d) { localStorage.setItem(SK, JSON.stringify(d)); markPending(); updateTotalCount(); }
function savePersons(d) { localStorage.setItem(PK, JSON.stringify(d)); markPending(); }
function markPending()  { localStorage.setItem(PEND, 'true'); updateStatusBar(); tryAutoSync(); }
function clearPending() { localStorage.setItem(PEND, 'false'); updateStatusBar(); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
const esc = s => !s ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = iso => { if(!iso) return '—'; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}); };
const fmtDT = ts => { if(!ts) return '—'; const d=new Date(ts); return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); };
function updateTotalCount() { document.getElementById('total-count').textContent = getRecords().length; }

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  btn.classList.add('active');
  closeSel();
  if (name === 'list')    { buildSortedData(); renderVList(); }
  if (name === 'persons') renderPersons();
}

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
let toastT;
function showToast(msg, type='') {
  clearTimeout(toastT);
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast '+type+' show';
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// ═══════════════════════════════════════════
//  SEARCHABLE SELECT
// ═══════════════════════════════════════════
let activeSel = null;

function openSel(key) {
  const trigId   = 'trig-'+key;
  const textId   = 'text-'+key;
  const hiddenId = 'val-'+key;
  if (activeSel && activeSel.key === key) { closeSel(); return; }
  closeSel();
  activeSel = { key, trigId, textId, hiddenId };

  const trig = document.getElementById(trigId);
  trig.classList.add('open');

  const dd   = document.getElementById('sel-dropdown');
  const rect = trig.getBoundingClientRect();
  dd.style.width = rect.width + 'px';
  dd.style.left  = rect.left  + 'px';
  dd.style.maxWidth = '520px';
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow > 260) { dd.style.top = (rect.bottom+3)+'px'; dd.style.bottom='auto'; }
  else                  { dd.style.bottom=(window.innerHeight-rect.top+3)+'px'; dd.style.top='auto'; }

  document.getElementById('sel-search').value = '';
  renderSelOpts('');
  dd.classList.add('open');
  setTimeout(() => document.getElementById('sel-search').focus(), 50);
}

function closeSel() {
  if (!activeSel) return;
  document.getElementById(activeSel.trigId)?.classList.remove('open');
  document.getElementById('sel-dropdown').classList.remove('open');
  activeSel = null;
}

function filterSelOpts() { renderSelOpts(document.getElementById('sel-search').value); }

function renderSelOpts(q) {
  if (!activeSel) return;
  const persons = getPersons().slice().sort((a,b) => a.nombre.localeCompare(b.nombre));
  const curVal  = document.getElementById(activeSel.hiddenId)?.value || '';
  const q2      = q.toLowerCase().trim();
  const filtered = q2 ? persons.filter(p => (p.nombre+' '+p.apellido).toLowerCase().includes(q2)) : persons;
  const opts    = document.getElementById('sel-options');

  let html = '';
  if (curVal) html += `<div class="sel-opt clear-opt" onclick="selectSelOpt('','')">✕ Quitar selección</div>`;
  if (!filtered.length) html += `<div class="sel-opt empty-opt">Sin personas registradas</div>`;
  else filtered.forEach(p => {
    const full = p.nombre+' '+p.apellido;
    html += `<div class="sel-opt${curVal===p.id?' selected':''}" onclick="selectSelOpt('${esc(p.id)}','${esc(full)}')">${esc(full)}</div>`;
  });
  opts.innerHTML = html;
}

function selectSelOpt(id, label) {
  if (!activeSel) return;
  document.getElementById(activeSel.hiddenId).value = id;
  const el = document.getElementById(activeSel.textId);
  el.textContent = label || 'Seleccionar…';
  el.classList.toggle('ph', !label);
  const key = activeSel.key;
  closeSel();
  if (key === 'spotlight') renderSpotlight(id);
}

document.addEventListener('click', e => {
  if (!activeSel) return;
  const dd   = document.getElementById('sel-dropdown');
  const trig = document.getElementById(activeSel.trigId);
  if (!dd?.contains(e.target) && !trig?.contains(e.target)) closeSel();
}, true);

// ═══════════════════════════════════════════
//  PERSONS
// ═══════════════════════════════════════════
function savePerson() {
  const nombre   = document.getElementById('p-nombre').value.trim();
  const apellido = document.getElementById('p-apellido').value.trim();
  if (!nombre)   { showToast('⚠️ El nombre es obligatorio','error'); return; }
  if (!apellido) { showToast('⚠️ El apellido es obligatorio','error'); return; }
  const persons = getPersons();
  persons.push({ id:uid(), nombre, apellido, createdAt:Date.now() });
  savePersons(persons);
  document.getElementById('p-nombre').value = '';
  document.getElementById('p-apellido').value = '';
  renderPersons();
  showToast('✅ Persona agregada','success');
  const firstRow = document.querySelector('.person-row');
  if(firstRow){ firstRow.classList.add('anim-slide'); setTimeout(()=>firstRow.classList.remove('anim-slide'),400); }
}

const PERSONS_PAGE = 30;
let personsRendered = 0;
let filteredPersons = [];

function renderPersons() {
  const q = (document.getElementById('persons-search')?.value || '').toLowerCase().trim();
  const all = getPersons().slice().sort((a,b) => a.nombre.localeCompare(b.nombre));
  filteredPersons = q ? all.filter(p => (p.nombre+' '+p.apellido).toLowerCase().includes(q)) : all;
  personsRendered = 0;
  const c = document.getElementById('persons-list-container');
  const countEl = document.getElementById('persons-count');

  if (countEl) countEl.textContent = filteredPersons.length + ' persona' + (filteredPersons.length!==1?'s':'') + (q?' encontrada'+(filteredPersons.length!==1?'s':''):'');

  if (!filteredPersons.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><h3>${q?'Sin coincidencias':'Sin personas registradas'}</h3><p>${q?'Prueba con otro nombre.':'Agrega personas para usarlas en los registros.'}</p></div>`;
    document.getElementById('persons-load-more').style.display = 'none';
    return;
  }
  c.innerHTML = '';
  loadMorePersons();
}

function loadMorePersons() {
  const c = document.getElementById('persons-list-container');
  const batch = filteredPersons.slice(personsRendered, personsRendered + PERSONS_PAGE);
  const wrap = document.createElement('div');
  if (personsRendered === 0) wrap.className = 'persons-list';

  batch.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'person-row anim-slide';
    row.style.animationDelay = (i * 20) + 'ms';
    row.innerHTML = `<span class="person-name">${esc(p.nombre)} ${esc(p.apellido)}</span>
      <div class="person-actions">
        <button class="btn btn-edit btn-sm" onclick="openEditPerson('${p.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deletePerson('${p.id}')">Borrar</button>
      </div>`;
    if (personsRendered === 0) wrap.appendChild(row);
    else c.querySelector('.persons-list')?.appendChild(row) || c.appendChild(row);
  });

  if (personsRendered === 0) c.appendChild(wrap);
  personsRendered += batch.length;

  const lm = document.getElementById('persons-load-more');
  lm.style.display = personsRendered < filteredPersons.length ? 'block' : 'none';
}

function openEditPerson(id) {
  const p = getPersons().find(x => x.id===id); if (!p) return;
  document.getElementById('ep-id').value      = p.id;
  document.getElementById('ep-nombre').value  = p.nombre;
  document.getElementById('ep-apellido').value= p.apellido;
  document.getElementById('person-modal').classList.add('open');
}
function updatePerson() {
  const id=document.getElementById('ep-id').value;
  const nombre=document.getElementById('ep-nombre').value.trim();
  const apellido=document.getElementById('ep-apellido').value.trim();
  if (!nombre)   { showToast('⚠️ El nombre es obligatorio','error'); return; }
  if (!apellido) { showToast('⚠️ El apellido es obligatorio','error'); return; }
  const persons=getPersons(); const idx=persons.findIndex(p=>p.id===id); if(idx===-1) return;
  persons[idx]={...persons[idx],nombre,apellido};
  savePersons(persons); closeModal('person-modal'); renderPersons();
  showToast('✏️ Persona actualizada','success');
}
function deletePerson(id) {
  if (!confirm('¿Eliminar esta persona?')) return;
  const row = document.querySelector(`button[onclick="deletePerson('${id}')"]`)?.closest('.person-row');
  const doDelete = () => { savePersons(getPersons().filter(p=>p.id!==id)); renderPersons(); showToast('🗑️ Persona eliminada'); };
  if (row) { row.style.transition='all .28s ease'; row.style.opacity='0'; row.style.transform='translateX(36px)'; setTimeout(doDelete,260); }
  else doDelete();
}

// ═══════════════════════════════════════════
//  RECORDS — FORM
// ═══════════════════════════════════════════
function clearForm() {
  ['val-asignado','val-ayudante'].forEach(id => { document.getElementById(id).value=''; });
  ['text-asignado','text-ayudante'].forEach(id => { const el=document.getElementById(id); el.textContent='Seleccionar…'; el.classList.add('ph'); });
  document.getElementById('f-fecha').value = new Date().toISOString().slice(0,10);
  ['f-sala','f-asignacion'].forEach(id => document.getElementById(id).value='');
  document.getElementById('f-tipo').value='';
}

function saveRecord() {
  const asignadoId=document.getElementById('val-asignado').value;
  const ayudanteId=document.getElementById('val-ayudante').value;
  const fecha=document.getElementById('f-fecha').value;
  const asignacion=document.getElementById('f-asignacion').value.trim();
  if (!asignadoId) { showToast('⚠️ Selecciona el nombre del asignado','error'); return; }
  if (!fecha)      { showToast('⚠️ La fecha es obligatoria','error'); return; }
  if (!asignacion) { showToast('⚠️ La asignación es obligatoria','error'); return; }

  const persons=getPersons();
  const pA=persons.find(p=>p.id===asignadoId);
  const pB=ayudanteId?persons.find(p=>p.id===ayudanteId):null;
  const record={
    id:uid(), asignadoId, asignado:pA?pA.nombre+' '+pA.apellido:'—',
    ayudanteId:ayudanteId||'', ayudante:pB?pB.nombre+' '+pB.apellido:'',
    fecha, sala:document.getElementById('f-sala').value.trim(),
    tipo:document.getElementById('f-tipo').value,
    asignacion, createdAt:Date.now(), updatedAt:Date.now()
  };
  const data=getRecords(); data.push(record); saveRecords(data);
  clearForm();
  const btn = document.querySelector('#page-form .btn-primary');
  if(btn){ btn.classList.add('anim-success'); setTimeout(()=>btn.classList.remove('anim-success'),700); }
  showToast('✅ Registro guardado','success');
}

// ═══════════════════════════════════════════
//  RECORDS — EDIT / DELETE
// ═══════════════════════════════════════════
function openEdit(id) {
  const rec=getRecords().find(r=>r.id===id); if(!rec) return;
  document.getElementById('edit-id').value=rec.id;
  document.getElementById('val-edit-asignado').value=rec.asignadoId||'';
  const ta=document.getElementById('text-edit-asignado'); ta.textContent=rec.asignado||'Seleccionar…'; ta.classList.toggle('ph',!rec.asignado);
  document.getElementById('val-edit-ayudante').value=rec.ayudanteId||'';
  const tb=document.getElementById('text-edit-ayudante'); tb.textContent=rec.ayudante||'Seleccionar…'; tb.classList.toggle('ph',!rec.ayudante);
  document.getElementById('edit-fecha').value=rec.fecha;
  document.getElementById('edit-sala').value=rec.sala;
  document.getElementById('edit-tipo').value=rec.tipo;
  document.getElementById('edit-asignacion').value=rec.asignacion;
  const modal = document.getElementById('edit-modal');
  modal.classList.add('open');
  modal.querySelector('.modal')?.classList.add('anim-pop');
  setTimeout(()=>modal.querySelector('.modal')?.classList.remove('anim-pop'),300);
}
function updateRecord() {
  const id=document.getElementById('edit-id').value;
  const asignadoId=document.getElementById('val-edit-asignado').value;
  const ayudanteId=document.getElementById('val-edit-ayudante').value;
  const fecha=document.getElementById('edit-fecha').value;
  const asignacion=document.getElementById('edit-asignacion').value.trim();
  if (!asignadoId) { showToast('⚠️ Selecciona el nombre del asignado','error'); return; }
  if (!fecha)      { showToast('⚠️ La fecha es obligatoria','error'); return; }
  if (!asignacion) { showToast('⚠️ La asignación es obligatoria','error'); return; }
  const persons=getPersons();
  const pA=persons.find(p=>p.id===asignadoId);
  const pB=ayudanteId?persons.find(p=>p.id===ayudanteId):null;
  const data=getRecords(); const idx=data.findIndex(r=>r.id===id); if(idx===-1) return;
  data[idx]={...data[idx], asignadoId, asignado:pA?pA.nombre+' '+pA.apellido:'—',
    ayudanteId, ayudante:pB?pB.nombre+' '+pB.apellido:'',
    fecha, sala:document.getElementById('edit-sala').value.trim(),
    tipo:document.getElementById('edit-tipo').value, asignacion, updatedAt:Date.now()};
  saveRecords(data); closeModal('edit-modal'); buildSortedData(); renderVList();
  showToast('✏️ Registro actualizado','success');
  setTimeout(()=>{
    const card = document.getElementById('vlist-items')?.querySelector('.record-card');
    if(card){ card.classList.add('anim-success'); setTimeout(()=>card.classList.remove('anim-success'),700); }
  }, 100);
}
function deleteRecord(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  const card = document.querySelector(`button[onclick="deleteRecord('${id}')"]`)?.closest('.record-card');
  const doDelete = () => { saveRecords(getRecords().filter(r=>r.id!==id)); buildSortedData(); renderVList(); };
  if(card){ card.style.transition='all .32s ease'; card.style.opacity='0'; card.style.transform='translateX(44px) scale(.95)'; setTimeout(doDelete,300); }
  else doDelete();
  showToast('🗑️ Registro eliminado');
}

// ═══════════════════════════════════════════
//  SORT
// ═══════════════════════════════════════════
let sortField='createdAt', sortDir='desc', sortedData=[];

function toggleSortMenu() {
  const m=document.getElementById('sort-menu');
  m.classList.toggle('open');
  document.getElementById('sort-toggle-btn').classList.toggle('active',m.classList.contains('open'));
}
function setSortField(f) {
  sortField=f;
  document.getElementById('sopt-created').classList.toggle('active',f==='createdAt');
  document.getElementById('sopt-updated').classList.toggle('active',f==='updatedAt');
  buildSortedData(); renderVList();
}
function setSortDir(d) {
  sortDir=d;
  document.getElementById('dir-asc').classList.toggle('active',d==='asc');
  document.getElementById('dir-desc').classList.toggle('active',d==='desc');
  buildSortedData(); renderVList();
}
function buildSortedData() {
  const q=(document.getElementById('list-search')?.value||'').toLowerCase().trim();
  let data=getRecords();
  if(q) data=data.filter(r=>[r.asignado,r.ayudante,r.sala,r.asignacion,r.tipo,r.fecha].some(v=>String(v||'').toLowerCase().includes(q)));
  data.sort((a,b)=>{ const va=a[sortField]||0,vb=b[sortField]||0; return sortDir==='asc'?va-vb:vb-va; });
  sortedData=data;
  document.getElementById('list-count').textContent=data.length+' registro'+(data.length!==1?'s':'');
}
function onListFilter() { buildSortedData(); renderVList(); }

// ═══════════════════════════════════════════
//  LIST RENDERER (load-more, full page scroll)
// ═══════════════════════════════════════════
const PAGE_SIZE = 25;
let renderedCount = 0;

function renderVList() {
  renderedCount = 0;
  const container = document.getElementById('records-render');
  if (!container) return;
  container.innerHTML = '';

  if (sortedData.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>Sin registros</h3><p>Ve a "Nuevo" para agregar el primero.</p></div>`;
    document.getElementById('load-more-wrap').style.display = 'none';
    return;
  }

  loadMoreRecords();
}

function buildCard(rec) {
  const tc = rec.tipo==='Asignado'?'var(--green)':rec.tipo==='Ayudante'?'var(--amber)':'var(--text3)';
  const tb = rec.tipo==='Asignado'?'var(--green-dim)':rec.tipo==='Ayudante'?'var(--amber-dim)':'var(--surface2)';
  return `<div class="record-card">
    <div class="rc-head">
      <div>
        <div class="rc-name">${esc(rec.asignado)}</div>
        ${rec.ayudante?`<div class="rc-helper">👤 ${esc(rec.ayudante)}</div>`:''}
      </div>
      ${rec.tipo?`<span class="rc-badge" style="background:${tb};border-color:${tc};color:${tc}">${esc(rec.tipo)}</span>`:''}
    </div>
    <div class="rc-body">
      ${rec.fecha?`<div class="rc-pill">📅 <strong>${fmtDate(rec.fecha)}</strong></div>`:''}
      ${rec.sala?`<div class="rc-pill">🏛️ <strong>${esc(rec.sala)}</strong></div>`:''}
      ${rec.asignacion?`<div class="rc-pill">📌 <strong>${esc(rec.asignacion)}</strong></div>`:''}
    </div>
    <div class="rc-foot">
      <div class="rc-dates">🕓 ${fmtDT(rec.createdAt)}<br>✏️ ${fmtDT(rec.updatedAt)}</div>
      <div class="rc-actions">
        <button class="btn btn-edit btn-sm" onclick="openEdit('${rec.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rec.id}')">Borrar</button>
      </div>
    </div>
  </div>`;
}

function loadMoreRecords() {
  const container = document.getElementById('records-render');
  const batch = sortedData.slice(renderedCount, renderedCount + PAGE_SIZE);

  batch.forEach((rec, i) => {
    const div = document.createElement('div');
    div.innerHTML = buildCard(rec);
    const card = div.firstElementChild;
    card.style.animationDelay = (i * 30) + 'ms';
    card.classList.add('anim-pop');
    container.appendChild(card);
  });

  renderedCount += batch.length;

  const wrap = document.getElementById('load-more-wrap');
  const info = document.getElementById('load-more-info');
  if (renderedCount < sortedData.length) {
    wrap.style.display = 'block';
    info.textContent = `Mostrando ${renderedCount} de ${sortedData.length} registros`;
  } else {
    wrap.style.display = renderedCount > PAGE_SIZE ? 'block' : 'none';
    if (info) info.textContent = `${sortedData.length} registros en total`;
    if (wrap.style.display === 'block') {
      wrap.querySelector('button').style.display = 'none';
    }
  }
}

function onVScroll() {}
function setVListHeight() {}

// ═══════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════
function exportData() {
  const payload=JSON.stringify({records:getRecords(),persons:getPersons(),exportedAt:new Date().toISOString()},null,2);
  const blob=new Blob([payload],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='asignaciones_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(url);
  showToast('💾 Archivo exportado','success');
}
function importData() {
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const d=JSON.parse(ev.target.result);
        if(d.records) localStorage.setItem(SK,JSON.stringify(d.records));
        if(d.persons) localStorage.setItem(PK,JSON.stringify(d.persons));
        markPending(); updateTotalCount();
        showToast('📤 Datos importados','success');
      } catch(err) { showToast('❌ Archivo inválido','error'); }
    };
    reader.readAsText(file);
  };
  inp.click();
}

// ═══════════════════════════════════════════
//  LIST VIEW TOGGLE
// ═══════════════════════════════════════════
let currentListView = 'list';

function setListView(mode) {
  currentListView = mode;
  document.getElementById('list-view-wrap').style.display      = mode === 'list'      ? '' : 'none';
  document.getElementById('spotlight-view-wrap').style.display = mode === 'spotlight' ? '' : 'none';
  document.getElementById('vt-list').classList.toggle('active',      mode === 'list');
  document.getElementById('vt-spotlight').classList.toggle('active', mode === 'spotlight');

  if (mode === 'list') { buildSortedData(); renderVList(); }
  if (mode === 'spotlight') {
    // Re-render if a person was already selected
    const id = document.getElementById('val-spotlight')?.value;
    if (id) renderSpotlight(id);
  }
}

// ═══════════════════════════════════════════
//  SPOTLIGHT — Por persona
// ═══════════════════════════════════════════
function renderSpotlight(personId) {
  const container = document.getElementById('spotlight-content');
  if (!personId) { container.innerHTML = ''; return; }

  const persons  = getPersons();
  const records  = getRecords();
  const person   = persons.find(p => p.id === personId);
  if (!person) { container.innerHTML = ''; return; }

  const fullName = person.nombre + ' ' + person.apellido;

  // Registros donde esta persona aparece (como asignado o ayudante)
  const myRecords = records.filter(r =>
    r.asignadoId === personId || r.ayudanteId === personId
  );

  // Calcular parejas: frecuencia y última fecha juntos
  const pairData = {};
  myRecords.forEach(r => {
    const partnerId = r.asignadoId === personId ? r.ayudanteId : r.asignadoId;
    if (!partnerId) return;
    if (!pairData[partnerId]) pairData[partnerId] = { count: 0, lastFecha: '' };
    pairData[partnerId].count++;
    if ((r.fecha || '') > pairData[partnerId].lastFecha) pairData[partnerId].lastFecha = r.fecha;
  });

  // Personas que nunca han sido pareja
  const neverPaired = persons.filter(p => p.id !== personId && !pairData[p.id]);

  // Última asignación general
  const sorted = myRecords.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const lastRec = sorted[0];
  const lastDate = lastRec ? fmtDate(lastRec.fecha) : '—';

  // Parejas ordenadas por frecuencia desc
  const pairedList = Object.entries(pairData)
    .map(([id, { count, lastFecha }]) => ({ person: persons.find(p => p.id === id), count, lastFecha }))
    .filter(x => x.person)
    .sort((a, b) => b.count - a.count);

  // Iniciales para el avatar
  const initials = (person.nombre[0] + (person.apellido[0] || '')).toUpperCase();

  // Últimas 3 asignaciones recientes
  const recentRecs = sorted.slice(0, 3);

  container.innerHTML = `
    <div class="spotlight-card anim-pop">

      <div class="spotlight-head">
        <div class="spotlight-avatar">${esc(initials)}</div>
        <div>
          <div class="spotlight-name">${esc(fullName)}</div>
          <div class="spotlight-meta">${myRecords.length} asignación${myRecords.length !== 1 ? 'es' : ''} · última: ${lastDate}</div>
        </div>
      </div>

      <div class="spotlight-stats-row">
        <div class="spotlight-stat">
          <div class="spotlight-stat-val">${myRecords.length}</div>
          <div class="spotlight-stat-lbl">Total</div>
        </div>
        <div class="spotlight-stat">
          <div class="spotlight-stat-val">${pairedList.length}</div>
          <div class="spotlight-stat-lbl">Con parejas</div>
        </div>
        <div class="spotlight-stat">
          <div class="spotlight-stat-val" style="color:var(--amber)">${neverPaired.length}</div>
          <div class="spotlight-stat-lbl">Sin pareja</div>
        </div>
      </div>

      ${recentRecs.length ? `
      <div class="spotlight-section">
        <div class="spotlight-section-title">Asignaciones recientes</div>
        ${recentRecs.map(r => `
          <div class="spotlight-recent-row">
            <div class="spotlight-recent-info">
              <div class="spotlight-recent-asig">📌 ${esc(r.asignacion)}</div>
              <div class="spotlight-recent-meta">${r.sala ? '🏛️ ' + esc(r.sala) + ' · ' : ''}${r.tipo ? esc(r.tipo) : ''}</div>
            </div>
            <div class="spotlight-recent-date">${fmtDate(r.fecha)}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${pairedList.length ? `
      <div class="spotlight-section">
        <div class="spotlight-section-title">✅ Ha sido asignado con</div>
        ${pairedList.map(({ person: p, count, lastFecha }) => `
          <div class="spotlight-pair-row">
            <div>
              <div class="spotlight-pair-name">${esc(p.nombre)} ${esc(p.apellido)}</div>
              <div class="spotlight-pair-sub">${count} vez${count !== 1 ? 'ces' : ''} · última: ${fmtDate(lastFecha)}</div>
            </div>
            <span class="spotlight-pair-count">×${count}</span>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="spotlight-section">
        <div class="spotlight-section-title">⚠️ Nunca asignado con</div>
        ${neverPaired.length === 0
          ? `<div class="spotlight-empty">Ha sido asignado con todas las personas registradas.</div>`
          : neverPaired.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => `
            <div class="spotlight-missing-row">
              <div class="spotlight-missing-dot"></div>
              <div class="spotlight-missing-name">${esc(p.nombre)} ${esc(p.apellido)}</div>
            </div>
          `).join('')
        }
      </div>

    </div>
  `;
}

// ═══════════════════════════════════════════
//  STATUS BAR & ONLINE/OFFLINE
// ═══════════════════════════════════════════
function updateStatusBar() {
  const bar  = document.getElementById('status-bar');
  const dot  = document.getElementById('sdot');
  const text = document.getElementById('status-text');
  const pend = getPending();
  const ts   = getLastSync();
  if (!navigator.onLine) {
    bar.classList.add('visible'); dot.className='sdot off';
    text.textContent='Sin conexión · los datos se guardan localmente';
  } else if (pend) {
    bar.classList.add('visible'); dot.className='sdot pend';
    text.textContent='Cambios pendientes de sincronizar con Drive…';
  } else if (driveToken && ts) {
    bar.classList.add('visible'); dot.className='sdot on';
    const diff = Math.round((Date.now()-ts)/1000);
    const ago  = diff < 60 ? diff+'s' : diff < 3600 ? Math.round(diff/60)+'min' : Math.round(diff/3600)+'h';
    text.textContent = '✓ Sincronizado con Drive hace ' + ago;
    setTimeout(() => { if(!getPending() && navigator.onLine) bar.classList.remove('visible'); }, 8000);
  } else {
    bar.classList.remove('visible');
  }
}
function tryAutoSync() {
  if (navigator.onLine && driveToken && getPending()) syncToDrive();
}
window.addEventListener('online',  () => { updateStatusBar(); tryAutoSync(); });
window.addEventListener('offline', () => updateStatusBar());

// ═══════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if(e.target===el) el.classList.remove('open'); });
});

// ═══════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('asgn_theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-btn');
  btn.title = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
  btn.textContent = isLight ? '☀️ Claro' : '🌙 Oscuro';
}
function initTheme() {
  const saved = localStorage.getItem('asgn_theme');
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = '☀️ Claro';
  }
}
