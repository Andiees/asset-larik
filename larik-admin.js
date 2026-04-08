
// ==========================================
// CONFIG & GLOBAL STATE
// ==========================================
const API_URL = SCRIPT_URL;
const SHEET_ID_THEMES = '14aZ9CtI8Iydv_vu06pICoStpUvQMqhoIIJI42phKFY8';
const DEFAULT_LIMIT = 20;

// Global state
let cachedPages = [], cachedPosts = [], cachedUsers = [];
let paginationState = { 
  pages: { current: 1, total: 1, limit: DEFAULT_LIMIT }, 
  posts: { current: 1, total: 1, limit: DEFAULT_LIMIT }, 
  users: { current: 1, total: 1, limit: DEFAULT_LIMIT } 
};
let searchState = { pages: '', posts: '', users: '' };
let IK_PUB = '', BLOG_SLUG = 'blog', CURRENT_USER_ID = '', CURRENT_USER_ROLE = 'admin';
let themesData = [], landingThemesData = [], isSummernoteInitialized = false;
let allPagesData = [], allPostsData = [], allUsersData = [];

// ==========================================
// ✅ HELPERS - CRYPTO-GRADE UNIQUE ID + SLUG
// ==========================================

// ✅ Counter global untuk hindari bentrok dalam sesi yang sama
const _idCounter = { val: 0 };

// ✅ Generate ID 100% unik: crypto + microtimestamp + counter
function generateUniqueId(prefix = 'LRK') {
  // 1. Microtimestamp (lebih presisi dari Date.now())
  const microTime = typeof performance !== 'undefined' && performance.now 
    ? Math.floor(performance.now() * 1000) 
    : Date.now() * 1000;
  
  // 2. Crypto random 16 bytes (128-bit entropy)
  const randomBytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    // Fallback: fill dengan random bytes manual
    for (let i = 0; i < 16; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  
  // 3. Convert ke hex string
  const cryptoHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 4. Counter in-memory untuk hindari bentrok dalam milidetik yang sama
  _idCounter.val = (_idCounter.val + 1) % 10000;
  const counter = _idCounter.val.toString().padStart(4, '0');
  
  // 5. Format final: PREFIX-TIMESTAMP-COUNTER-CRYPTO
  return `${prefix}-${microTime}-${counter}-${cryptoHex}`.toUpperCase();
}

// ✅ Generate slug unik dengan cek backend + fallback sequential
async function generateUniqueSlugAsync(baseSlug, sheetType, currentId = null) {
  // 1. Sanitasi slug dasar
  let slug = baseSlug.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .substring(0, 80);
  if (!slug) slug = 'untitled';
  
  // 2. Cek ke backend untuk daftar slug yang sudah ada (source of truth)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'get_existing_slugs',
        sheet: sheetType, // 'pages' atau 'posts'
        currentId: currentId // exclude ID sendiri saat edit
      })
    });
    const r = await res.json();
    
    if (r.status === 'success' && Array.isArray(r.data)) {
      const existingSlugs = new Set(r.data.map(s => s?.toLowerCase()).filter(Boolean));
      
      // 3. Loop cari slug unik dengan append counter
      let uniqueSlug = slug;
      let counter = 1;
      while (existingSlugs.has(uniqueSlug)) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
        if (counter > 999) {
          // Fallback: append timestamp jika counter terlalu tinggi
          uniqueSlug = `${slug}-${Date.now()}`;
          break;
        }
      }
      return uniqueSlug;
    }
  } catch (e) {
    console.warn('Slug check failed, using fallback:', e);
  }
  
  // 4. Fallback: cek cache lokal jika backend error
  const cache = sheetType === 'pages' ? cachedPages : cachedPosts;
  const existingSlugs = cache
    .filter(item => item && item[0] !== currentId)
    .map(item => item[1]?.toLowerCase())
    .filter(s => s);
  
  let uniqueSlug = slug;
  let counter = 1;
  while (existingSlugs.includes(uniqueSlug)) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
    if (counter > 999) { uniqueSlug = `${slug}-${Date.now()}`; break; }
  }
  return uniqueSlug;
}

// ✅ Helper: Debounce untuk hindari spam API saat mengetik slug
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function getUserId() { return CURRENT_USER_ID || sessionStorage.getItem('cms_user_id') || localStorage.getItem('cms_user_id') || ''; }
function isAdmin() { return (CURRENT_USER_ROLE || sessionStorage.getItem('cms_role') || 'admin') === 'admin'; }

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = type === 'error' ? 'x-circle' : (type === 'warning' ? 'alert-circle' : 'check-circle');
  toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i> <span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons({ root: toast });
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 3500);
}

function toggleSidebar() { 
  document.getElementById('sidebar').classList.toggle('open'); 
  document.getElementById('sidebar-overlay').classList.toggle('open'); 
}

function safeSetValue(elementId, value) { 
  const el = document.getElementById(elementId); 
  if (el && typeof el.value !== 'undefined') { el.value = value; return true; } 
  return false; 
}

function safeToggleClass(elementId, className, show) { 
  const el = document.getElementById(elementId); 
  if (el) { if (show) el.classList.remove(className); else el.classList.add(className); return true; } 
  return false; 
}

// ==========================================
// TAB NAVIGATION
// ==========================================
function switchTab(t) {
  if ((t === 'settings' || t === 'themes' || t === 'users') && !isAdmin()) { 
    showToast('Akses ditolak: Hanya admin yang bisa mengakses ini', 'error'); 
    return; 
  }
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  document.getElementById('nav-'+t).classList.add('active');
  
  const titles = { 'pages': 'Pages', 'posts': 'Artikel / Blog', 'media': 'Media', 'settings': 'Pengaturan Web', 'themes': 'Tema Website', 'users': 'Manajemen Users' };
  document.getElementById('tab-title').innerText = titles[t];
  
  if(window.innerWidth < 768) toggleSidebar();
  
  if (t === 'media' && sessionStorage.getItem('cms_auth')) loadMediaGallery();
  if (t === 'themes' && sessionStorage.getItem('cms_auth')) loadAllThemes();
  if (t === 'posts' && sessionStorage.getItem('cms_auth')) {
    paginationState.posts.current = 1;
    renderPostsTable();
  }
  if (t === 'pages' && sessionStorage.getItem('cms_auth')) {
    paginationState.pages.current = 1;
    renderPagesTable();
  }
  if (t === 'users' && sessionStorage.getItem('cms_auth') && isAdmin()) {
    paginationState.users.current = 1;
    renderUsersTable();
  }
}

