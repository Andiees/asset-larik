const API_URL = SCRIPT_URL;
const SHEET_ID_THEMES = '14aZ9CtI8Iydv_vu06pICoStpUvQMqhoIIJI42phKFY8';
const DEFAULT_LIMIT = 20;

let cachedPages = [], cachedPosts = [], cachedUsers = [];
let paginationState = { pages: { current: 1, total: 1, limit: DEFAULT_LIMIT }, posts: { current: 1, total: 1, limit: DEFAULT_LIMIT }, users: { current: 1, total: 1, limit: DEFAULT_LIMIT } };
let searchState = { pages: '', posts: '', users: '' };
let IK_PUB = '', BLOG_SLUG = 'blog', CURRENT_USER_ID = '', CURRENT_USER_ROLE = 'admin';
let themesData = [], isSummernoteInitialized = false;
let currentFormatSheetToSetup = '';

// 🔧 FIX: Simpan referensi tema yang sedang diproses (HINDARI MATCHING DOM)
let activeThemeRef = null;
let isTemplateBeingApplied = false;

const _idCounter = { val: 0 };
function generateUniqueId(prefix = 'LRK') {
  const microTime = typeof performance !== 'undefined' && performance.now ? Math.floor(performance.now() * 1000) : Date.now() * 1000;
  const randomBytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) { window.crypto.getRandomValues(randomBytes); } else { for (let i = 0; i < 16; i++) randomBytes[i] = Math.floor(Math.random() * 256); }
  const cryptoHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  _idCounter.val = (_idCounter.val + 1) % 10000;
  return `${prefix}-${microTime}-${_idCounter.val.toString().padStart(4, '0')}-${cryptoHex}`.toUpperCase();
}
function formatToSlug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'untitled'; }
async function generateUniqueSlugAsync(baseSlug, sheetType, currentId = null) {
  let slug = formatToSlug(baseSlug);
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_existing_slugs', params: { sheet: sheetType, currentId: currentId } }) });
    const r = await res.json();
    if (r.status === 'success' && Array.isArray(r.data)) {
      const existingSlugs = new Set(r.data.map(s => s?.toLowerCase()).filter(Boolean));
      let uniqueSlug = slug, counter = 1;
      while (existingSlugs.has(uniqueSlug)) { uniqueSlug = `${slug}-${counter}`; counter++; if (counter > 999) { uniqueSlug = `${slug}-${Date.now()}`; break; } }
      return uniqueSlug;
    }
  } catch (e) { console.warn('Slug check failed:', e); }
  const cache = sheetType === 'pages' ? cachedPages : cachedPosts;
  const existingSlugs = cache.filter(item => item && item[0] !== currentId).map(item => item[1]?.toLowerCase()).filter(s => s);
  let uniqueSlug = slug, counter = 1;
  while (existingSlugs.includes(uniqueSlug)) { uniqueSlug = `${slug}-${counter}`; counter++; if (counter > 999) { uniqueSlug = `${slug}-${Date.now()}`; break; } }
  return uniqueSlug;
}
function getUserId() { return CURRENT_USER_ID || sessionStorage.getItem('cms_user_id') || localStorage.getItem('cms_user_id') || ''; }
function isAdmin() { return (CURRENT_USER_ROLE || sessionStorage.getItem('cms_role') || 'admin') === 'admin'; }
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = type === 'error' ? 'x-circle' : (type === 'warning' ? 'alert-circle' : 'check-circle');
  toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i> <span>${message}</span>`;
  container.appendChild(toast); lucide.createIcons({ root: toast });
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 3500);
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); }
function safeSetValue(elementId, value) { const el = document.getElementById(elementId); if (el && typeof el.value !== 'undefined') { el.value = value; return true; } return false; }
function safeToggleClass(elementId, className, show) { const el = document.getElementById(elementId); if (el) { if (show) el.classList.remove(className); else el.classList.add(className); return true; } return false; }
function switchTab(t) {
  if ((t === 'settings' || t === 'themes' || t === 'users') && !isAdmin()) { showToast('Akses ditolak', 'error'); return; }
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const tabEl = document.getElementById('tab-'+t); if(tabEl) tabEl.classList.add('active');
  const navEl = document.getElementById('nav-'+t); if(navEl) navEl.classList.add('active');
  const titles = { 'pages': 'Pages', 'posts': 'Artikel / Blog', 'media': 'Media', 'settings': 'Pengaturan Web', 'themes': 'Tema Website', 'users': 'Manajemen Users' };
  document.getElementById('tab-title').innerText = titles[t] || t.toUpperCase();
  if(window.innerWidth < 768) toggleSidebar();
  if (t === 'media' && sessionStorage.getItem('cms_auth')) loadMediaGallery();
  if (t === 'themes' && sessionStorage.getItem('cms_auth')) loadAllThemes();
  if (t === 'posts' && sessionStorage.getItem('cms_auth')) { paginationState.posts.current = 1; renderPostsTable(); }
  if (t === 'pages' && sessionStorage.getItem('cms_auth')) { paginationState.pages.current = 1; renderPagesTable(); }
  if (t === 'users' && sessionStorage.getItem('cms_auth') && isAdmin()) { paginationState.users.current = 1; renderUsersTable(); }
}

document.getElementById('form-login').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login'); const oriText = btn.innerHTML;
  btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> MEMPROSES...</span>';
  btn.disabled = true;
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin_login', email: document.getElementById('adm-email').value, password: document.getElementById('adm-pass').value })});
    const r = await res.json();
    if(r.status === 'success') {
      sessionStorage.setItem('cms_auth', 'true'); sessionStorage.setItem('cms_name', r.data.nama);
      if(r.data.id_user) { sessionStorage.setItem('cms_user_id', r.data.id_user); CURRENT_USER_ID = r.data.id_user; }
      CURRENT_USER_ROLE = r.data.role || 'admin'; sessionStorage.setItem('cms_role', CURRENT_USER_ROLE);
      showToast('Berhasil Login!', 'success'); await init();
    } else { showToast(r.message, 'error'); btn.innerHTML = oriText; btn.disabled = false; }
  } catch (err) { showToast('Error Koneksi API!', 'error'); btn.innerHTML = oriText; btn.disabled = false; }
};

// 🔐 UPDATED: applyRoleUI dengan proteksi redirect yang lebih kuat
function applyRoleUI() {
  const role = CURRENT_USER_ROLE || sessionStorage.getItem('cms_role') || 'admin';
  const badge = document.getElementById('admin-role-badge');
  
  if (badge) { 
    badge.textContent = role === 'admin' ? 'Admin' : 'Author'; 
    badge.className = `role-badge ${role}`; 
  }
  
  document.body.classList.remove('role-admin', 'role-author'); 
  document.body.classList.add(`role-${role}`);
  
  // 🔐 Redirect author jika mencoba akses tab admin
  if (role !== 'admin') { 
    const activeTab = document.querySelector('.tab-content.active'); 
    const forbiddenTabs = ['tab-settings', 'tab-themes', 'tab-users', 'tab-media'];
    if (activeTab && forbiddenTabs.includes(activeTab.id)) { 
      switchTab('pages'); 
    } 
  }
}

const prefetchInjector = (async () => { if (!sessionStorage.getItem('cms_auth') || (sessionStorage.getItem('cms_role') && sessionStorage.getItem('cms_role') !== 'admin')) return null; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_public_page', slug: 'admin-injector' }) }); return await res.json(); } catch(e) { return null; } })();
async function runCustomInjector() { if (!isAdmin()) return; try { const r = await prefetchInjector; if (r && r.status === 'success' && r.data && r.data.content) { const tempDiv = document.createElement('div'); tempDiv.innerHTML = r.data.content; const scripts = tempDiv.querySelectorAll('script'); scripts.forEach(oldScript => { const oldEl = document.getElementById('injector-script-tag'); if(oldEl) oldEl.remove(); const newScript = document.createElement('script'); newScript.id = 'injector-script-tag'; Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value)); newScript.appendChild(document.createTextNode(oldScript.innerHTML)); document.body.appendChild(newScript); }); } } catch(e) { console.warn("Gagal memuat Injector CMS: ", e); } }
async function init() { if(!sessionStorage.getItem('cms_auth')) return; document.body.classList.remove('login-active'); document.getElementById('login-overlay').style.display = 'none'; document.getElementById('admin-main').style.display = 'flex'; CURRENT_USER_ID = sessionStorage.getItem('cms_user_id') || ''; CURRENT_USER_ROLE = sessionStorage.getItem('cms_role') || 'admin'; document.getElementById('admin-name').innerHTML = `<div class="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">${(sessionStorage.getItem('cms_name')||'A')[0].toUpperCase()}</div> ${sessionStorage.getItem('cms_name')}`; runCustomInjector(); await fetchAllAdminData(); }
async function fetchAllAdminData() {
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_admin_data', params: { role: CURRENT_USER_ROLE || 'admin', id_user: getUserId(), limit: DEFAULT_LIMIT, offset: 0, sortBy: 'date', sortOrder: 'desc' } }) });
    const r = await res.json();
    if (r.status === 'success' && r.data) {
      cachedPages = r.data.pages?.items || []; cachedPosts = r.data.posts?.items || []; cachedUsers = r.data.users?.items || [];
      paginationState.pages = r.data.pages?.pagination || { total: 0, currentPage: 1, totalPages: 1, limit: DEFAULT_LIMIT, offset: 0, hasNext: false, hasPrev: false };
      paginationState.posts = r.data.posts?.pagination || { total: 0, currentPage: 1, totalPages: 1, limit: DEFAULT_LIMIT, offset: 0, hasNext: false, hasPrev: false };
      paginationState.users = r.data.users?.pagination || { total: 0, currentPage: 1, totalPages: 1, limit: DEFAULT_LIMIT, offset: 0, hasNext: false, hasPrev: false };
      renderPagesTable(); renderPostsTable(); renderUsersTable();
      if (r.data.settings) renderUI({ settings: r.data.settings });
      runCustomInjector(); return true;
    } return false;
  } catch (err) { console.error('Fetch Admin Data Error:', err); showToast('Gagal memuat data dari server', 'error'); return false; }
}
function forceSync() { showToast('Menyegarkan data server...', 'warning'); init(); }
function logout() { sessionStorage.clear(); CURRENT_USER_ID = ''; CURRENT_USER_ROLE = 'admin'; location.reload(); }

function renderPagesTable() {
  const { total, currentPage, totalPages } = paginationState.pages;
  document.getElementById('count-pages').innerText = total; document.getElementById('info-pages-page').innerText = `Halaman ${currentPage || 1} dari ${totalPages || 1}`;
  document.getElementById('list-pages').innerHTML = cachedPages.length ? cachedPages.map(p => `<tr class="group"><td class="font-bold text-slate-800">${p[2]||''}</td><td class="font-mono text-teal-600 text-sm">/${p[1]||''}</td><td class="text-slate-500 text-xs">${p[4]||'-'}</td><td class="text-right"><div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="window.open('/${p[1]||''}', '_blank')" class="action-btn view" title="Lihat"><i data-lucide="external-link" class="w-4 h-4"></i></button><button onclick="editPage('${p[0]||''}')" class="action-btn edit" title="Edit"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deletePage('${p[0]||''}')" class="action-btn delete" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>`).join('') : `<tr><td colspan="4" class="text-center text-slate-400 py-12 italic font-medium">Tidak ada halaman ditemukan.</td></tr>`;
  document.getElementById('nav-pages-page').innerHTML = `<button onclick="changePage('pages', ${currentPage - 1})" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button><button onclick="changePage('pages', ${currentPage + 1})" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
  lucide.createIcons();
}
function renderPostsTable() {
  const { total, currentPage, totalPages } = paginationState.posts;
  document.getElementById('count-posts').innerText = total; document.getElementById('info-posts-page').innerText = `Halaman ${currentPage || 1} dari ${totalPages || 1}`;
  document.getElementById('list-posts').innerHTML = cachedPosts.length ? cachedPosts.map(p => `<tr class="group"><td><div class="font-bold text-slate-800 line-clamp-2">${p[2]||''}</div><div class="text-[10px] font-mono text-teal-500 mt-1">/${BLOG_SLUG}/${p[1]||''}</div></td><td><span class="bg-slate-100 px-3 py-1.5 rounded-full text-[10px] font-semibold text-slate-600 border border-slate-200">${p[3]||'-'}</span></td><td class="text-slate-500 text-xs">${p[6]||'-'}</td><td class="text-right"><div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="window.open('/${BLOG_SLUG}/${p[1]||''}', '_blank')" class="action-btn view" title="Lihat"><i data-lucide="external-link" class="w-4 h-4"></i></button><button onclick="editPost('${p[0]||''}')" class="action-btn edit" title="Edit"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deletePost('${p[0]||''}')" class="action-btn delete" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>`).join('') : `<tr><td colspan="4" class="text-center text-slate-400 py-12 italic font-medium">Tidak ada artikel ditemukan.</td></tr>`;
  document.getElementById('nav-posts-page').innerHTML = `<button onclick="changePage('posts', ${currentPage - 1})" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button><button onclick="changePage('posts', ${currentPage + 1})" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
  lucide.createIcons();
}
function renderUsersTable() {
  if (!isAdmin()) return;
  const { total, currentPage, totalPages } = paginationState.users;
  document.getElementById('count-users').innerText = total; document.getElementById('info-users-page').innerText = `Halaman ${currentPage || 1} dari ${totalPages || 1}`;
  document.getElementById('list-users').innerHTML = cachedUsers.length ? cachedUsers.map(u => `<tr class="group"><td class="font-bold text-slate-800">${u[2]||''}</td><td class="text-slate-600 text-sm">${u[0]||''}</td><td><span class="role-badge ${u[3]==='admin'?'admin':'author'}">${u[3]||''}</span></td><td class="font-mono text-xs text-slate-500">${u[4]||'-'}</td><td class="text-right"><div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="editUser('${u[4]||''}')" class="action-btn edit" title="Edit"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deleteUser('${u[4]||''}')" class="action-btn delete" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>`).join('') : `<tr><td colspan="5" class="text-center text-slate-400 py-12 italic font-medium">Tidak ada user ditemukan.</td></tr>`;
  document.getElementById('nav-users-page').innerHTML = `<button onclick="changePage('users', ${currentPage - 1})" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button><button onclick="changePage('users', ${currentPage + 1})" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
  lucide.createIcons();
}
async function changePage(type, page) { if (page < 1) return; showToast('Memuat halaman...', 'warning'); try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_admin_data', params: { role: CURRENT_USER_ROLE || 'admin', id_user: getUserId(), limit: DEFAULT_LIMIT, offset: (page - 1) * DEFAULT_LIMIT, sortBy: 'date', sortOrder: 'desc', search: searchState[type] || '' } }) }); const r = await res.json(); if (r.status === 'success' && r.data) { if (type === 'pages') { cachedPages = r.data.pages?.items || []; paginationState.pages = r.data.pages?.pagination || paginationState.pages; renderPagesTable(); } if (type === 'posts') { cachedPosts = r.data.posts?.items || []; paginationState.posts = r.data.posts?.pagination || paginationState.posts; renderPostsTable(); } if (type === 'users' && isAdmin()) { cachedUsers = r.data.users?.items || []; paginationState.users = r.data.users?.pagination || paginationState.users; renderUsersTable(); } } } catch (err) { showToast('Gagal memuat halaman', 'error'); } }
function handleSearchPages(val) { searchState.pages = val; paginationState.pages.current = 1; fetchAllAdminData(); }
function handleSearchPosts(val) { searchState.posts = val; paginationState.posts.current = 1; fetchAllAdminData(); }
function handleSearchUsers(val) { searchState.users = val; paginationState.users.current = 1; fetchAllAdminData(); }

function renderUI(r) {
  const s = r.settings || {}; BLOG_SLUG = s.blog_slug || 'blog';
  document.getElementById('set-site-name').value = s.site_name || ''; document.getElementById('set-site-tagline').value = s.site_tagline || '';
  document.getElementById('set-logo').value = s.site_logo || ''; document.getElementById('set-favicon').value = s.site_favicon || '';
  
  // ✅ Populate homepage dropdown with pages
  document.getElementById('set-home-page').innerHTML = '<option value="">-- Bawaan/Home Template --</option>' + (cachedPages.map(p => `<option value="${p[1]}">${p[2]} (/${p[1]})</option>`).join('') || '');
  document.getElementById('set-home-page').value = s.home_page || ''; 
  document.getElementById('set-blog-slug').value = BLOG_SLUG;
  document.getElementById('set-category-slug').value = s.category_slug || 'category';
  
  // 🔧 FIX: Skip template fields jika sedang dalam proses apply theme
  if (!isTemplateBeingApplied) {
    document.getElementById('set-category-tpl').value = s.category_template || '';
    document.getElementById('set-google-verify').value = s.google_site_verification || '';
    document.getElementById('set-bing-verify').value = s.bing_site_verification || '';
    document.getElementById('set-robots-txt').value = s.robots_txt || '';
    document.getElementById('set-ads-txt').value = s.ads_txt || '';
    document.getElementById('set-ik-pub').value = IK_PUB = s.ik_public_key || '';
    document.getElementById('set-ik-end').value = s.ik_endpoint || '';
    document.getElementById('set-ik-priv').value = s.ik_private_key || '';
    document.getElementById('set-cf-zone').value = s.cf_zone_id || '';
    document.getElementById('set-cf-token').value = s.cf_api_token || '';
    document.getElementById('set-blog-tpl').value = s.blog_template || '';
    document.getElementById('set-article-tpl').value = s.article_template || '';
    document.getElementById('set-page-tpl').value = s.page_template || '';
    
    // ✅ NEW: Load nilai template baru (header, post_card, footer)
    document.getElementById('set-header-tpl').value = s.header_template || '';
    document.getElementById('set-postcard-tpl').value = s.post_card_template || '';
    document.getElementById('set-footer-tpl').value = s.footer_template || '';
  }
  applyRoleUI(); lucide.createIcons();
}

function wrapText(id, openTag, closeTag = '') { const f = document.getElementById(id); if (!f) return; if (f.selectionStart || f.selectionStart === 0) { let s = f.selectionStart, e = f.selectionEnd; let selectedText = f.value.substring(s, e); f.value = f.value.substring(0, s) + openTag + selectedText + closeTag + f.value.substring(e); f.focus(); f.selectionStart = s + openTag.length; f.selectionEnd = s + openTag.length + selectedText.length; } else { f.value += openTag + closeTag; f.focus(); } }
document.getElementById('pg-title').addEventListener('input', function() { if(document.getElementById('pg-is-edit').value === 'false') document.getElementById('pg-slug').value = formatToSlug(this.value); });
document.getElementById('pt-title').addEventListener('input', function() { if(document.getElementById('pt-is-edit').value === 'false') document.getElementById('pt-slug').value = formatToSlug(this.value); });
function openPageModal() { document.getElementById('form-page').reset(); document.getElementById('pg-is-edit').value = 'false'; document.getElementById('pg-id').value = ''; document.getElementById('modal-page').classList.remove('hidden'); }
function openPostModal() { document.getElementById('form-post').reset(); document.getElementById('pt-is-edit').value = 'false'; document.getElementById('pt-id').value = ''; document.getElementById('modal-post').classList.remove('hidden'); setTimeout(() => { initSummernote(); $('#pt-content').summernote('code', ''); setTimeout(() => $('#pt-content').summernote('focus'), 100); }, 150); }
function closeModal(id) { if(id === 'modal-post' && isSummernoteInitialized) { $('#pt-content').summernote('destroy'); isSummernoteInitialized = false; } document.getElementById(id).classList.add('hidden'); }
async function editPost(id) { showToast('Memuat konten artikel...', 'warning'); try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_post_by_id', id: id }) }); const r = await res.json(); if (r.status !== 'success') throw new Error(r.message); const p = r.data; document.getElementById('pt-id').value = p.id; document.getElementById('pt-slug').value = p.slug; document.getElementById('pt-title').value = p.title; document.getElementById('pt-category').value = p.category; document.getElementById('pt-image').value = p.image; setTimeout(() => { initSummernote(); $('#pt-content').summernote('code', p.content || ''); document.getElementById('pt-is-edit').value = 'true'; document.getElementById('modal-post').classList.remove('hidden'); setTimeout(() => $('#pt-content').summernote('focus'), 100); }, 150); } catch (err) { showToast('Gagal memuat artikel: ' + err.message, 'error'); } }
async function editPage(id) { showToast('Memuat konten halaman...', 'warning'); try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_page_by_id', id: id }) }); const r = await res.json(); if (r.status !== 'success') throw new Error(r.message); const p = r.data; document.getElementById('pg-id').value = p.id; document.getElementById('pg-slug').value = p.slug; document.getElementById('pg-title').value = p.title; document.getElementById('pg-content').value = p.content; document.getElementById('pg-is-edit').value = 'true'; document.getElementById('modal-page').classList.remove('hidden'); } catch (err) { showToast('Gagal memuat halaman: ' + err.message, 'error'); } }
async function deletePost(id) { if(!confirm("Yakin hapus artikel?")) return; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: 'delete_post', id: id}) }); const d = await res.json(); if(d.status === 'success') { showToast('Terhapus!', 'success'); await fetchAllAdminData(); } } catch(e) {} }
async function deletePage(id) { if(!confirm("Yakin hapus halaman?")) return; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: 'delete_page', id: id}) }); const d = await res.json(); if(d.status === 'success') { showToast('Terhapus!', 'success'); await fetchAllAdminData(); } } catch(e) {} }
document.getElementById('form-post').onsubmit = async (e) => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const ori = btn.innerHTML; btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROSES...</span>'; btn.disabled = true; const userId = getUserId(); if (!userId && !isAdmin()) { showToast('Error: User ID tidak ditemukan', 'error'); btn.innerHTML = ori; btn.disabled = false; return; } let currentSlug = document.getElementById('pt-slug').value || formatToSlug(document.getElementById('pt-title').value); let uniqueSlug = await generateUniqueSlugAsync(currentSlug, 'posts', document.getElementById('pt-id').value); document.getElementById('pt-slug').value = uniqueSlug; let id = document.getElementById('pt-id').value || generateUniqueId('POST'); const content = $('#pt-content').summernote('code'); const p = { action: 'save_post', id: id, slug: uniqueSlug, title: document.getElementById('pt-title').value, category: document.getElementById('pt-category').value, image: document.getElementById('pt-image').value, content: content, is_edit: document.getElementById('pt-is-edit').value === 'true', id_user: userId }; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) }); const d = await res.json(); if(d.status === 'success') { closeModal('modal-post'); showToast('Artikel Tersimpan!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); } } catch(err) { showToast('Koneksi error', 'error'); } finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); } };
document.getElementById('form-page').onsubmit = async (e) => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const ori = btn.innerHTML; btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROSES...</span>'; btn.disabled = true; const userId = getUserId(); if (!userId && !isAdmin()) { showToast('Error: User ID tidak ditemukan', 'error'); btn.innerHTML = ori; btn.disabled = false; return; } let currentSlug = document.getElementById('pg-slug').value || formatToSlug(document.getElementById('pg-title').value); let uniqueSlug = await generateUniqueSlugAsync(currentSlug, 'pages', document.getElementById('pg-id').value); document.getElementById('pg-slug').value = uniqueSlug; let id = document.getElementById('pg-id').value || generateUniqueId('PAGE'); const p = { action: 'save_page', id: id, slug: uniqueSlug, title: document.getElementById('pg-title').value, content: document.getElementById('pg-content').value, is_edit: document.getElementById('pg-is-edit').value === 'true', id_user: userId }; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) }); const d = await res.json(); if(d.status === 'success') { closeModal('modal-page'); showToast('Halaman Tersimpan!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); } } catch(err) { showToast('Koneksi error', 'error'); } finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); } };
function openUserModal() { document.getElementById('form-user').reset(); document.getElementById('usr-is-edit').value = 'false'; document.getElementById('usr-id').value = ''; document.getElementById('modal-user').classList.remove('hidden'); }
function editUser(id) { const u = cachedUsers.find(x => x[4] === id); if(!u) return; document.getElementById('usr-id').value = u[4]; document.getElementById('usr-email').value = u[0]; document.getElementById('usr-name').value = u[2]; document.getElementById('usr-role').value = u[3]; document.getElementById('usr-pass').value = ''; document.getElementById('usr-is-edit').value = 'true'; document.getElementById('modal-user').classList.remove('hidden'); }
async function deleteUser(id) { if(!confirm("Yakin hapus user ini?")) return; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: 'delete_user', id: id}) }); const d = await res.json(); if(d.status === 'success') { showToast('User dihapus!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); } } catch(e) { showToast('Koneksi error', 'error'); } }
document.getElementById('form-user').onsubmit = async (e) => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const ori = btn.innerHTML; btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROSES...</span>'; btn.disabled = true; const id = document.getElementById('usr-id').value || generateUniqueId('USER'); const p = { action: 'save_user', id: id, email: document.getElementById('usr-email').value, name: document.getElementById('usr-name').value, password: document.getElementById('usr-pass').value, role: document.getElementById('usr-role').value, is_edit: document.getElementById('usr-is-edit').value === 'true' }; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) }); const d = await res.json(); if(d.status === 'success') { closeModal('modal-user'); showToast('User Tersimpan!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); } } catch(err) { showToast('Koneksi error', 'error'); } finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); } };
async function submitSettings(formId, p, msg) { const form = document.getElementById(formId); const btn = form.querySelector('button[type="submit"]'); const oriText = btn.innerHTML; btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> MENYIMPAN...</span>'; btn.disabled = true; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'update_settings', payload: p }) }); const d = await res.json(); if(d.status === 'success') { showToast(msg, 'success'); await fetchAllAdminData(); } else showToast('Gagal menyimpan', 'error'); } catch(err) { showToast('Koneksi terputus', 'error'); } finally { btn.innerHTML = oriText; btn.disabled = false; lucide.createIcons(); } }
document.getElementById('form-branding').onsubmit = async (e) => { e.preventDefault(); const p = { site_name: document.getElementById('set-site-name').value, site_tagline: document.getElementById('set-site-tagline').value, site_logo: document.getElementById('set-logo').value, site_favicon: document.getElementById('set-favicon').value, home_page: document.getElementById('set-home-page').value, blog_slug: document.getElementById('set-blog-slug').value, category_slug: document.getElementById('set-category-slug').value }; await submitSettings('form-branding', p, 'Branding & Beranda Berhasil Diupdate!'); };
document.getElementById('form-seo').onsubmit = async (e) => { e.preventDefault(); const p = { google_site_verification: document.getElementById('set-google-verify').value, bing_site_verification: document.getElementById('set-bing-verify').value }; await submitSettings('form-seo', p, 'Kode Verifikasi SEO Diupdate!'); };
document.getElementById('form-config-files').onsubmit = async (e) => { e.preventDefault(); const p = { robots_txt: document.getElementById('set-robots-txt').value, ads_txt: document.getElementById('set-ads-txt').value }; await submitSettings('form-config-files', p, 'File Konfigurasi Tersimpan!'); };
document.getElementById('form-sys').onsubmit = async (e) => { e.preventDefault(); const p = { ik_public_key: document.getElementById('set-ik-pub').value, ik_private_key: document.getElementById('set-ik-priv').value, ik_endpoint: document.getElementById('set-ik-end').value, cf_zone_id: document.getElementById('set-cf-zone').value, cf_api_token: document.getElementById('set-cf-token').value }; await submitSettings('form-sys', p, 'Integrasi API Tersimpan!'); };
document.getElementById('form-templates').onsubmit = async (e) => { 
  e.preventDefault(); 
  const p = { 
    blog_template: document.getElementById('set-blog-tpl').value, 
    article_template: document.getElementById('set-article-tpl').value, 
    category_template: document.getElementById('set-category-tpl').value, 
    page_template: document.getElementById('set-page-tpl').value,
    // ✅ NEW: Tambahkan 3 template baru
    header_template: document.getElementById('set-header-tpl').value,
    post_card_template: document.getElementById('set-postcard-tpl').value,
    footer_template: document.getElementById('set-footer-tpl').value
  }; 
  await submitSettings('form-templates', p, 'Tema / Template Blog Tersimpan!'); 
};

async function runImageKitUpload(file, onLoading, onSuccess, onError) { if(!IK_PUB || IK_PUB.length < 5) return onError('ImageKit Public Key belum disetting!'); onLoading(); const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = async () => { const base64 = reader.result.split(',')[1]; try { const sigRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_ik_auth' }) }); const sigData = await sigRes.json(); if(sigData.status !== 'success') throw new Error(sigData.message); const formData = new FormData(); formData.append('file', base64); formData.append('publicKey', IK_PUB); formData.append('signature', sigData.data.signature); formData.append('expire', sigData.data.expire); formData.append('token', sigData.data.token); formData.append('fileName', file.name.replace(/[^a-zA-Z0-9.]/g, '-')); formData.append('folder', '/LARIK-CMS'); const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData }); const uploadData = await uploadRes.json(); if(uploadData.url) onSuccess(uploadData.url); else throw new Error(uploadData.message || 'Unknown error'); } catch(e) { onError('Gagal: ' + e.message); } }; reader.onerror = () => onError('Gagal membaca file'); }
function uploadMedia() { const fileInput = document.getElementById('media-file'); if(!fileInput || !fileInput.files || !fileInput.files.length) return showToast('Pilih gambar dulu!', 'warning'); const file = fileInput.files[0]; const btn = document.getElementById('btn-upload'); const ori = btn.innerHTML; runImageKitUpload(file, () => { btn.innerHTML = '<span class="flex items-center gap-2 animate-spin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></span>'; btn.disabled = true; }, (url) => { if(fileInput) fileInput.value = ''; showToast('Upload sukses!', 'success'); btn.innerHTML = ori; btn.disabled = false; loadMediaGallery(); }, (errText) => { showToast(errText, 'error'); btn.innerHTML = ori; btn.disabled = false; }); }
function directUploadKit(inputEl, targetInputId, btnLabelId) { if(!inputEl || !inputEl.files || !inputEl.files.length) return; const btn = document.getElementById(btnLabelId); const file = inputEl.files[0]; const ori = btn.innerHTML; runImageKitUpload(file, () => { btn.innerHTML = '<svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle></svg>'; btn.classList.add('opacity-50'); }, (url) => { if(safeSetValue(targetInputId, url)) showToast('Thumbnail terupload!', 'success'); btn.innerHTML = ori; btn.classList.remove('opacity-50'); lucide.createIcons(); }, (errText) => { showToast(errText, 'error'); btn.innerHTML = ori; btn.classList.remove('opacity-50'); }); inputEl.value = ''; }
async function loadMediaGallery() { const grid = document.getElementById('media-grid'); const loading = document.getElementById('media-loading'); const empty = document.getElementById('media-empty'); if(!grid) return; grid.innerHTML = ''; if(loading) loading.classList.remove('hidden'); if(empty) empty.classList.add('hidden'); try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_media_list' }) }); const r = await res.json(); if(loading) loading.classList.add('hidden'); if (r.status === 'success' && Array.isArray(r.data) && r.data.length > 0) { grid.innerHTML = r.data.map(media => `<div class="media-card relative bg-slate-50 rounded-xl overflow-hidden border border-slate-100 group cursor-pointer" onclick="insertUrlToEditor('${media.url}')"><div class="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden"><img src="${media.thumbnail || media.url}?tr=w-300,h-300" alt="${media.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onerror="this.src='https://placehold.co/300x300/e2e8f0/64748b?text=No+Image'"></div><div class="p-3"><p class="text-[11px] font-semibold text-slate-700 truncate" title="${media.name}">${media.name}</p><p class="text-[10px] text-slate-400 mt-0.5">${formatFileSize(media.size)}</p></div><div class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200"><button onclick="event.stopPropagation(); copyLinkFromGallery('${media.url}')" class="p-2 bg-white/95 hover:bg-teal-500 hover:text-white rounded-lg text-teal-600 transition-all shadow-md" title="Copy URL"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>${isAdmin() ? `<button onclick="event.stopPropagation(); deleteMedia('${media.id}')" class="p-2 bg-white/95 hover:bg-rose-500 hover:text-white rounded-lg text-rose-500 transition-all shadow-md media-delete-btn" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}</div></div>`).join(''); } else { if(empty) empty.classList.remove('hidden'); } lucide.createIcons(); } catch (e) { if(loading) loading.classList.add('hidden'); showToast('Gagal memuat galeri', 'error'); } }
function formatFileSize(bytes) { if (!bytes) return '-'; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]; }
function copyLinkFromGallery(url) { navigator.clipboard.writeText(url); showToast('URL disalin!', 'success'); }
async function deleteMedia(fileId) { if (!confirm('Yakin hapus gambar ini?')) return; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_media', fileId: fileId }) }); const r = await res.json(); if (r.status === 'success') { showToast('Gambar dihapus!', 'success'); loadMediaGallery(); } } catch (e) { showToast('Koneksi error', 'error'); } }
function insertUrlToEditor(url) { const postModal = document.getElementById('modal-post'); if (postModal && !postModal.classList.contains('hidden')) { if(safeSetValue('pt-image', url)) showToast('URL thumbnail diterapkan!', 'success'); else { copyLinkFromGallery(url); showToast('URL disalin!', 'success'); } } else { copyLinkFromGallery(url); showToast('URL disalin!', 'success'); } }

// ==========================================
// ✅ THEMES LOGIC - FULLY FIXED ✅
// ==========================================

// 🔧 FIX: Domain premium dipisah koma, free dipisah titik koma
function checkDomainAuthorization(domainString) { 
  if (!domainString) return false; 
  try { 
    const currentHost = window.location.hostname.replace('www.', '').trim();
    // ✅ Premium: koma, Free: titik koma
    const allowedDomains = domainString.split(/[;,]/).map(d => d.trim().replace('www.', '').replace(/\/$/, ''));
    return allowedDomains.includes(currentHost); 
  } catch(e) { return false; } 
}

function checkIfActive(articleTpl, blogTpl, pageTpl) { try { const currentArticle = document.getElementById('set-article-tpl').value || ''; const currentBlog = document.getElementById('set-blog-tpl').value || ''; const currentPage = document.getElementById('set-page-tpl').value || ''; return (articleTpl && currentArticle === articleTpl) || (blogTpl && currentBlog === blogTpl) || (pageTpl && currentPage === pageTpl); } catch(e) { return false; } }

// 🔧 FIX: Auto-save template + homepage ke Settings sheet
async function saveTemplatesAutomatically(template) {
  if (!template) return false;
  const payload = {
    article_template: template.article || '',
    blog_template: template.blog || '',
    page_template: template.page || '',
    category_template: template.category || '',
    home_page: template.home || '',
    // ✅ NEW: Tambahkan 3 template baru dari objek theme
    header_template: template.header || '',
    post_card_template: template.postcard || '',
    footer_template: template.footer || ''
  };
  try {
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'update_settings', payload: payload }) });
    return true;
  } catch (e) { console.warn('Auto-save template failed:', e); return false; }
}

