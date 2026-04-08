// ═══════════════════════════════════════════
//  GOOGLE DRIVE SYNC
// ═══════════════════════════════════════════
// ⚠️  SEGURIDAD: El Client ID de OAuth es visible en el código fuente.
//     Esto es normal para apps de cliente puro (no hay backend).
//     Asegúrate de que en Google Cloud Console:
//       • Solo tengas habilitados los orígenes JS autorizados que uses.
//       • El scope sea únicamente "drive.appdata" (carpeta privada de la app).
//     Así, aunque alguien vea el Client ID, no puede acceder a los datos
//     de otros usuarios sin su propia autorización OAuth.
//
// ── INSTRUCCIONES PARA ACTIVAR GOOGLE DRIVE ──────────────────────
// 1. Ve a console.cloud.google.com → Crear proyecto
// 2. Habilitar "Google Drive API"
// 3. Credenciales → OAuth 2.0 → Tipo: Aplicación web
// 4. Agregar el origen de esta app en "Authorized JavaScript origins"
// 5. Reemplaza el valor de DRIVE_CLIENT_ID con tu Client ID real
// ─────────────────────────────────────────────────────────────────
const DRIVE_CLIENT_ID = '26042054397-qgj5f31c29ns146ehgtj95j8u7c6ej8g.apps.googleusercontent.com';
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DRIVE_FILE_NAME = 'asignaciones_backup.json';
let driveToken  = null;
let driveFileId = null;

function handleSyncClick() {
  if (DRIVE_CLIENT_ID === 'YOUR_CLIENT_ID') {
    alert('📋 CÓMO ACTIVAR GOOGLE DRIVE\n\n1. Ve a console.cloud.google.com\n2. Crea un proyecto nuevo\n3. Habilita "Google Drive API"\n4. Crea credenciales OAuth 2.0 (tipo: Web application)\n5. Agrega como "Authorized JavaScript origin" la URL donde abres esta app\n6. Copia el Client ID y pégalo en el código donde dice YOUR_CLIENT_ID\n\nMientras tanto, usa los botones Exportar/Importar para hacer respaldos manuales.');
    return;
  }
  if (!driveToken) { googleSignIn(); return; }
  syncToDrive();
}

function googleSignIn() {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${DRIVE_CLIENT_ID}`+
    `&redirect_uri=${encodeURIComponent(location.href.split('?')[0].split('#')[0])}`+
    `&response_type=token&scope=${encodeURIComponent(DRIVE_SCOPE)}&prompt=select_account`;
  location.href = url;
}

// Handle OAuth token on page load
(function checkOAuth() {
  if (!location.hash.includes('access_token')) return;
  const p = new URLSearchParams(location.hash.slice(1));
  driveToken = p.get('access_token');
  history.replaceState(null,'',location.pathname);
  setSyncStatus('synced','Conectado');
  showToast('✅ Google Drive conectado','success');
  fetchGoogleProfile();
  document.getElementById('pull-btn').style.display = 'flex';
  setTimeout(() => { syncToDrive(); startAutoSyncLoop(); }, 100);
})();

// ── Lógica central compartida por syncToDrive y autoSync ──
async function _syncCore({ silent = false } = {}) {
  if (!driveToken) return;
  setSyncStatus('syncing', 'Sincronizando…');

  if (!driveFileId) driveFileId = await findDriveFile();

  const localRecords = getRecords();
  const localPersons = getPersons();
  const localEmpty   = localRecords.length === 0 && localPersons.length === 0;

  if (driveFileId) {
    const remote = await fetchDriveData(driveFileId);
    if (remote) {
      const remoteRecords = remote.records || [];
      const remotePersons = remote.persons || [];

      if (localEmpty) {
        // Dispositivo nuevo — cargar todo desde Drive
        localStorage.setItem(SK, JSON.stringify(remoteRecords));
        localStorage.setItem(PK, JSON.stringify(remotePersons));
        updateTotalCount();
        renderVListIfActive();
        renderPersonsIfActive();
        clearPending();
        setSyncStatus('synced', 'Drive ✓');
        if (!silent) showToast('📥 Datos descargados desde Drive (' + remoteRecords.length + ' registros)', 'success');
        return;
      } else {
        // Merge: combinar, deduplicar por id, conservar el más nuevo
        const mergedRecords = mergeById(localRecords, remoteRecords);
        const mergedPersons = mergeById(localPersons, remotePersons);
        localStorage.setItem(SK, JSON.stringify(mergedRecords));
        localStorage.setItem(PK, JSON.stringify(mergedPersons));
        updateTotalCount();
        renderVListIfActive();
        renderPersonsIfActive();
        await updateDriveFile(driveFileId, JSON.stringify({
          records: mergedRecords, persons: mergedPersons,
          exportedAt: new Date().toISOString()
        }));
        clearPending();
        setSyncStatus('synced', 'Drive ✓');
        if (!silent) showToast('🔄 Sincronizado · ' + mergedRecords.length + ' registros', 'success');
        return;
      }
    }
  }

  // Sin archivo remoto — subir datos locales
  const payload = JSON.stringify({ records: localRecords, persons: localPersons, exportedAt: new Date().toISOString() });
  driveFileId = await createDriveFile(payload);
  clearPending();
  setSyncStatus('synced', 'Drive ✓');
  if (!silent) showToast('☁️ Datos subidos a Drive', 'success');
}

async function syncToDrive() {
  try {
    await _syncCore({ silent: false });
  } catch(e) {
    console.error('Sync error', e);
    setSyncStatus('error', 'Error Drive');
    showToast('❌ Error al sincronizar: ' + (e.message || ''), 'error');
  }
}

async function fetchDriveData(fid) {
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fid}?alt=media`,
      { headers: { Authorization: 'Bearer ' + driveToken } }
    );
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