// ==========================================
// LOGIN & INIT
// ==========================================
document.getElementById('form-login').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const oriText = btn.innerHTML;
  btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> MEMPROSES...</span>';
  btn.disabled = true;
  
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin_login', email: document.getElementById('adm-email').value, password: document.getElementById('adm-pass').value })});
    const r = await res.json();
    if(r.status === 'success') {
      sessionStorage.setItem('cms_auth', 'true');
      sessionStorage.setItem('cms_name', r.data.nama);
      if(r.data.id_user) { sessionStorage.setItem('cms_user_id', r.data.id_user); CURRENT_USER_ID = r.data.id_user; }
      if(r.data.role) { sessionStorage.setItem('cms_role', r.data.role); CURRENT_USER_ROLE = r.data.role; } else { sessionStorage.setItem('cms_role', 'admin'); CURRENT_USER_ROLE = 'admin'; }
      showToast('Berhasil Login!', 'success');
      await init();
    } else { showToast(r.message, 'error'); btn.innerHTML = oriText; btn.disabled = false; }
  } catch (err) { showToast('Error Koneksi API!', 'error'); btn.innerHTML = oriText; btn.disabled = false; }
};

function applyRoleUI() {
  const role = CURRENT_USER_ROLE || sessionStorage.getItem('cms_role') || 'admin';
  const badge = document.getElementById('admin-role-badge');
  if (badge) { badge.textContent = role === 'admin' ? 'Admin' : 'Author'; badge.className = `role-badge ${role}`; }
  document.body.classList.remove('role-admin', 'role-author');
  document.body.classList.add(`role-${role}`);
  if (role !== 'admin') {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && (activeTab.id === 'tab-settings' || activeTab.id === 'tab-themes' || activeTab.id === 'tab-users')) { switchTab('pages'); }
  }
}

// ✅ ULTRA-OPTIMIZED: Fetch data dengan server-side pagination
async function fetchAllAdminData() {
  try {
    const res = await fetch(API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ 
        action: 'get_admin_data',
        params: {
          role: CURRENT_USER_ROLE || 'admin',
          id_user: getUserId(),
          limit: DEFAULT_LIMIT,
          offset: 0,
          sortBy: 'date',
          sortOrder: 'desc'
        }
      }) 
    });
    const r = await res.json();
    
    if (r.status === 'success' && r.data) {
      cachedPages = r.data.pages?.items || [];
      cachedPosts = r.data.posts?.items || [];
      cachedUsers = r.data.users?.items || [];
      
      paginationState.pages = r.data.pages?.pagination || { total: 0, currentPage: 1, totalPages: 1, limit: DEFAULT_LIMIT, offset: 0, hasNext: false, hasPrev: false };
      paginationState.posts = r.data.posts?.pagination || { total: 0, currentPage: 1, totalPages: 1, limit: DEFAULT_LIMIT, offset: 0, hasNext: false, hasPrev: false };
      paginationState.users = r.data.users?.pagination || { total: 0, currentPage: 1, totalPages: 1, limit: DEFAULT_LIMIT, offset: 0, hasNext: false, hasPrev: false };
      
      renderPagesTable();
      renderPostsTable();
      renderUsersTable();
      
      if (r.data.settings) renderUI({ settings: r.data.settings });
      
      return true;
    }
    return false;
  } catch (err) { 
    console.error('Fetch Admin Data Error:', err); 
    showToast('Gagal memuat data dari server', 'error'); 
    return false;
  }
}

async function init() {
  if(!sessionStorage.getItem('cms_auth')) return;
  document.body.classList.remove('login-active');
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('admin-main').style.display = 'flex';
  
  CURRENT_USER_ID = sessionStorage.getItem('cms_user_id') || '';
  CURRENT_USER_ROLE = sessionStorage.getItem('cms_role') || 'admin';
  
  document.getElementById('admin-name').innerHTML = `<div class="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">${(sessionStorage.getItem('cms_name')||'A')[0].toUpperCase()}</div> ${sessionStorage.getItem('cms_name')}`;
  
  await fetchAllAdminData();
}

function forceSync() { 
  showToast('Menyegarkan data server...', 'warning'); 
  init(); 
}

function logout() { 
  sessionStorage.clear(); 
  CURRENT_USER_ID = ''; 
  CURRENT_USER_ROLE = 'admin'; 
  location.reload(); 
}

// ==========================================
// RENDER TABLES WITH PAGINATION
// ==========================================
function renderPagesTable() {
  const { total, currentPage, totalPages, limit } = paginationState.pages;
  
  document.getElementById('count-pages').innerText = total;
  document.getElementById('info-pages-page').innerText = `Halaman ${currentPage || 1} dari ${totalPages || 1}`;
  
  document.getElementById('list-pages').innerHTML = cachedPages.length ? cachedPages.map(p => `
    <tr class="group"><td class="font-bold text-slate-800">${p[2]||''}</td><td class="font-mono text-teal-600 text-sm">/${p[1]||''}</td><td class="text-slate-500 text-xs">${p[4]||'-'}</td><td class="text-right"><div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="window.open('/${p[1]||''}', '_blank')" class="action-btn view" title="Lihat"><i data-lucide="external-link" class="w-4 h-4"></i></button><button onclick="editPage('${p[0]||''}')" class="action-btn edit" title="Edit"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deletePage('${p[0]||''}')" class="action-btn delete" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>
  `).join('') : `<tr><td colspan="4" class="text-center text-slate-400 py-12 italic font-medium">Tidak ada halaman ditemukan.</td></tr>`;
  
  document.getElementById('nav-pages-page').innerHTML = `
    <button onclick="changePage('pages', ${currentPage - 1})" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
    <button onclick="changePage('pages', ${currentPage + 1})" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
  `;
  lucide.createIcons();
}