// 🔧 FIX: Tutup modal + simpan pakai referensi langsung
async function closeThemeInstructionAndSave() {
  if (activeThemeRef) {
    await saveTemplatesAutomatically(activeThemeRef);
    showToast('Template berhasil disimpan ke Pengaturan!', 'success');
    activeThemeRef = null;
  }
  closeModal('modal-theme-instruction');
  isTemplateBeingApplied = false;
}

async function loadThemes() {
  const grid = document.getElementById('theme-grid'); const loading = document.getElementById('theme-loading');
  if(!grid) return; grid.innerHTML = ''; if(loading) loading.classList.remove('hidden');
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID_THEMES}/gviz/tq?tqx=out:json&sheet=Template`;
  try {
    const res = await fetch(url); const text = await res.text();
    const jsonStart = text.indexOf('{'); const jsonEnd = text.lastIndexOf('}');
    const json = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    const rows = json.table?.rows || []; themesData = [];
    if (rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const getVal = (idx) => (row.c && row.c[idx] && row.c[idx].v != null) ? String(row.c[idx].v) : '';
        const name = getVal(0) || 'Tanpa Nama'; const img = getVal(2) || 'https://placehold.co/600x400/e2e8f0/94a3b8?text=No+Preview';
        const type = (getVal(7)).toLowerCase() || 'free'; const idTemplate = getVal(11);
        const description = getVal(12) || (type === 'free' ? 'Tema gratis siap pakai.' : 'Tema premium eksklusif.');
        
        // ✅ Mapping sesuai struktur sheet: Kolom P (index 15) = set_home
        const templateObj = {
          name, demo: getVal(1), img,
          article: getVal(3), blog: getVal(4), page: getVal(5), category: getVal(6),
          type, domains: getVal(8), price: getVal(9), waLinkRaw: getVal(10), idTemplate, description,
          formatSheet: getVal(13), scriptGs: getVal(14),
          home: getVal(15),
          // ✅ NEW: Mapping 3 template baru dari sheet Template (index 17,18,19 = Kolom R,S,T)
          header: getVal(16),        // Kolom R: header_template
          postcard: getVal(17),      // Kolom S: post_card_template  
          footer: getVal(18)         // Kolom T: footer_template
        };
        themesData.push(templateObj);
        
        const isAuthorized = type === 'free' || checkDomainAuthorization(getVal(8));
        const isActive = checkIfActive(getVal(3), getVal(4), getVal(5));
        let buttonHtml = isActive ? `<button disabled class="w-full bg-slate-100 text-slate-500 text-xs py-3 rounded-xl font-bold flex items-center justify-center gap-2"><i data-lucide="check" class="w-4 h-4"></i> Tema Saat Ini</button>` : (isAuthorized ? `<button onclick="applyTheme(${themesData.length - 1})" class="btn-primary w-full flex items-center justify-center gap-2"><i data-lucide="wand-2" class="w-4 h-4"></i> Pakai Tema</button>` : `<a href="https://wa.me/${getVal(10).replace(/\D/g,'')}?text=Halo, saya ingin beli tema ${name}" target="_blank" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"><i data-lucide="shopping-bag" class="w-4 h-4"></i> Beli (${getVal(9)})</a>`);
        const card = document.createElement('div'); card.className = 'theme-card bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col shadow-sm';
        card.innerHTML = `<div class="relative aspect-video bg-slate-100 overflow-hidden group"><img src="${img}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"><div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4"><a href="${templateObj.demo}" target="_blank" class="bg-white text-teal-700 text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-teal-50 shadow-lg"><i data-lucide="eye" class="w-3 h-3"></i> Preview</a></div></div><div class="p-5 flex-1 flex flex-col"><div class="mb-4"><h3 class="font-black text-slate-800 text-base mb-1">${name}</h3><p class="text-slate-500 text-[11px] leading-relaxed line-clamp-3">${description}</p></div><div class="mt-auto">${buttonHtml}</div></div>`;
        grid.appendChild(card);
      }
    }
    lucide.createIcons();
  } catch (err) { console.error('Load Themes Error:', err); } finally { if(loading) loading.classList.add('hidden'); }
}
function loadAllThemes() { loadThemes(); }