function mergeById(local, remote) {
  const map = new Map();
  remote.forEach(item => map.set(item.id, item));
  local.forEach(item => {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const localTs  = item.updatedAt  || item.createdAt  || 0;
      const remoteTs = existing.updatedAt || existing.createdAt || 0;
      if (localTs >= remoteTs) map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

function renderVListIfActive() {
  if (document.getElementById('page-list')?.classList.contains('active')) {
    buildSortedData(); renderVList();
  }
}

function renderPersonsIfActive() {
  if (document.getElementById('page-persons')?.classList.contains('active')) {
    renderPersons();
  }
}

async function findDriveFile() {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)`,
    { headers:{Authorization:'Bearer '+driveToken} });
  const d = await r.json();
  return d.files?.length ? d.files[0].id : null;
}

async function createDriveFile(content) {
  const meta = JSON.stringify({name:DRIVE_FILE_NAME,parents:['appDataFolder']});
  const body = '--b\r\nContent-Type: application/json\r\n\r\n'+meta+'\r\n--b\r\nContent-Type: application/json\r\n\r\n'+content+'\r\n--b--';
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method:'POST', headers:{Authorization:'Bearer '+driveToken,'Content-Type':'multipart/related; boundary=b'}, body });
  const d = await r.json();
  return d.id;
}

async function updateDriveFile(fid, content) {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fid}?uploadType=media`,
    { method:'PATCH', headers:{Authorization:'Bearer '+driveToken,'Content-Type':'application/json'}, body:content });
}

async function pullFromDrive() {
  if (!driveToken) { handleSyncClick(); return; }
  setSyncStatus('syncing', 'Descargando…');
  try {
    if (!driveFileId) driveFileId = await findDriveFile();
    if (!driveFileId) { showToast('No hay datos en Drive aún', 'error'); setSyncStatus('synced','Drive ✓'); return; }
    const remote = await fetchDriveData(driveFileId);
    if (!remote) { showToast('❌ No se pudieron obtener los datos', 'error'); setSyncStatus('error','Error Drive'); return; }

    const localRecords = getRecords();
    const localPersons = getPersons();
    const mergedRecords = mergeById(localRecords, remote.records || []);
    const mergedPersons = mergeById(localPersons, remote.persons || []);
    localStorage.setItem(SK, JSON.stringify(mergedRecords));
    localStorage.setItem(PK, JSON.stringify(mergedPersons));
    updateTotalCount();
    renderVListIfActive();
    renderPersonsIfActive();
    clearPending();
    setSyncStatus('synced','Drive ✓');
    showToast('📥 Datos actualizados · ' + mergedRecords.length + ' registros', 'success');
  } catch(e) {
    setSyncStatus('error','Error Drive');
    showToast('❌ Error al descargar: ' + (e.message||''), 'error');
  }
}

function setSyncStatus(cls, label) {
  const btn = document.getElementById('sync-btn');
  btn.className = 'hbtn '+cls;
  btn.textContent = (cls==='syncing'?'🔄':cls==='synced'?'☁️':cls==='error'?'⚠️':'☁️')+' '+(label||'Drive');
}

// ═══════════════════════════════════════════
//  GOOGLE PROFILE
// ═══════════════════════════════════════════
let googleProfile = null;

async function fetchGoogleProfile() {
  if (!driveToken) return;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + driveToken }
    });
    const p = await r.json();
    googleProfile = p;
    updateAvatarUI(p);
    localStorage.setItem('asgn_profile', JSON.stringify({ name: p.name, email: p.email, picture: p.picture }));
  } catch(e) { console.warn('Profile fetch failed', e); }
}