function renderPostsTable() {
  const { total, currentPage, totalPages, limit } = paginationState.posts;
  
  document.getElementById('count-posts').innerText = total;
  document.getElementById('info-posts-page').innerText = `Halaman ${currentPage || 1} dari ${totalPages || 1}`;
  
  document.getElementById('list-posts').innerHTML = cachedPosts.length ? cachedPosts.map(p => `
    <tr class="group"><td><div class="font-bold text-slate-800 line-clamp-2">${p[2]||''}</div><div class="text-[10px] font-mono text-teal-500 mt-1">/${BLOG_SLUG}/${p[1]||''}</div></td><td><span class="bg-slate-100 px-3 py-1.5 rounded-full text-[10px] font-semibold text-slate-600 border border-slate-200">${p[3]||'-'}</span></td><td class="text-slate-500 text-xs">${p[6]||'-'}</td><td class="text-right"><div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="window.open('/${BLOG_SLUG}/${p[1]||''}', '_blank')" class="action-btn view" title="Lihat"><i data-lucide="external-link" class="w-4 h-4"></i></button><button onclick="editPost('${p[0]||''}')" class="action-btn edit" title="Edit"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deletePost('${p[0]||''}')" class="action-btn delete" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>
  `).join('') : `<tr><td colspan="4" class="text-center text-slate-400 py-12 italic font-medium">Tidak ada artikel ditemukan.</td></tr>`;
  
  document.getElementById('nav-posts-page').innerHTML = `
    <button onclick="changePage('posts', ${currentPage - 1})" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
    <button onclick="changePage('posts', ${currentPage + 1})" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
  `;
  lucide.createIcons();
}

function renderUsersTable() {
  if (!isAdmin()) return;
  const { total, currentPage, totalPages, limit } = paginationState.users;
  
  document.getElementById('count-users').innerText = total;
  document.getElementById('info-users-page').innerText = `Halaman ${currentPage || 1} dari ${totalPages || 1}`;
  
  document.getElementById('list-users').innerHTML = cachedUsers.length ? cachedUsers.map(u => `
    <tr class="group"><td class="font-bold text-slate-800">${u[2]||''}</td><td class="text-slate-600 text-sm">${u[0]||''}</td><td><span class="role-badge ${u[3]==='admin'?'admin':'author'}">${u[3]||''}</span></td><td class="font-mono text-xs text-slate-500">${u[4]||'-'}</td><td class="text-right"><div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="editUser('${u[4]||''}')" class="action-btn edit" title="Edit"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deleteUser('${u[4]||''}')" class="action-btn delete" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>
  `).join('') : `<tr><td colspan="5" class="text-center text-slate-400 py-12 italic font-medium">Tidak ada user ditemukan.</td></tr>`;
  
  document.getElementById('nav-users-page').innerHTML = `
    <button onclick="changePage('users', ${currentPage - 1})" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
    <button onclick="changePage('users', ${currentPage + 1})" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
  `;
  lucide.createIcons();
}

// ✅ CHANGE PAGE - Fetch from backend
async function changePage(type, page) {
  if (page < 1) return;
  
  showToast('Memuat halaman...', 'warning');
  
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'get_admin_data',
        params: {
          role: CURRENT_USER_ROLE || 'admin',
          id_user: getUserId(),
          limit: DEFAULT_LIMIT,
          offset: (page - 1) * DEFAULT_LIMIT,
          sortBy: 'date',
          sortOrder: 'desc',
          search: searchState[type] || ''
        }
      })
    });
    const r = await res.json();
    
    if (r.status === 'success' && r.data) {
      if (type === 'pages') {
        cachedPages = r.data.pages?.items || [];
        paginationState.pages = r.data.pages?.pagination || paginationState.pages;
        renderPagesTable();
      }
      if (type === 'posts') {
        cachedPosts = r.data.posts?.items || [];
        paginationState.posts = r.data.posts?.pagination || paginationState.posts;
        renderPostsTable();
      }
      if (type === 'users' && isAdmin()) {
        cachedUsers = r.data.users?.items || [];
        paginationState.users = r.data.users?.pagination || paginationState.users;
        renderUsersTable();
      }
    }
  } catch (err) {
    showToast('Gagal memuat halaman', 'error');
  }
}

// ✅ SEARCH HANDLERS - Server-side with pagination reset
function handleSearchPages(val) { 
  searchState.pages = val; 
  paginationState.pages.current = 1; 
  fetchAllAdminData(); 
}
function handleSearchPosts(val) { 
  searchState.posts = val; 
  paginationState.posts.current = 1; 
  fetchAllAdminData(); 
}
function handleSearchUsers(val) { 
  searchState.users = val; 
  paginationState.users.current = 1; 
  fetchAllAdminData(); 
}

// ✅ RENDER UI SETTINGS
function renderUI(r) {
  const s = r.settings || {};
  BLOG_SLUG = s.blog_slug || 'blog';
  
  document.getElementById('set-site-name').value = s.site_name || '';
  document.getElementById('set-site-tagline').value = s.site_tagline || '';
  document.getElementById('set-logo').value = s.site_logo || '';
  document.getElementById('set-favicon').value = s.site_favicon || '';
  document.getElementById('set-home-page').innerHTML = '<option value="">-- Bawaan/Home Template --</option>' + (cachedPages.map(p => `<option value="${p[1]}">${p[2]} (/${p[1]})</option>`).join('') || '');
  document.getElementById('set-home-page').value = s.home_page || '';
  document.getElementById('set-blog-slug').value = BLOG_SLUG;
  document.getElementById('set-category-slug').value = s.category_slug || 'category';
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
  
  applyRoleUI();
  lucide.createIcons();
}

// ==========================================
// CRUD MODALS & FUNCTIONS
// ==========================================
function wrapText(id, openTag, closeTag = '') { 
  const f = document.getElementById(id);
  if (!f) return;
  if (f.selectionStart || f.selectionStart === 0) {
    let s = f.selectionStart, e = f.selectionEnd;
    let selectedText = f.value.substring(s, e);
    f.value = f.value.substring(0, s) + openTag + selectedText + closeTag + f.value.substring(e);
    f.focus();
    f.selectionStart = s + openTag.length;
    f.selectionEnd = s + openTag.length + selectedText.length;
  } else { f.value += openTag + closeTag; f.focus(); }
}

// ✅ UPDATED: Async slug generation with debounce + backend check
const debouncedCheckPageSlug = debounce(async function(titleEl) {
  if(document.getElementById('pg-is-edit').value === 'false') {
    const baseSlug = titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const uniqueSlug = await generateUniqueSlugAsync(baseSlug, 'pages');
    document.getElementById('pg-slug').value = uniqueSlug;
  }
}, 500);

const debouncedCheckPostSlug = debounce(async function(titleEl) {
  if(document.getElementById('pt-is-edit').value === 'false') {
    const baseSlug = titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const uniqueSlug = await generateUniqueSlugAsync(baseSlug, 'posts');
    document.getElementById('pt-slug').value = uniqueSlug;
  }
}, 500);

document.getElementById('pg-title').addEventListener('input', function() {
  debouncedCheckPageSlug(this);
});