// 🔧 FIX: applyTheme dengan homepage auto-update + referensi langsung
async function applyTheme(index) {
  const template = themesData[index]; if (!template) return;
  activeThemeRef = template; // ✅ SIMPAN REFERENSI LANGSUNG
  isTemplateBeingApplied = true;
  
  const progressOverlay = document.createElement('div'); progressOverlay.id = 'theme-progress-overlay';
  progressOverlay.className = 'fixed inset-0 bg-slate-900/80 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm transition-all duration-300';
  progressOverlay.innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center"><svg class="w-10 h-10 animate-spin text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><h3 class="text-lg font-black text-slate-800 mb-1">Memproses Tema</h3><p id="theme-progress-text" class="text-sm text-slate-500 font-medium">Menerapkan konfigurasi blog...</p><div class="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden"><div id="theme-progress-bar" class="bg-teal-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div></div></div>`;
  document.body.appendChild(progressOverlay);
  
  ['set-article-tpl', 'set-blog-tpl', 'set-page-tpl', 'set-category-tpl', 'set-header-tpl', 'set-postcard-tpl', 'set-footer-tpl'].forEach(id => { document.getElementById(id)?.classList.add('template-loading'); });
  
  // ✅ Set nilai ke textarea UI
  document.getElementById('set-article-tpl').value = template.article || '';
  document.getElementById('set-blog-tpl').value = template.blog || '';
  document.getElementById('set-page-tpl').value = template.page || '';
  document.getElementById('set-category-tpl').value = template.category || '';
  // ✅ NEW: Set nilai template baru
  document.getElementById('set-header-tpl').value = template.header || '';
  document.getElementById('set-postcard-tpl').value = template.postcard || '';
  document.getElementById('set-footer-tpl').value = template.footer || '';
  
  // ✅ SET HOMEPAGE DROPDOWN DARI KOLOM P (set_home)
  if (template.home) {
    document.getElementById('set-home-page').value = template.home;
  }
  
  setTimeout(() => { ['set-article-tpl', 'set-blog-tpl', 'set-page-tpl', 'set-category-tpl', 'set-header-tpl', 'set-postcard-tpl', 'set-footer-tpl'].forEach(id => { document.getElementById(id)?.classList.remove('template-loading'); }); }, 300);
  
  const progressText = document.getElementById('theme-progress-text'); const progressBar = document.getElementById('theme-progress-bar');
  
  if (template.idTemplate) {
    try {
      progressText.innerText = 'Mengambil data landing pages...'; progressBar.style.width = '10%';
      const urlLanding = `https://docs.google.com/spreadsheets/d/${SHEET_ID_THEMES}/gviz/tq?tqx=out:json&sheet=tema_landing`;
      const res = await fetch(urlLanding);
      if(res.ok) {
        const text = await res.text(); const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const json = JSON.parse(jsonStr); const rows = json.table?.rows || [];
        const matches = rows.filter(r => r.c && r.c[9] && String(r.c[9].v) === String(template.idTemplate));
        if (matches.length > 0) {
          let successCount = 0; const totalMatches = matches.length;
          for (let i = 0; i < totalMatches; i++) {
            const match = matches[i]; const lName = (match.c[0] && match.c[0].v != null) ? String(match.c[0].v) : '';
            progressText.innerText = `Mengimpor halaman ${i + 1} dari ${totalMatches}...`;
            progressBar.style.width = `${10 + ((i / totalMatches) * 90)}%`;
            const lSlugBase = (match.c[1] && match.c[1].v != null) ? String(match.c[1].v) : formatToSlug(lName);
            const lContent = (match.c[4] && match.c[4].v != null) ? String(match.c[4].v) : '';
            const pageId = generateUniqueId('LANDING'); const uniqueSlug = await generateUniqueSlugAsync(lSlugBase, 'pages');
            const pageData = { action: 'save_page', id: pageId, slug: uniqueSlug, title: lName, content: lContent, is_edit: false, id_user: getUserId() };
            const saveRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify(pageData) });
            const saveStatus = await saveRes.json(); if(saveStatus.status === 'success') successCount++;
          }
          progressBar.style.width = '100%';
          if (successCount > 0) { showToast(`${successCount} Landing Page otomatis dibuat!`, 'success'); setTimeout(() => { fetchAllAdminData(); }, 1000); }
        }
      }
    } catch (e) { console.warn("Gagal sinkronisasi landing page otomatis:", e); }
  }
  
  const hasSheet = template.formatSheet && template.formatSheet.trim() !== ''; const hasScript = template.scriptGs && template.scriptGs.trim() !== '';
  if (hasSheet || hasScript) {
    const instrContent = document.getElementById('theme-instruction-content'); let htmlContent = '';
    currentFormatSheetToSetup = template.formatSheet || '';
    if (hasSheet) { htmlContent += `<div class="p-4 bg-teal-50 border border-teal-100 rounded-xl mb-4"><p class="font-bold text-teal-800 mb-2 flex items-center gap-2"><i data-lucide="database" class="w-4 h-4"></i> 1. Auto-Setup Database</p><p class="text-teal-700 text-xs mb-3">Tema ini butuh struktur Sheet (Tabel) khusus. Klik tombol di bawah untuk membuatnya otomatis di database Anda.</p><button id="btn-auto-setup" onclick="jalankanAutoSetupTema()" class="btn-primary w-full flex items-center justify-center gap-2 text-xs"><i data-lucide="zap" class="w-4 h-4"></i> Setup Database Otomatis</button></div>`; }
    if (hasScript) { const safeCode = template.scriptGs.replace(/</g, "&lt;").replace(/>/g, "&gt;"); htmlContent += `<div class="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4"><div class="flex justify-between items-center mb-2"><p class="font-bold text-slate-800 flex items-center gap-2 text-sm"><i data-lucide="code" class="w-4 h-4"></i> ${hasSheet ? '2' : '1'}. Tambahkan Script (.gs)</p><button onclick="copyScriptGs()" class="text-xs bg-slate-200 hover:bg-teal-500 hover:text-white text-slate-600 px-3 py-1.5 rounded transition-colors font-bold flex items-center gap-1" id="btn-copy-script"><i data-lucide="copy" class="w-3 h-3"></i> Copy Code</button></div><p class="text-slate-500 text-[11px] mb-3">Buka file Google Sheets Anda > klik <b>Ekstensi</b> > <b>Apps Script</b>. Buat file baru (contoh: <code>tema.gs</code>), lalu paste kode di bawah ini: <a href="https://larik.web.id/panduan" style="font-size:12px; padding:4px 10px; background:#6366f1; color:#fff; border-radius:999px; text-decoration:none; display:inline-block;">Lihat Panduan</a></p><div class="relative"><textarea id="raw-script-code" class="hidden">${template.scriptGs}</textarea><pre class="bg-slate-800 text-teal-400 p-4 rounded-lg text-[11px] overflow-x-auto font-mono custom-scroll max-h-56">${safeCode}</pre></div></div>`; }
    instrContent.innerHTML = htmlContent; progressOverlay.style.opacity = '0'; setTimeout(() => progressOverlay.remove(), 300);
    document.getElementById('modal-theme-instruction').classList.remove('hidden'); lucide.createIcons();
  } else {
    // ✅ Auto-save langsung jika tidak perlu setup (termasuk homepage + 3 template baru)
    await saveTemplatesAutomatically(template);
    progressOverlay.style.opacity = '0'; setTimeout(() => progressOverlay.remove(), 300);
    showToast('Kode tema blog berhasil dimasukkan & disimpan ke Settings!', 'success');
    activeThemeRef = null;
    isTemplateBeingApplied = false;
  }
  
  switchTab('settings');
  setTimeout(() => { const el = document.getElementById('form-templates'); if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-teal-400', 'ring-offset-4', 'rounded-2xl'); setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400', 'ring-offset-4'), 2500); } }, 300);
}