function updateAvatarUI(p) {
  const wrap    = document.getElementById('avatar-wrap');
  const imgEl   = document.getElementById('avatar-img');
  const infoEl  = document.getElementById('avatar-info');
  const nameEl  = document.getElementById('avatar-name');
  const emailEl = document.getElementById('avatar-email');
  const dotEl   = document.getElementById('avatar-dot');
  if (!wrap) return;

  if (p.picture) {
    imgEl.outerHTML = `<img class="avatar-img" id="avatar-img" src="${p.picture}" alt="${esc(p.name||'')}" referrerpolicy="no-referrer">`;
  } else {
    const initials = (p.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    imgEl.textContent = initials;
    imgEl.className = 'avatar-default';
  }
  if (nameEl)  nameEl.textContent  = (p.name||'').split(' ')[0];
  if (emailEl) emailEl.textContent = p.email || '';
  if (infoEl)  infoEl.style.display = 'flex';
  if (dotEl)   dotEl.style.display  = 'block';
  wrap.title = `Conectado como ${p.email}`;
}

function handleAvatarClick() {
  if (!driveToken) {
    handleSyncClick();
  } else if (googleProfile) {
    const msg = `✅ Sesión activa\n\n👤 ${googleProfile.name}\n📧 ${googleProfile.email}\n\n¿Qué deseas hacer?`;
    if (confirm(msg + '\n\n(Aceptar = sincronizar ahora | Cancelar = cerrar)')) {
      syncToDrive();
    }
  }
}

function restoreProfileFromCache() {
  try {
    const cached = JSON.parse(localStorage.getItem('asgn_profile'));
    if (cached) {
      updateAvatarUI(cached);
      const pb = document.getElementById('pull-btn');
      if (pb) pb.style.display = 'flex';
      setTimeout(startAutoSyncLoop, 1500);
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════
//  AUTO SYNC
// ═══════════════════════════════════════════
async function autoSync(reason) {
  if (!driveToken)       return;
  if (!navigator.onLine) return;
  console.log('[AutoSync] trigger:', reason);
  try {
    await _syncCore({ silent: true });
    setLastSync();
    updateSyncIndicator();
  } catch(e) {
    console.warn('[AutoSync] failed:', e);
    setSyncStatus('error', 'Error Drive');
  }
}

function updateSyncIndicator() {
  const ts = getLastSync();
  if (!ts) return;
  const diff = Math.round((Date.now() - ts) / 1000);
  let label;
  if (diff < 60)        label = 'hace ' + diff + 's';
  else if (diff < 3600) label = 'hace ' + Math.round(diff/60) + 'min';
  else                  label = 'hace ' + Math.round(diff/3600) + 'h';
  const btn = document.getElementById('sync-btn');
  if (btn && driveToken) btn.title = 'Última sync: ' + label;
}

function startAutoSyncLoop() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    autoSync('interval-' + SYNC_INTERVAL_MS/1000 + 's');
    updateSyncIndicator();
  }, SYNC_INTERVAL_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const sinceLastSync = Date.now() - getLastSync();
    if (sinceLastSync > 30_000) autoSync('visibility-visible');
    updateSyncIndicator();
  }
});

window.addEventListener('online', () => {
  updateStatusBar();
  autoSync('came-online');
});

// ═══════════════════════════════════════════
//  INIT (runs after both app.js and sync.js are loaded)
// ═══════════════════════════════════════════
initTheme();
document.getElementById('f-fecha').value = new Date().toISOString().slice(0,10);
updateTotalCount();
updateStatusBar();
restoreProfileFromCache();
window.addEventListener('resize', () => {
  if (document.getElementById('page-list').classList.contains('active')) renderVList();
});

setTimeout(() => {
  if (driveToken) {
    autoSync('app-load');
    startAutoSyncLoop();
  }
}, 1200);