document.getElementById('pt-title').addEventListener('input', function() {
  debouncedCheckPostSlug(this);
});

function openPageModal() { 
  document.getElementById('form-page').reset(); 
  document.getElementById('pg-is-edit').value = 'false'; 
  document.getElementById('modal-page').classList.remove('hidden'); 
}

function openPostModal() { 
  document.getElementById('form-post').reset(); 
  document.getElementById('pt-is-edit').value = 'false'; 
  document.getElementById('modal-post').classList.remove('hidden'); 
  setTimeout(() => { 
    initSummernote(); 
    $('#pt-content').summernote('code', ''); 
    setTimeout(() => $('#pt-content').summernote('focus'), 100); 
  }, 150); 
}

function closeModal(id) { 
  if(id === 'modal-post' && isSummernoteInitialized) { 
    $('#pt-content').summernote('destroy'); 
    isSummernoteInitialized = false; 
  } 
  document.getElementById(id).classList.add('hidden'); 
}

// ✅ EDIT POST - Fetch full content by ID
async function editPost(id) {
  showToast('Memuat konten artikel...', 'warning');
  
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_post_by_id', id: id })
    });
    const r = await res.json();
    
    if (r.status !== 'success') throw new Error(r.message);
    
    const p = r.data;
    
    document.getElementById('pt-id').value = p.id;
    document.getElementById('pt-slug').value = p.slug;
    document.getElementById('pt-title').value = p.title;
    document.getElementById('pt-category').value = p.category;
    document.getElementById('pt-image').value = p.image;
    
    setTimeout(() => {
      initSummernote();
      $('#pt-content').summernote('code', p.content || '');
      document.getElementById('pt-is-edit').value = 'true';
      document.getElementById('modal-post').classList.remove('hidden');
      setTimeout(() => $('#pt-content').summernote('focus'), 100);
    }, 150);
    
  } catch (err) {
    showToast('Gagal memuat artikel: ' + err.message, 'error');
  }
}

// ✅ EDIT PAGE - Fetch full content by ID
async function editPage(id) {
  showToast('Memuat konten halaman...', 'warning');
  
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_page_by_id', id: id })
    });
    const r = await res.json();
    
    if (r.status !== 'success') throw new Error(r.message);
    
    const p = r.data;
    
    document.getElementById('pg-id').value = p.id;
    document.getElementById('pg-slug').value = p.slug;
    document.getElementById('pg-title').value = p.title;
    document.getElementById('pg-content').value = p.content;
    document.getElementById('pg-is-edit').value = 'true';
    document.getElementById('modal-page').classList.remove('hidden');
    
  } catch (err) {
    showToast('Gagal memuat halaman: ' + err.message, 'error');
  }
}

async function deletePost(id) {
  if(!confirm("Yakin hapus artikel?")) return;
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: 'delete_post', id: id}) });
    const d = await res.json();
    if(d.status === 'success') { showToast('Terhapus!', 'success'); await fetchAllAdminData(); }
  } catch(e) {}
}

async function deletePage(id) {
  if(!confirm("Yakin hapus halaman?")) return;
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: 'delete_page', id: id}) });
    const d = await res.json();
    if(d.status === 'success') { showToast('Terhapus!', 'success'); await fetchAllAdminData(); }
  } catch(e) {}
}

// ✅ SAVE POST - with crypto-grade unique ID
document.getElementById('form-post').onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const ori = btn.innerHTML;
  btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROSES...</span>';
  btn.disabled = true;
  
  const userId = getUserId();
  if (!userId && !isAdmin()) { showToast('Error: User ID tidak ditemukan', 'error'); btn.innerHTML = ori; btn.disabled = false; return; }
  
  // ✅ Generate crypto-grade unique ID if new post
  let id = document.getElementById('pt-id').value || generateUniqueId('POST');
  const content = $('#pt-content').summernote('code');
  const p = { 
    action: 'save_post', id: id, slug: document.getElementById('pt-slug').value, 
    title: document.getElementById('pt-title').value, category: document.getElementById('pt-category').value, 
    image: document.getElementById('pt-image').value, content: content, 
    is_edit: document.getElementById('pt-is-edit').value === 'true',
    id_user: userId
  };
  
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) });
    const d = await res.json();
    if(d.status === 'success') { closeModal('modal-post'); showToast('Artikel Tersimpan!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); }
  } catch(err) { showToast('Koneksi error', 'error'); }
  finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
};

// ✅ SAVE PAGE - with crypto-grade unique ID
document.getElementById('form-page').onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const ori = btn.innerHTML;
  btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROSES...</span>';
  btn.disabled = true;
  
  const userId = getUserId();
  if (!userId && !isAdmin()) { showToast('Error: User ID tidak ditemukan', 'error'); btn.innerHTML = ori; btn.disabled = false; return; }
  
  // ✅ Generate crypto-grade unique ID if new page
  let id = document.getElementById('pg-id').value || generateUniqueId('PAGE');
  const p = { 
    action: 'save_page', id: id, slug: document.getElementById('pg-slug').value, 
    title: document.getElementById('pg-title').value, content: document.getElementById('pg-content').value, 
    is_edit: document.getElementById('pg-is-edit').value === 'true',
    id_user: userId
  };
  
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) });
    const d = await res.json();
    if(d.status === 'success') { closeModal('modal-page'); showToast('Halaman Tersimpan!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); }
  } catch(err) { showToast('Koneksi error', 'error'); }
  finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
};

// ==========================================
// USER MANAGEMENT (Admin Only)
// ==========================================
function openUserModal() { document.getElementById('form-user').reset(); document.getElementById('usr-is-edit').value = 'false'; document.getElementById('modal-user').classList.remove('hidden'); }
function editUser(id) { const u = cachedUsers.find(x => x[4] === id); if(!u) return; document.getElementById('usr-id').value = u[4]; document.getElementById('usr-email').value = u[0]; document.getElementById('usr-name').value = u[2]; document.getElementById('usr-role').value = u[3]; document.getElementById('usr-pass').value = ''; document.getElementById('usr-is-edit').value = 'true'; document.getElementById('modal-user').classList.remove('hidden'); }
async function deleteUser(id) { if(!confirm("Yakin hapus user ini?")) return; try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: 'delete_user', id: id}) }); const d = await res.json(); if(d.status === 'success') { showToast('User dihapus!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); } } catch(e) { showToast('Koneksi error', 'error'); } }
document.getElementById('form-user').onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const ori = btn.innerHTML;
  btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROSES...</span>';
  btn.disabled = true;
  
  // ✅ Generate crypto-grade unique ID if new user
  const id = document.getElementById('usr-id').value || generateUniqueId('USER');
  const p = { action: 'save_user', id: id, email: document.getElementById('usr-email').value, name: document.getElementById('usr-name').value, password: document.getElementById('usr-pass').value, role: document.getElementById('usr-role').value, is_edit: document.getElementById('usr-is-edit').value === 'true' };
  
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) });
    const d = await res.json();
    if(d.status === 'success') { closeModal('modal-user'); showToast('User Tersimpan!', 'success'); await fetchAllAdminData(); } else { showToast('Gagal: ' + d.message, 'error'); }
  } catch(err) { showToast('Koneksi error', 'error'); }
  finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
};