async function jalankanAutoSetupTema() { const btn = document.getElementById('btn-auto-setup'); if(!btn || !currentFormatSheetToSetup) return; const oriBtnText = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Memproses Database...'; btn.disabled = true; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'auto_setup_tabs_dynamic', setupData: currentFormatSheetToSetup }) }); const d = await res.json(); if(d.status === 'success') { showToast('Database berhasil disetup!', 'success'); btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Setup Berhasil'; btn.classList.replace('btn-primary', 'bg-teal-500'); btn.classList.add('text-white', 'pointer-events-none'); } else { showToast('Gagal: ' + d.message, 'error'); btn.innerHTML = oriBtnText; btn.disabled = false; } } catch(e) { showToast('Koneksi API Error', 'error'); btn.innerHTML = oriBtnText; btn.disabled = false; } lucide.createIcons(); }
function copyScriptGs() { const code = document.getElementById('raw-script-code').value; navigator.clipboard.writeText(code).then(() => { const btn = document.getElementById('btn-copy-script'); const originalText = btn.innerHTML; btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Copied!'; btn.classList.replace('bg-slate-200', 'bg-teal-500'); btn.classList.replace('text-slate-600', 'text-white'); lucide.createIcons(); setTimeout(() => { btn.innerHTML = originalText; btn.classList.replace('bg-teal-500', 'bg-slate-200'); btn.classList.replace('text-white', 'text-slate-600'); lucide.createIcons(); }, 2000); }); }

function initSummernote() { if(isSummernoteInitialized) return; $('#pt-content').summernote({ height: 350, toolbar: [['style', ['style']], ['font', ['bold', 'italic', 'underline', 'strikethrough', 'clear']], ['fontsize', ['fontsize']], ['color', ['color']], ['para', ['ul', 'ol', 'paragraph', 'height']], ['table', ['table']], ['insert', ['link', 'video', 'hr']], ['view', ['fullscreen', 'codeview', 'help']]], styleWithCSS: true, dialogsInBody: true, followingToolbar: false, placeholder: 'Tulis konten artikel di sini...', callbacks: { onInit: function() { $('.note-editable').css({ 'font-family': "'Plus Jakarta Sans', sans-serif", 'line-height': '1.7', 'color': '#0f172a' }); if(!document.getElementById('summernote-visual-styles')) { $('<style id="summernote-visual-styles">').html(`.note-editable h1 { font-size: 2em; font-weight: 800; color: #0f172a; margin: 0.67em 0; border-left: 4px solid #0d9488; padding-left: 12px; background: linear-gradient(135deg, rgba(13,148,136,0.08), transparent); border-radius: 0 8px 8px 0; }.note-editable h2 { font-size: 1.5em; font-weight: 700; color: #1e293b; margin: 0.75em 0; border-left: 3px solid #14b8a6; padding-left: 10px; }.note-editable h3 { font-size: 1.25em; font-weight: 600; color: #334155; margin: 0.83em 0; border-left: 2px solid #22d3ee; padding-left: 8px; }.note-editable ul { list-style-type: disc; margin: 1em 0; padding-left: 24px; }.note-editable ol { list-style-type: decimal; margin: 1em 0; padding-left: 24px; }.note-editable blockquote { border-left: 4px solid #94a3b8; padding: 12px 16px; background: #f8fafc; margin: 1em 0; font-style: italic; border-radius: 0 8px 8px 0; }.note-editable pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 13px; }.note-editable img { max-width: 100%; height: auto; border-radius: 12px; margin: 12px 0; box-shadow: var(--shadow-sm); }.note-editable table { width: 100%; border-collapse: collapse; margin: 1em 0; }.note-editable th, .note-editable td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }.note-editable th { background: var(--bg-tertiary); font-weight: 600; }.note-editable hr { border: 0; border-top: 2px dashed var(--border); margin: 2em 0; }`).appendTo('head'); } }, onDialogShown: function($dialog) { setTimeout(() => { const summernoteModal = $dialog.closest('.note-modal'); const backdrops = summernoteModal.find('.modal-backdrop'); if(backdrops.length > 1) backdrops.slice(1).remove(); const mainBackdrop = summernoteModal.siblings('.note-modal-backdrop'); if(mainBackdrop.length) mainBackdrop.css('z-index', '99998'); }, 50); } } }); isSummernoteInitialized = true; }

document.querySelectorAll('.currentYear').forEach(el => el.innerText = new Date().getFullYear());
document.body.classList.add('login-active');
window.onload = () => { lucide.createIcons(); if(sessionStorage.getItem('cms_auth')) init(); };