// ==========================================
// SETTINGS SUBMIT
// ==========================================
async function submitSettings(formId, p, msg) {
  const form = document.getElementById(formId);
  const btn = form.querySelector('button[type="submit"]');
  const oriText = btn.innerHTML;
  btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> MENYIMPAN...</span>';
  btn.disabled = true;
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'update_settings', payload: p }) });
    const d = await res.json();
    if(d.status === 'success') { showToast(msg, 'success'); await fetchAllAdminData(); }
    else { showToast('Gagal menyimpan ke server', 'error'); }
  } catch(err) { showToast('Koneksi terputus', 'error'); }
  finally { btn.innerHTML = oriText; btn.disabled = false; lucide.createIcons(); }
}

document.getElementById('form-branding').onsubmit = async (e) => { e.preventDefault(); const p = { site_name: document.getElementById('set-site-name').value, site_tagline: document.getElementById('set-site-tagline').value, site_logo: document.getElementById('set-logo').value, site_favicon: document.getElementById('set-favicon').value, home_page: document.getElementById('set-home-page').value, blog_slug: document.getElementById('set-blog-slug').value, category_slug: document.getElementById('set-category-slug').value }; await submitSettings('form-branding', p, 'Branding & Beranda Berhasil Diupdate!'); };
document.getElementById('form-seo').onsubmit = async (e) => { e.preventDefault(); const p = { google_site_verification: document.getElementById('set-google-verify').value, bing_site_verification: document.getElementById('set-bing-verify').value }; await submitSettings('form-seo', p, 'Kode Verifikasi SEO Diupdate!'); };
document.getElementById('form-config-files').onsubmit = async (e) => { e.preventDefault(); const p = { robots_txt: document.getElementById('set-robots-txt').value, ads_txt: document.getElementById('set-ads-txt').value }; await submitSettings('form-config-files', p, 'File Konfigurasi (Robots/Ads) Tersimpan!'); };
document.getElementById('form-sys').onsubmit = async (e) => { e.preventDefault(); const p = { ik_public_key: document.getElementById('set-ik-pub').value, ik_private_key: document.getElementById('set-ik-priv').value, ik_endpoint: document.getElementById('set-ik-end').value, cf_zone_id: document.getElementById('set-cf-zone').value, cf_api_token: document.getElementById('set-cf-token').value }; await submitSettings('form-sys', p, 'Integrasi API Tersimpan!'); };
document.getElementById('form-templates').onsubmit = async (e) => { e.preventDefault(); const p = { blog_template: document.getElementById('set-blog-tpl').value, article_template: document.getElementById('set-article-tpl').value, category_template: document.getElementById('set-category-tpl').value, page_template: document.getElementById('set-page-tpl').value }; await submitSettings('form-templates', p, 'Tema / Template Blog Tersimpan!'); };

// ==========================================
// MEDIA & IMAGEKIT FUNCTIONS
// ==========================================
async function runImageKitUpload(file, onLoading, onSuccess, onError) {
  if(!IK_PUB || IK_PUB.length < 5) return onError('ImageKit Public Key belum disetting!');
  onLoading();
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    try {
      const sigRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_ik_auth' }) });
      const sigData = await sigRes.json();
      if(sigData.status !== 'success') throw new Error(sigData.message);
      const formData = new FormData();
      formData.append('file', base64);
      formData.append('publicKey', IK_PUB);
      formData.append('signature', sigData.data.signature);
      formData.append('expire', sigData.data.expire);
      formData.append('token', sigData.data.token);
      formData.append('fileName', file.name.replace(/[^a-zA-Z0-9.]/g, '-'));
      formData.append('folder', '/LARIK-CMS');
      const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if(uploadData.url) onSuccess(uploadData.url);
      else throw new Error(uploadData.message || 'Unknown error');
    } catch(e) { onError('Gagal: ' + e.message); }
  };
  reader.onerror = () => onError('Gagal membaca file');
}

function uploadMedia() {
  const fileInput = document.getElementById('media-file');
  if(!fileInput || !fileInput.files || !fileInput.files.length) return showToast('Pilih gambar dulu!', 'warning');
  const file = fileInput.files[0];
  if(!file.type.startsWith('image/')) return showToast('File harus berupa gambar!', 'error');
  if(file.size > 5 * 1024 * 1024) return showToast('Ukuran gambar maksimal 5MB!', 'error');
  
  const btn = document.getElementById('btn-upload');
  if(!btn) return showToast('Tombol upload tidak ditemukan', 'error');
  
  const ori = btn.innerHTML;
  
  runImageKitUpload(file,
    () => { btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> UPLOADING...</span>'; btn.disabled = true; },
    (url) => { 
      safeSetValue('media-url-res', url);
      safeToggleClass('media-res-box', 'hidden', true);
      if(fileInput) fileInput.value = '';
      showToast('Upload sukses!', 'success'); 
      btn.innerHTML = ori; 
      btn.disabled = false; 
      loadMediaGallery();
    },
    (errText) => { showToast(errText, 'error'); btn.innerHTML = ori; btn.disabled = false; }
  );
}

function directUploadKit(inputEl, targetInputId, btnLabelId) {
  if(!inputEl || !inputEl.files || !inputEl.files.length) return;
  const btn = document.getElementById(btnLabelId);
  if(!btn) { showToast('Tombol upload tidak ditemukan', 'error'); return; }
  const file = inputEl.files[0];
  if(!file.type.startsWith('image/')) { showToast('File harus berupa gambar!', 'error'); inputEl.value = ''; return; }
  if(file.size > 5 * 1024 * 1024) { showToast('Ukuran gambar maksimal 5MB!', 'error'); inputEl.value = ''; return; }
  
  const ori = btn.innerHTML;
  
  runImageKitUpload(file,
    () => { btn.innerHTML = '<svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'; btn.classList.add('opacity-50'); },
    (url) => { 
      if(safeSetValue(targetInputId, url)) { showToast('Thumbnail terupload!', 'success'); } 
      else { navigator.clipboard.writeText(url); showToast('URL disalin ke clipboard', 'warning'); }
      btn.innerHTML = ori; btn.classList.remove('opacity-50'); lucide.createIcons(); 
    },
    (errText) => { showToast(errText, 'error'); btn.innerHTML = ori; btn.classList.remove('opacity-50'); }
  );
  inputEl.value = '';
}

function copyLink(inputId) {
  const id = inputId || 'media-url-res';
  const input = document.getElementById(id);
  if(!input) { showToast('Input tidak ditemukan', 'error'); return; }
  input.select(); input.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(input.value);
  showToast('URL disalin!', 'success');
}

async function loadMediaGallery() {
  const grid = document.getElementById('media-grid');
  const loading = document.getElementById('media-loading');
  const empty = document.getElementById('media-empty');
  
  if(!grid) return;
  
  grid.innerHTML = '';
  if(loading) loading.classList.remove('hidden');
  if(empty) empty.classList.add('hidden');
  
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_media_list' }) });
    const r = await res.json();
    
    if(loading) loading.classList.add('hidden');
    
    if (r.status === 'success' && Array.isArray(r.data) && r.data.length > 0) {
      const admin = isAdmin();
      grid.innerHTML = r.data.map(media => `
        <div class="media-card relative bg-slate-50 rounded-xl overflow-hidden border border-slate-100 group cursor-pointer" onclick="insertUrlToEditor('${media.url}')">
          <div class="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
            <img src="${media.thumbnail || media.url}?tr=w-300,h-300" alt="${media.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onerror="this.src='https://placehold.co/300x300/e2e8f0/64748b?text=No+Image'">
          </div>
          <div class="p-3">
            <p class="text-[11px] font-semibold text-slate-700 truncate" title="${media.name}">${media.name}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${formatFileSize(media.size)}</p>
          </div>
          <div class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button onclick="event.stopPropagation(); copyLinkFromGallery('${media.url}')" class="p-2 bg-white/95 hover:bg-teal-500 hover:text-white rounded-lg text-teal-600 transition-all shadow-md" title="Copy URL"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
            ${admin ? `<button onclick="event.stopPropagation(); deleteMedia('${media.id}')" class="p-2 bg-white/95 hover:bg-rose-500 hover:text-white rounded-lg text-rose-500 transition-all shadow-md media-delete-btn" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
          </div>
        </div>
      `).join('');
    } else { 
      if(empty) empty.classList.remove('hidden'); 
      grid.innerHTML = '';
    }
    lucide.createIcons();
  } catch (e) { 
    console.error('Load Media Error:', e);
    if(loading) loading.classList.add('hidden'); 
    if(empty) empty.classList.remove('hidden');
    grid.innerHTML = '';
    showToast('Gagal memuat galeri: ' + e.message, 'error'); 
  }
}

function formatFileSize(bytes) { if (!bytes) return '-'; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]; }
function copyLinkFromGallery(url) { navigator.clipboard.writeText(url); showToast('URL disalin!', 'success'); }
async function deleteMedia(fileId) {
  if (!confirm('Yakin hapus gambar ini dari ImageKit?\n\nAksi ini tidak bisa dibatalkan.')) return;
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_media', fileId: fileId }) });
    const r = await res.json();
    if (r.status === 'success') { showToast('Gambar dihapus!', 'success'); loadMediaGallery(); }
    else { showToast(r.message || 'Gagal menghapus', 'error'); }
  } catch (e) { showToast('Koneksi error', 'error'); }
}
function insertUrlToEditor(url) {
  const postModal = document.getElementById('modal-post');
  if (postModal && !postModal.classList.contains('hidden')) {
    if(safeSetValue('pt-image', url)) { showToast('URL thumbnail diterapkan!', 'success'); } 
    else { copyLinkFromGallery(url); showToast('URL disalin! Paste di editor untuk pakai.', 'success'); }
  } else { copyLinkFromGallery(url); showToast('URL disalin! Paste di editor untuk pakai.', 'success'); }
}

// ==========================================
// THEMES LOGIC
// ==========================================
function checkDomainAuthorization(domainString) { if (!domainString) return false; try { const currentHost = window.location.hostname.replace('www.', '').trim(); const allowedDomains = domainString.split(';').map(d => d.trim().replace('www.', '').replace(/\/$/, '')); return allowedDomains.includes(currentHost); } catch(e) { return false; } }
function checkIfActive(articleTpl, blogTpl, pageTpl) { 
  try { 
    const currentArticle = document.getElementById('set-article-tpl').value || ''; 
    const currentBlog = document.getElementById('set-blog-tpl').value || '';
    const currentPage = document.getElementById('set-page-tpl').value || '';
    return (articleTpl && currentArticle === articleTpl) || (blogTpl && currentBlog === blogTpl) || (pageTpl && currentPage === pageTpl);
  } catch(e) { return false; } 
}

async function loadThemes() {
  const grid = document.getElementById('theme-grid');
  const loading = document.getElementById('theme-loading');
  if(!grid) return;
  grid.innerHTML = '';
  if(loading) loading.classList.remove('hidden');
  
  const SHEET_NAME = 'Template';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID_THEMES}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Invalid JSON response from Sheet');
    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    const json = JSON.parse(jsonStr);
    const rows = json.table?.rows || [];
    
    themesData = [];
    if (rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const getVal = (idx) => (row.c && row.c[idx] && row.c[idx].v != null) ? String(row.c[idx].v) : '';
        const name = getVal(0) || 'Tanpa Nama';
        const demo = getVal(1) || '#';
        const img = getVal(2) || 'https://placehold.co/600x400/e2e8f0/94a3b8?text=No+Preview';
        const article = getVal(3);
        const blog = getVal(4);
        const page = getVal(5);
        const category = getVal(6);
        const type = (getVal(7)).toLowerCase() || 'free';
        const domains = getVal(8);
        const price = getVal(9);
        const waLinkRaw = getVal(10);
        
        themesData.push({ name, demo, img, article, blog, page, category, type, domains, price, waLinkRaw });
        
        const isFree = type === 'free';
        const isAuthorized = isFree || checkDomainAuthorization(domains);
        const isActive = checkIfActive(article, blog, page);
        
        let badgeHtml = '';
        if (isActive) badgeHtml = `<div class="theme-badge bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"><i data-lucide="check-circle" class="w-3 h-3"></i> Terpakai</div>`;
        else if (isFree) badgeHtml = `<div class="theme-badge bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-200">Gratis</div>`;
        else badgeHtml = `<div class="theme-badge bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-full border border-amber-200">Premium</div>`;
        
        let buttonHtml = '';
        if (isActive) { 
          buttonHtml = `<button disabled class="w-full bg-slate-100 text-slate-500 text-xs py-3 rounded-xl font-bold cursor-default flex items-center justify-center gap-2"><i data-lucide="check" class="w-4 h-4"></i> Tema Saat Ini</button>`; 
        } else if (isAuthorized) { 
          buttonHtml = `<button onclick="applyTheme(${themesData.length - 1})" class="btn-primary w-full flex items-center justify-center gap-2"><i data-lucide="wand-2" class="w-4 h-4"></i> Pakai Tema</button>`; 
        } else {
          let finalWaLink = '#';
          if(waLinkRaw) { 
            if(waLinkRaw.includes('wa.me') || waLinkRaw.includes('api.whatsapp')) finalWaLink = waLinkRaw; 
            else finalWaLink = `https://wa.me/${waLinkRaw.replace(/\D/g,'')}`; 
          }
          const msg = `Halo, saya ingin beli tema ${name}`;
          const buyHref = `${finalWaLink}?text=${encodeURIComponent(msg)}`;
          buttonHtml = `<a href="${buyHref}" target="_blank" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs py-3 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"><i data-lucide="shopping-bag" class="w-4 h-4"></i> Beli (${price})</a>`;
        }
        
        const card = document.createElement('div');
        card.className = 'theme-card bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col shadow-sm';
        card.innerHTML = `
          <div class="relative aspect-video bg-slate-100 overflow-hidden group">
            ${badgeHtml}
            <img src="${img}" alt="${name}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://placehold.co/600x400/e2e8f0/94a3b8?text=Error'">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <a href="${demo}" target="_blank" class="bg-white text-teal-700 text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-teal-50 transition-colors shadow-lg"><i data-lucide="eye" class="w-3 h-3"></i> Preview</a>
            </div>
          </div>
          <div class="p-5 flex-1 flex flex-col justify-between">
            <div class="mb-4">
              <h3 class="font-black text-slate-800 text-base mb-1">${name}</h3>
              <p class="text-slate-400 text-xs">${isFree ? 'Tema gratis siap pakai.' : 'Tema premium dengan fitur eksklusif.'}</p>
            </div>
            <div>${buttonHtml}</div>
          </div>`;
        grid.appendChild(card);
      }
    } else { 
      grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-medium">Tidak ada tema blog tersedia.</div>'; 
    }
    lucide.createIcons();
  } catch (err) { 
    console.error('Load Themes Error:', err); 
    grid.innerHTML = '<div class="col-span-full text-center text-rose-500 py-10 text-sm">Gagal memuat tema: ' + err.message + '</div>'; 
  } finally { 
    if(loading) loading.classList.add('hidden'); 
  }
}

async function loadLandingThemes() {
  const grid = document.getElementById('landing-grid');
  const loading = document.getElementById('landing-loading');
  if(!grid) return;
  grid.innerHTML = '';
  if(loading) loading.classList.remove('hidden');
  
  const SHEET_NAME = 'tema_landing';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID_THEMES}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Invalid JSON response from Sheet');
    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    const json = JSON.parse(jsonStr);
    const rows = json.table?.rows || [];
    
    landingThemesData = [];
    if (rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const getVal = (idx) => (row.c && row.c[idx] && row.c[idx].v != null) ? String(row.c[idx].v) : '';
        const name = getVal(0) || 'Tanpa Nama';
        const demo = getVal(1) || '#';
        const img = getVal(2) || 'https://placehold.co/600x400/e2e8f0/94a3b8?text=No+Preview';
        const tema = getVal(3);
        const type = (getVal(4)).toLowerCase() || 'free';
        const domains = getVal(5);
        const price = getVal(6);
        const waLinkRaw = getVal(7);
        
        landingThemesData.push({ name, demo, img, tema, type, domains, price, waLinkRaw });
        
        const isFree = type === 'free';
        const isAuthorized = isFree || checkDomainAuthorization(domains);
        
        let badgeHtml = '';
        if (isFree) badgeHtml = `<div class="theme-badge bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-200">Gratis</div>`;
        else badgeHtml = `<div class="theme-badge bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-full border border-amber-200">Premium</div>`;
        
        let buttonHtml = '';
        if (isAuthorized) { 
          buttonHtml = `<button onclick="applyLandingTheme(${landingThemesData.length - 1})" class="btn-primary w-full flex items-center justify-center gap-2"><i data-lucide="wand-2" class="w-4 h-4"></i> Pakai Tema</button>`; 
        } else {
          let finalWaLink = '#';
          if(waLinkRaw) { 
            if(waLinkRaw.includes('wa.me') || waLinkRaw.includes('api.whatsapp')) finalWaLink = waLinkRaw; 
            else finalWaLink = `https://wa.me/${waLinkRaw.replace(/\D/g,'')}`; 
          }
          const msg = `Halo, saya ingin beli landing theme ${name}`;
          const buyHref = `${finalWaLink}?text=${encodeURIComponent(msg)}`;
          buttonHtml = `<a href="${buyHref}" target="_blank" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs py-3 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"><i data-lucide="shopping-bag" class="w-4 h-4"></i> Beli (${price})</a>`;
        }
        
        const card = document.createElement('div');
        card.className = 'theme-card bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col shadow-sm';
        card.innerHTML = `
          <div class="relative aspect-video bg-slate-100 overflow-hidden group">
            ${badgeHtml}
            <img src="${img}" alt="${name}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://placehold.co/600x400/e2e8f0/94a3b8?text=Error'">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <a href="${demo}" target="_blank" class="bg-white text-violet-700 text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-violet-50 transition-colors shadow-lg"><i data-lucide="eye" class="w-3 h-3"></i> Preview</a>
            </div>
          </div>
          <div class="p-5 flex-1 flex flex-col justify-between">
            <div class="mb-4">
              <h3 class="font-black text-slate-800 text-base mb-1">${name}</h3>
              <p class="text-slate-400 text-xs">${isFree ? 'Landing theme gratis.' : 'Landing theme premium eksklusif.'}</p>
            </div>
            <div>${buttonHtml}</div>
          </div>`;
        grid.appendChild(card);
      }
    } else { 
      grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-medium">Tidak ada landing theme tersedia.</div>'; 
    }
    lucide.createIcons();
  } catch (err) { 
    console.error('Load Landing Themes Error:', err); 
    grid.innerHTML = '<div class="col-span-full text-center text-rose-500 py-10 text-sm">Gagal memuat: ' + err.message + '</div>'; 
  } finally { 
    if(loading) loading.classList.add('hidden'); 
  }
}

function loadAllThemes() { loadThemes(); loadLandingThemes(); }

function applyTheme(index) {
  const template = themesData[index];
  if (!template) return;
  document.getElementById('set-article-tpl').value = template.article || '';
  document.getElementById('set-blog-tpl').value = template.blog || '';
  document.getElementById('set-page-tpl').value = template.page || '';
  document.getElementById('set-category-tpl').value = template.category || '';
  showToast('Kode tema blog berhasil dimasukkan. Jangan lupa simpan!', 'success');
  switchTab('settings');
  setTimeout(() => {
    const el = document.getElementById('form-templates');
    if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-teal-400', 'ring-offset-4', 'rounded-2xl'); setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400', 'ring-offset-4'), 2500); }
  }, 300);
}

async function applyLandingTheme(index) {
  const template = landingThemesData[index];
  if (!template) return;
  const slug = template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const pageId = 'LANDING-' + slug.toUpperCase().replace(/-/g, '');
  const pageData = { action: 'save_page', id: pageId, slug: slug, title: template.name, content: template.tema || '', is_edit: false, id_user: getUserId() };
  try {
    showToast('Membuat halaman landing...', 'warning');
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(pageData) });
    const d = await res.json();
    if(d.status === 'success') { 
      showToast(`"${template.name}" berhasil dibuat sebagai Pages!`, 'success'); 
      await fetchAllAdminData(); 
      setTimeout(() => { switchTab('pages'); }, 1500); 
    } else { showToast('Gagal membuat halaman: ' + (d.message || 'Unknown error'), 'error'); }
  } catch(err) { showToast('Koneksi error: ' + err.message, 'error'); }
}

// ==========================================
// ✅ SUMMERNOTE INIT - WITH VISUAL HEADING STYLES
// ==========================================
function initSummernote() {
  if(isSummernoteInitialized) return;
  $('#pt-content').summernote({
    height: 350,
    toolbar: [
      ['style', ['style']],
      ['font', ['bold', 'italic', 'underline', 'strikethrough', 'clear']],
      ['fontsize', ['fontsize']],
      ['color', ['color']],
      ['para', ['ul', 'ol', 'paragraph', 'height']],
      ['table', ['table']],
      ['insert', ['link', 'video', 'hr']],
      ['view', ['fullscreen', 'codeview', 'help']]
    ],
    styleWithCSS: true,
    dialogsInBody: true,
    followingToolbar: false,
    placeholder: 'Tulis konten artikel di sini...',
    callbacks: {
      onInit: function() {
        $('.note-editable').css({
          'font-family': "'Plus Jakarta Sans', sans-serif",
          'line-height': '1.7',
          'color': '#0f172a'
        });
        // ✅ Inject visual heading styles for editor preview
        if(!document.getElementById('summernote-visual-styles')) {
          $('<style id="summernote-visual-styles">').html(`
            .note-editable h1 { font-size: 2em; font-weight: 800; color: #0f172a; margin: 0.67em 0; border-left: 4px solid #0d9488; padding-left: 12px; background: linear-gradient(135deg, rgba(13,148,136,0.08), transparent); border-radius: 0 8px 8px 0; }
            .note-editable h2 { font-size: 1.5em; font-weight: 700; color: #1e293b; margin: 0.75em 0; border-left: 3px solid #14b8a6; padding-left: 10px; }
            .note-editable h3 { font-size: 1.25em; font-weight: 600; color: #334155; margin: 0.83em 0; border-left: 2px solid #22d3ee; padding-left: 8px; }
            .note-editable h4 { font-size: 1.1em; font-weight: 600; color: #475569; margin: 1em 0; }
            .note-editable h5 { font-size: 1em; font-weight: 600; color: #64748b; margin: 1em 0; }
            .note-editable h6 { font-size: 0.9em; font-weight: 600; color: #94a3b8; margin: 1em 0; }
            .note-editable ul { list-style-type: disc; margin: 1em 0; padding-left: 24px; }
            .note-editable ol { list-style-type: decimal; margin: 1em 0; padding-left: 24px; }
            .note-editable li { margin: 0.3em 0; line-height: 1.7; }
            .note-editable blockquote { border-left: 4px solid #94a3b8; padding: 12px 16px; background: #f8fafc; margin: 1em 0; font-style: italic; border-radius: 0 8px 8px 0; }
            .note-editable pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 13px; }
            .note-editable code { background: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
            .note-editable a { color: #0d9488; text-decoration: none; font-weight: 500; }
            .note-editable a:hover { text-decoration: underline; }
            .note-editable img { max-width: 100%; height: auto; border-radius: 12px; margin: 12px 0; box-shadow: var(--shadow-sm); }
            .note-editable table { width: 100%; border-collapse: collapse; margin: 1em 0; }
            .note-editable th, .note-editable td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
            .note-editable th { background: var(--bg-tertiary); font-weight: 600; }
            .note-editable hr { border: 0; border-top: 2px dashed var(--border); margin: 2em 0; }
          `).appendTo('head');
        }
      },
      onDialogShown: function($dialog) {
        setTimeout(() => {
          const summernoteModal = $dialog.closest('.note-modal');
          const backdrops = summernoteModal.find('.modal-backdrop');
          if(backdrops.length > 1) backdrops.slice(1).remove();
          const mainBackdrop = summernoteModal.siblings('.note-modal-backdrop');
          if(mainBackdrop.length) mainBackdrop.css('z-index', '99998');
        }, 50);
      }
    }
  });
  isSummernoteInitialized = true;
}

// ==========================================
// ON LOAD
// ==========================================
document.querySelectorAll('.currentYear').forEach(el => el.innerText = new Date().getFullYear());
document.body.classList.add('login-active');

window.onload = () => { 
  lucide.createIcons(); 
  if(sessionStorage.getItem('cms_auth')) init(); 
};
