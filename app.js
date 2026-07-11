/* ================================================================
   Shopfinity — app.js
   Supabase tables used:
     users              (id uuid PK, name, email, password_hash)
     merchants          (id uuid PK, user_id uuid FK, store_name, store_id, …)
     categories         (id int PK, name)
     products           (id uuid PK, merchant_id uuid FK, product_name, category_id,
                         status, price, stock, sku, emoji, description)
     carts              (id uuid PK, user_id uuid FK)
     cart_items         (id uuid PK, cart_id uuid FK, product_id uuid FK, quantity)
     orders             (id uuid PK, order_number, user_id uuid FK, subtotal,
                         shipping_fee, total, payment_method, payment_status,
                         order_status, shipping_address)
     order_items        (id uuid PK, order_id uuid FK, product_id uuid FK,
                         quantity, unit_price, total_price)
     reviews            (id uuid PK, product_id uuid FK, user_id uuid FK,
                         user_name, rating, text, verified_purchase, …)
     user_verifications (id uuid PK, user_id uuid FK, id_type, id_number,
                         verification_status, verification_score)
   ================================================================ */

/* ===== SUPABASE HELPER ===== */
function getConfig() {
  const c = window.SUPABASE_CONFIG || {};
  return {
    url: (c.url || '').replace(/\/$/, ''),
    key: c.anonKey || ''
  };
}

async function db(endpoint, method = 'GET', body = null) {
  const { url, key } = getConfig();
  if (!url || !key) { console.error('[SF] Supabase not configured'); return null; }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation';

  try {
    const res = await fetch(`${url}/rest/v1${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return true;
    const data = await res.json();
    if (!res.ok) {
      console.error(`[SF] ${method} ${endpoint} → ${res.status}`, JSON.stringify(data));
      // Attach error detail so callers can surface it
      const err = new Error(data?.message || data?.details || data?.hint || `HTTP ${res.status}`);
      err._supabase = data;
      err._status   = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err._supabase) throw err;   // re-throw our own errors
    console.error('[SF] Request failed:', err);
    return null;
  }
}

/* ===== VERA EXTENSION DETECTION ===== */
window.addEventListener("message", (e) => {
  if (e.data?.source === "VERA_EXTENSION" && e.data?.type === "EXTENSION_READY") {
    console.log("[VERA] VERA Vault Extension detected on this page!");
    window._veraExtensionReady = true;
  }
});

/* ===== PRODUCTS  (all come from the database) ===== */
// PRODUCTS is the runtime cache populated by loadAllProducts().
// product.html, products.html, and index.html all call loadAllProducts()
// on DOMContentLoaded before rendering anything.
let PRODUCTS = [];

/**
 * Fetch every active product from the `products` table.
 * Each row is normalised into the shape the rest of the UI expects:
 *   { id, product_name, name, cat, category_id, price, stock,
 *     sku, emoji, desc, rating, reviews, merchant_id }
 */
async function loadAllProducts() {
  try {
    const { url, key } = getConfig();
    // Fetch ONLY active products server-side (no full table scan) + reviews in parallel
    const [productsRes, allReviews] = await Promise.all([
      fetch(`${url}/rest/v1/products?select=*,merchants(store_name)&status=eq.Active&order=created_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
      }),
      db('/reviews?select=product_id,rating')
    ]);

    const rows = productsRes.ok ? await productsRes.json() : null;
    if (!rows) return;

    const reviewMap = {};
    (allReviews || []).forEach(r => {
      if (!reviewMap[r.product_id]) reviewMap[r.product_id] = { count: 0, sum: 0 };
      reviewMap[r.product_id].count++;
      reviewMap[r.product_id].sum += r.rating;
    });

    PRODUCTS = rows.map(p => {
      const prod = normaliseProduct(p);
      const rev = reviewMap[prod.id];
      if (rev) {
        prod.reviews = rev.count;
        prod.rating = (rev.sum / rev.count).toFixed(1);
      }
      return prod;
    });
    console.log(`[SF] Loaded ${PRODUCTS.length} product(s) from DB:`, PRODUCTS.map(p => p.name));
  } catch (e) {
    console.warn('[SF] Could not load products', e);
  }
}

/** Shape a raw `products` DB row into the UI-expected format. */
function normaliseProduct(p) {
  return {
    ...p,
    id:         p.id,
    name:       p.product_name,
    cat:        CATEGORY_NAMES[p.category_id] || String(p.category_id) || 'General',
    price:      Number(p.price),
    stock:      Number(p.stock),
    image_urls: Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [],
    desc:       p.description || '',
    sku:        p.sku   || '',
    store_name: p.merchants?.store_name || 'ShopFresh',
    rating:     0,
    reviews:    0,
  };
}

/** Returns the primary display image for a product.
 *  Prefers the first real image URL; falls back to a default placeholder. */
function productThumb(p) {
  if (p.image_urls && p.image_urls.length > 0) return p.image_urls[0];
  return 'https://placehold.co/400x400/e0e0e0/888888.png?text=No+Image';
}

/* ── Category lookup (mirrors CATEGORY_MAP in merchant.html) ── */
const CATEGORY_MAP = {
  'Food':          6,
  'Electronics':   7,
  'Clothing':      8,
  'Home & Garden': 9,
  'Sports':        10,
};
const CATEGORY_NAMES = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([k, v]) => [v, k])
);

/* ===== STATE ===== */
let cart = {};       // { productId (uuid): qty }
let cartId = null;   // active carts.id for the current user
let cartSelected = new Set(); // productIds currently selected for checkout
let currentUser = null;
let productReviews = {};
let savedAddresses = [];          // cache of this user's saved_addresses rows
let selectedAddressId = null;     // currently chosen address id on checkout page

/* ===== SESSION ===== */
function saveSession() {
  if (!currentUser) return;
  localStorage.setItem('shopfinity_user', JSON.stringify(currentUser));
  localStorage.setItem('shopfinity_cart', JSON.stringify(cart));
}

function loadSession() {
  try {
    const u = localStorage.getItem('shopfinity_user');
    const c = localStorage.getItem('shopfinity_cart');
    if (u) { currentUser = JSON.parse(u); updateAccountUI(); }
    if (c) { cart = JSON.parse(c); updateCartUI(); }
  } catch(e) { /* ignore corrupt data */ }
}

function clearSession() {
  localStorage.removeItem('shopfinity_user');
  localStorage.removeItem('shopfinity_cart');
  currentUser = null;
  cart = {};
  cartId = null;
  updateAccountUI();
  updateCartUI();
}

/* ===== CART DB SYNC ===== */
async function getOrCreateCart() {
  if (!currentUser?.id) return null;
  if (cartId) return cartId;

  const userId = currentUser.id;
  const existing = await db(`/carts?user_id=eq.${userId}&order=created_at.desc&limit=1`);
  if (existing && existing.length > 0) {
    cartId = existing[0].id;
    return cartId;
  }

  const created = await db('/carts', 'POST', { user_id: userId });
  if (created && created.length > 0) {
    cartId = created[0].id;
    return cartId;
  }

  console.error('[SF] Could not get or create cart');
  return null;
}

async function syncCartItemToDB(productId, qty) {
  if (!currentUser) return;
  const cid = await getOrCreateCart();
  if (!cid) return;

  if (qty <= 0) {
    await db(`/cart_items?cart_id=eq.${cid}&product_id=eq.${productId}`, 'DELETE');
    return;
  }

  const existing = await db(`/cart_items?cart_id=eq.${cid}&product_id=eq.${productId}&limit=1`);
  if (existing && existing.length > 0) {
    await db(`/cart_items?cart_id=eq.${cid}&product_id=eq.${productId}`, 'PATCH', { quantity: qty });
  } else {
    await db('/cart_items', 'POST', { cart_id: cid, product_id: productId, quantity: qty });
  }
}

async function loadCartFromDB() {
  const cid = await getOrCreateCart();
  if (!cid) return;

  const items = await db(`/cart_items?cart_id=eq.${cid}`);
  if (items && items.length > 0) {
    cart = {};
    items.forEach(item => { cart[item.product_id] = item.quantity; });
    saveSession();
    updateCartUI();
    console.log(`[SF] Cart loaded from DB: ${items.length} item(s)`);
  }
}

/* ===== CART LOGIC ===== */
function getCartTotal() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = PRODUCTS.find(p => p.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function getSelectedTotal() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    if (!cartSelected.has(id)) return sum;
    const p = PRODUCTS.find(p => p.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function getCartCount() {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

function addToCart(productId, qty = 1) {
  const p = PRODUCTS.find(p => p.id === productId);
  const stock = p ? p.stock : Infinity;
  const current = cart[productId] || 0;
  const allowed = Math.min(qty, stock - current);

  if (allowed <= 0) {
    showToast(current >= stock ? 'Maximum stock reached' : 'Not enough stock');
    return;
  }

  cart[productId] = current + allowed;
  cartSelected.add(productId);   // auto-select newly added items
  if (allowed < qty) showToast(`Only ${stock} in stock — added ${allowed}`);
  else showToast('Added to cart');

  updateCartUI();
  syncCartItemToDB(productId, cart[productId]);
  saveSession();
}

function removeFromCart(productId) {
  delete cart[productId];
  cartSelected.delete(productId);
  updateCartUI();
  renderCartItems();
  syncCartItemToDB(productId, 0);
  saveSession();
}

function changeQty(productId, delta) {
  const p = PRODUCTS.find(p => p.id === productId);
  const stock = p ? p.stock : Infinity;
  const current = cart[productId] || 0;
  const next = current + delta;

  if (next <= 0) {
    delete cart[productId];
  } else if (next > stock) {
    showToast(`Only ${stock} in stock`);
    return;   // don't update — already at max
  } else {
    cart[productId] = next;
  }

  updateCartUI();
  renderCartItems();
  syncCartItemToDB(productId, cart[productId] || 0);
  saveSession();
}

function updateCartUI() {
  const count = getCartCount();
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  const keys = Object.keys(cart);

  // Show / hide the select-all toolbar
  const selectBar = document.getElementById('cartSelectBar');
  if (selectBar) selectBar.style.display = keys.length > 0 ? 'flex' : 'none';

  if (keys.length === 0) {
    container.innerHTML = `<div class="cart-empty"><div class="big-emoji"><svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></g></svg></div><p>Your cart is empty</p></div>`;
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = '₱0';
    return;
  }

  container.innerHTML = keys.map(id => {
    const p = PRODUCTS.find(p => p.id === id);
    if (!p) return '';
    const qty      = cart[id];
    const safeId   = `'${id}'`;
    const checked  = cartSelected.has(id);
    const dimClass = checked ? '' : ' unselected';
    const thumbEl  = `<img src="${productThumb(p)}" alt="${p.name}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;" />`;
    return `<div class="cart-item${dimClass}" id="cart-item-${id}">
      <input type="checkbox" class="cart-item-checkbox" ${checked ? 'checked' : ''} onchange="toggleItemSelection(${safeId}, this.checked)" title="Select item" />
      ${thumbEl}
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}</div>
        <div class="cart-item-price">₱${(p.price * qty).toLocaleString()}</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${safeId}, -1)">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" onclick="changeQty(${safeId}, 1)">+</button>
        </div>
      </div>
      <button class="remove-item" onclick="removeFromCart(${safeId})" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`;
  }).join('');

  // Update total to reflect selected items only
  const totalEl = document.getElementById('cartTotal');
  if (totalEl) {
    const selectedTotal = getSelectedTotal();
    totalEl.textContent = '₱' + selectedTotal.toLocaleString();
  }

  // Sync select-all checkbox and delete button state
  _syncSelectAllState();
}

function toggleItemSelection(productId, selected) {
  if (selected) {
    cartSelected.add(productId);
  } else {
    cartSelected.delete(productId);
  }

  // Update dim class without full re-render
  const itemEl = document.getElementById(`cart-item-${productId}`);
  if (itemEl) {
    itemEl.classList.toggle('unselected', !selected);
  }

  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = '₱' + getSelectedTotal().toLocaleString();

  _syncSelectAllState();
}

function toggleSelectAll(selected) {
  const keys = Object.keys(cart);
  if (selected) {
    keys.forEach(id => cartSelected.add(id));
  } else {
    cartSelected.clear();
  }
  renderCartItems();
}

function deleteSelectedItems() {
  const toDelete = [...cartSelected];
  if (toDelete.length === 0) return;
  toDelete.forEach(id => {
    delete cart[id];
    cartSelected.delete(id);
    syncCartItemToDB(id, 0);
  });
  updateCartUI();
  renderCartItems();
  saveSession();
}

function _syncSelectAllState() {
  const keys = Object.keys(cart);
  const allSelected = keys.length > 0 && keys.every(id => cartSelected.has(id));
  const anySelected = keys.some(id => cartSelected.has(id));

  const selectAllCb = document.getElementById('cartSelectAll');
  if (selectAllCb) {
    selectAllCb.checked = allSelected;
    selectAllCb.indeterminate = !allSelected && anySelected;
  }

  const deleteBtn = document.getElementById('btnDeleteSelected');
  if (deleteBtn) deleteBtn.disabled = !anySelected;

  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    const count = keys.filter(id => cartSelected.has(id)).length;
    checkoutBtn.textContent = `Checkout (${count})`;
  }
}

async function openCart() {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  // Ensure product cache is populated so cart items can resolve names/prices
  if (PRODUCTS.length === 0) await loadAllProducts();
  // Seed selection: select all items that haven't been explicitly deselected
  Object.keys(cart).forEach(id => {
    if (!cartSelected.has(id)) cartSelected.add(id);
  });
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
}

/* ===== AUTH ===== */
function openAuthModal() {
  if (currentUser) { openAccountModal(); return; }
  document.getElementById('authModal').classList.add('open');
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

function showLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value.trim();
  if (!email || !pass) { showToast('Please fill in all fields'); return; }

  const result = await loginUser(email, pass);
  if (result.success) {
    currentUser = result.user;
    cartId = null;
    saveSession();
    closeAuthModal();
    updateAccountUI();
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value  = '';
    showToast('Signed in as ' + currentUser.name + '');
    await loadCartFromDB();
  } else {
    showToast('Login failed: ' + result.error);
  }
}

async function doRegister() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value.trim();
  if (!name || !email || !pass) { showToast('Please fill in all fields'); return; }

  const result = await registerUser(name, email, pass);
  if (result.success) {
    currentUser = { name: result.user.name, email: result.user.email, id: result.user.id };
    cartId = null;
    saveSession();
    closeAuthModal();
    updateAccountUI();
    document.getElementById('regName').value  = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPass').value  = '';
    showToast('Account created! Welcome, ' + name);
  } else {
    showToast('Registration failed: ' + result.error);
  }
}

function doSignOut() {
  clearSession();
  closeAccountModal();
  showToast('Signed out');
}

function updateAccountUI() {
  document.querySelectorAll('.signin-btn').forEach(btn => {
    btn.textContent = currentUser ? currentUser.name : 'Sign in';
  });
}

function openAccountModal() {
  const modal = document.getElementById('accountModal');
  if (!modal) return;
  document.getElementById('accountName').textContent     = currentUser.name;
  document.getElementById('accountEmail').textContent    = currentUser.email;
  document.getElementById('accountInitials').textContent = currentUser.name.slice(0, 2).toUpperCase();
  modal.classList.add('open');
}

function closeAccountModal() {
  document.getElementById('accountModal')?.classList.remove('open');
}

/* ===== PRODUCT MODAL (used on products.html) ===== */
function openProductModal(id) {
  const p = PRODUCTS.find(p => p.id === id);
  if (!p) return;
  document.getElementById('pm-emoji').innerHTML = `<img src="${productThumb(p)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);" />`;
  document.getElementById('pm-name').textContent   = p.name;
  document.getElementById('pm-cat').textContent    = p.cat;
  document.getElementById('pm-price').textContent  = '₱' + p.price.toLocaleString();
  document.getElementById('pm-rating').textContent = '<svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></g></svg> ' + (p.rating || 'New') + ' (' + p.reviews + ' reviews)';
  document.getElementById('pm-desc').textContent   = p.desc;
  document.getElementById('pm-qty').value = 1;
  document.getElementById('pm-add').onclick = () => {
    const qty = parseInt(document.getElementById('pm-qty').value) || 1;
    addToCart(p.id, qty);
    closeProductModal();
  };
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

/* ===== ABOUT / CONTACT MODALS ===== */
function openAboutModal()   { document.getElementById('aboutModal').classList.add('open'); }
function closeAboutModal()  { document.getElementById('aboutModal').classList.remove('open'); }
function openContactModal() { document.getElementById('contactModal').classList.add('open'); }
function closeContactModal(){ document.getElementById('contactModal').classList.remove('open'); }

function sendContact() {
  const name = document.getElementById('cName').value.trim();
  const msg  = document.getElementById('cMsg').value.trim();
  if (!name || !msg) { showToast('Please fill in all fields'); return; }
  closeContactModal();
  showToast("Message sent! We'll get back to you soon");
  document.getElementById('cName').value  = '';
  document.getElementById('cMsg').value   = '';
  document.getElementById('cEmail').value = '';
}

/* ===== TOAST ===== */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ===== SEARCH ===== */
function handleSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (e.key === 'Enter' && q) {
    window.location.href = 'products.html?search=' + encodeURIComponent(q);
  }
}

/* ===== PRODUCT CARD (shared template) ===== */
function makeProductCard(p) {
  const safeId   = `'${p.id}'`;   // single-quoted for safe HTML attribute injection
  const thumbHtml = `<img src="${productThumb(p)}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);" loading="lazy" />`;
  return `<div class="product-card" onclick="window.location.href='product.html?id=${encodeURIComponent(p.id)}'" style="cursor:pointer">
    <div class="product-thumb" style="display:flex;align-items:center;justify-content:center;overflow:hidden;">${thumbHtml}</div>
    <div class="product-body">
      <div class="product-name">${p.name}</div>
      <div class="product-cat">${p.cat}</div>
      <div class="product-price">₱${p.price.toLocaleString()}</div>
      <div class="product-rating"><svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></g></svg> ${p.rating > 0 ? p.rating : 'New'} · ${p.reviews} reviews</div>
      <button class="add-to-cart" onclick="event.stopPropagation(); addToCart(${safeId})">+ Add to cart</button>
    </div>
  </div>`;
}

/* ===== REVIEWS ===== */

// Cache whether the order_id column exists in reviews table
let _reviewsHasOrderId = null;

async function _checkReviewsOrderIdColumn() {
  if (_reviewsHasOrderId !== null) return _reviewsHasOrderId;
  try {
    // Try fetching a single review with order_id selected — if column missing, PostgREST returns error
    const result = await db('/reviews?select=order_id&limit=1');
    _reviewsHasOrderId = true;
  } catch(e) {
    _reviewsHasOrderId = false;
  }
  return _reviewsHasOrderId;
}

// Helper: post a review row, falling back to omitting order_id if the column doesn't exist yet
async function _insertReview(reviewData) {
  // Check if order_id column exists before even trying
  const hasOrderId = await _checkReviewsOrderIdColumn();
  const dataToInsert = hasOrderId ? reviewData : (({ order_id, ...rest }) => rest)(reviewData);

  try {
    const result = await db('/reviews', 'POST', dataToInsert);
    return result;
  } catch(err) {
    // Duplicate key — pass through so caller can handle
    if (err?._supabase?.code === '23505' || err?._status === 409) throw err;
    // column "order_id" doesn't exist — mark as missing, retry without it
    const isColumnErr = err?._supabase?.code === '42703' ||
                        (err?.message || '').toLowerCase().includes('order_id');
    if (isColumnErr) {
      _reviewsHasOrderId = false;
      const { order_id, ...withoutOrderId } = reviewData;
      return await db('/reviews', 'POST', withoutOrderId);
    }
    throw err;
  }
}

async function submitReview(productId, rating, text, verifiedPurchase = false, useVera = false, orderId = null) {
  if (!currentUser) { showToast('Please sign in to leave a review'); return false; }
  
  if (!useVera) {
    // Original Shopfinity logic: Push directly to Supabase (Identity revealed)
    const review = {
      product_id:        productId,
      user_id:           currentUser.id,
      user_name:         currentUser.name,
      rating,
      text,
      verified_purchase: verifiedPurchase,
      verified_id: false,
      id_verification_score: 0,
      ...(orderId ? { order_id: orderId } : {}),
    };
    try {
      const result = await _insertReview(review);
      if (result) { showToast('Review posted!'); loadProductReviews(productId); return true; }
    } catch(err) {
      console.error("[VERA] Normal Review Failed:", err);
      if (err._supabase) console.error("[VERA] Supabase Details:", err._supabase);
      // Duplicate key = review already exists — UPDATE it instead
      if (err?._supabase?.code === '23505' || err?._status === 409) {
        try {
          const updated = await db(
            `/reviews?product_id=eq.${productId}&user_id=eq.${currentUser.id}`,
            'PATCH',
            { rating, text, verified_purchase: verifiedPurchase }
          );
          showToast('Review updated!');
          loadProductReviews(productId);
          return true;
        } catch(updateErr) {
          console.error("[VERA] Review update failed:", updateErr);
        }
      }
      showToast('Failed to submit review: ' + (err.message || 'Server error'));
      return false;
    }
    return false;
  }

  // VERA logic: Zero-Knowledge Proof (Anonymous but Verified)
  const p = PRODUCTS.find(prod => prod.id === productId);
  if (!p || !p.sku) {
     showToast('Product SKU not found'); return false;
  }

  try {
    // 1. Get challenge nonce from VERA backend
    const challengeRes = await fetch('https://vera-api-buru.onrender.com/api/verify/challenge');
    const { nonce } = await challengeRes.json();
    
    // 2. Ask VERA extension for ZK-proof
    return new Promise((resolve) => {
      let extTimeout;
      
      const listener = async (event) => {
        if (event.source !== window || !event.data || event.data.type !== "PROOF_GENERATED") return;
        
        clearTimeout(extTimeout);
        window.removeEventListener("message", listener);
        
        if (event.data.error) {
           showToast('Unverified: ' + event.data.error);
           resolve(false);
           return;
        }
        
        // 3. Submit ZK-proof to VERA API for verification
        const submitRes = await fetch('https://vera-api-buru.onrender.com/api/verify/submit', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              proof: event.data.proof,
              revealedMessages: event.data.revealedMessages,
              nonce: nonce
           })
        });
        
        const submitData = await submitRes.json();
        if (submitData.verified) {
           // Store the review under the real user_id so the unique constraint
           // (product_id, user_id) works correctly. The ZK proof already
           // guarantees anonymity — the review text reveals nothing personal.
           try {
             await _insertReview({
               product_id: productId,
               user_id: currentUser.id,
               user_name: "VERA Verified Buyer",
               rating: rating || 5,
               text: text || "",
               verified_purchase: true,
               verified_id: false,
               id_verification_score: 100,
               ...(orderId ? { order_id: orderId } : {}),
             });
           } catch(dbErr) {
             // 409 duplicate = already reviewed; treat as success
             if (dbErr?.status !== 409 && dbErr?._supabase?.code !== '23505') {
               showToast('Failed to save review');
               resolve(false);
               return;
             }
           }

           showToast('Review securely verified and posted!');
           loadProductReviews(productId);
           resolve(true);
        } else {
           showToast('<svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></g></svg> Verification failed');
           resolve(false);
        }
      };
      
      window.addEventListener("message", listener);
      window.postMessage({ source: "VERA_WIDGET", type: "GENERATE_PROOF", storeID: p.store_name, itemSKU: p.sku, nonce: nonce }, "*");
      
      // Timeout after 10s
      extTimeout = setTimeout(() => {
        window.removeEventListener("message", listener);
        showToast('VERA extension did not respond in time.');
        resolve(false);
      }, 10000);
    });
  } catch (err) {
    console.error("VERA Error:", err);
    showToast('Failed to connect to VERA verification server');
    return false;
  }
}

/**
 * Returns true if the current user has at least one order with
 * order_status = 'received' or 'delivered' that contains productId.
 */
async function hasReceivedProduct(productId) {
  if (!currentUser) return false;
  const { url, key } = getConfig();
  if (!url || !key) return false;
  try {
    // Single efficient query: join order_items → orders filtered by user + status
    const res = await fetch(
      `${url}/rest/v1/order_items?product_id=eq.${productId}&select=order_id,orders!inner(id)&orders.user_id=eq.${currentUser.id}&orders.order_status=in.(received,delivered)&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Mark an order as received by the customer.
 * Updates order_status to 'received' in the database.
 */
async function confirmReceipt(orderId) {
  if (!currentUser) { showToast('Please sign in'); return false; }
  const { url, key } = getConfig();
  if (!url || !key) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const res = await fetch(
      `${url}/rest/v1/orders?id=eq.${orderId}&user_id=eq.${currentUser.id}`,
      {
        method: 'PATCH',
        signal: controller.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_status: 'received' }),
      }
    );
    clearTimeout(timeout);
    if (res.ok) {
      showToast('Order marked as received');
      return true;
    }
    const err = await res.json().catch(() => ({}));
    console.error('[SF] confirmReceipt failed:', res.status, err);
    showToast('Failed to confirm receipt: ' + (err.message || res.status));
    return false;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      showToast('Confirm receipt timed out. Please try again.');
    } else {
      console.error('[SF] confirmReceipt error:', e);
      showToast('Failed to confirm receipt. Please try again.');
    }
    return false;
  }
}

async function loadProductReviews(productId) {
  const reviews = await db(`/reviews?product_id=eq.${productId}&order=created_at.desc`);
  productReviews[productId] = reviews || [];
  return productReviews[productId];
}

/* ===== USER AUTH ===== */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

async function registerUser(name, email, password) {
  const result = await db('/users', 'POST', { name, email, password_hash: simpleHash(password) });
  if (result) return { success: true, user: result[0] || result };
  return { success: false, error: 'Email already exists or invalid' };
}

async function loginUser(email, password) {
  const users = await db(`/users?email=eq.${encodeURIComponent(email)}`);
  if (!users || users.length === 0) return { success: false, error: 'User not found' };
  const user = users[0];
  if (user.password_hash === simpleHash(password)) {
    return { success: true, user: { name: user.name, email: user.email, id: user.id } };
  }
  return { success: false, error: 'Invalid password' };
}

/* ===== IDENTITY VERIFICATION ===== */
async function verifyUserIdentity({ idType, idNumber }) {
  if (!currentUser) { showToast('Please sign in first'); return false; }

  // Score heuristic: passport/national-id → 80, driver's licence → 60, email → 40
  const scoreMap = { 'passport': 80, 'national-id': 75, 'drivers-license': 60, 'email': 40 };
  const score = scoreMap[idType] || 50;

  // Upsert — one row per user (UNIQUE constraint on user_id)
  const existing = await db(`/user_verifications?user_id=eq.${currentUser.id}&limit=1`);
  let result;
  if (existing && existing.length > 0) {
    result = await db(
      `/user_verifications?user_id=eq.${currentUser.id}`,
      'PATCH',
      {
        id_type:             idType,
        id_number:           idNumber,
        verification_status: 'verified',
        verification_score:  score,
        updated_at:          new Date().toISOString(),
      }
    );
  } else {
    result = await db('/user_verifications', 'POST', {
      user_id:             currentUser.id,
      id_type:             idType,
      id_number:           idNumber,
      verification_status: 'verified',
      verification_score:  score,
    });
  }

  if (result) {
    showToast('Identity verified');
    // Update the "Verify ID" button in the account modal if present
    const verifBtn = document.getElementById('verif-status');
    if (verifBtn) verifBtn.textContent = 'ID Verified';
    return true;
  }
  showToast('Verification failed. Please try again.');
  return false;
}

/* ===== ORDERS ===== */

// When not null, checkout operates on this single item only (Buy Now flow).
// Set by openBuyNowCheckout(), cleared after order is placed or modal is closed.
let buyNowItem = null;   // { productId, qty }

function checkout() {
  if (getCartCount() === 0) { showToast('Your cart is empty!'); return; }
  if (cartSelected.size === 0) { showToast('Please select at least one item to checkout'); return; }
  if (!currentUser) { closeCart(); openAuthModal(); showToast('Please sign in to checkout'); return; }
  // Persist selected items to sessionStorage so checkout.html can read them
  sessionStorage.removeItem('sf_buyNowItem');
  sessionStorage.setItem('sf_checkoutSelected', JSON.stringify([...cartSelected]));
  closeCart();
  window.location.href = 'checkout.html';
}

/** Called by "Buy Now" on the product page — bypasses the cart entirely. */
function openBuyNowCheckout(productId, qty) {
  if (!currentUser) { openAuthModal(); showToast('Please sign in to checkout'); return; }
  sessionStorage.setItem('sf_buyNowItem', JSON.stringify({ productId, qty }));
  sessionStorage.removeItem('sf_checkoutSelected');
  window.location.href = 'checkout.html';
}

function openCheckoutModal() {
  renderCheckoutSummary();
  document.getElementById('checkoutModal').classList.add('open');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('open');
  buyNowItem = null;   // always clear on close
  // Clear delivery fields
  const names = ['checkoutContactName', 'checkoutContactNumber', 'checkoutAddress'];
  names.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function renderCheckoutSummary() {
  const container = document.getElementById('checkoutItems');
  if (!container) return;

  // Determine which items to show — buy-now single item or selected cart items
  const items = buyNowItem
    ? [{ id: buyNowItem.productId, qty: buyNowItem.qty }]
    : Object.entries(cart)
        .filter(([id]) => cartSelected.has(id))
        .map(([id, qty]) => ({ id, qty }));

  container.innerHTML = items.map(({ id, qty }) => {
    const p = PRODUCTS.find(p => p.id === id);
    if (!p) return '';
    const thumb = `<img src="${productThumb(p)}" alt="${p.name}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;" />`;
    return `<div class="checkout-item">
      ${thumb}
      <span class="checkout-item-name">${p.name} <span style="color:var(--muted)">x${qty}</span></span>
      <span class="checkout-item-price">₱${(p.price * qty).toLocaleString()}</span>
    </div>`;
  }).join('');

  const subtotal = buyNowItem
    ? (() => { const p = PRODUCTS.find(p => p.id === buyNowItem.productId); return p ? p.price * buyNowItem.qty : 0; })()
    : getSelectedTotal();
  const shipping = subtotal >= 2000 ? 0 : 99;
  const total    = subtotal + shipping;

  document.getElementById('checkoutSubtotal').textContent = '₱' + subtotal.toLocaleString();
  document.getElementById('checkoutShipping').textContent = shipping === 0 ? 'FREE' : '₱' + shipping;
  document.getElementById('checkoutTotal').textContent    = '₱' + total.toLocaleString();
}

async function placeOrder() {
  if (!currentUser) { showToast('Please sign in'); openAuthModal(); return; }

  const paymentMethod = document.getElementById('coPayment')?.value;
  if (!paymentMethod) { showToast('Please select a payment method'); return; }

  // Get selected address
  const addr = savedAddresses.find(a => a.id === selectedAddressId);
  if (!addr) { showToast('Please select a delivery address'); return; }
  const shippingAddress = `Contact: ${addr.contact_name} | Phone: ${addr.contact_number}\nAddress: ${addr.address}`;

  // Save last-used address id for next checkout
  localStorage.setItem('sf_lastAddressId', selectedAddressId);

  // Determine items to order — buy-now (from sessionStorage) or selected cart items
  const bnRaw = sessionStorage.getItem('sf_buyNowItem');
  buyNowItem = bnRaw ? JSON.parse(bnRaw) : null;

  const itemsToOrder = buyNowItem
    ? { [buyNowItem.productId]: buyNowItem.qty }
    : (() => {
        const sel = JSON.parse(sessionStorage.getItem('sf_checkoutSelected') || '[]');
        return Object.fromEntries(Object.entries(cart).filter(([id]) => sel.includes(id)));
      })();

  if (Object.keys(itemsToOrder).length === 0) { showToast('Nothing to order'); return; }

  // Validate all items still have enough stock
  for (const [productId, qty] of Object.entries(itemsToOrder)) {
    const p = PRODUCTS.find(p => p.id === productId);
    if (p && qty > p.stock) {
      showToast(`"${p.name}" only has ${p.stock} in stock`);
      return;
    }
  }

  const subtotal = buyNowItem
    ? (() => { const p = PRODUCTS.find(p => p.id === buyNowItem.productId); return p ? p.price * buyNowItem.qty : 0; })()
    : Object.entries(itemsToOrder).reduce((sum, [productId, qty]) => {
        const p = PRODUCTS.find(p => p.id === productId);
        return sum + (p ? p.price * qty : 0);
      }, 0);
  const shippingFee = subtotal >= 2000 ? 0 : 99;
  const total       = subtotal + shippingFee;
  const orderNumber = 'SF-' + Date.now().toString(36).toUpperCase();

  // 1. Create the order row
  const orderResult = await db('/orders', 'POST', {
    order_number:     orderNumber,
    user_id:          currentUser.id,
    subtotal,
    shipping_fee:     shippingFee,
    total,
    payment_method:   paymentMethod,
    payment_status:   'pending',
    order_status:     'pending',
    shipping_address: shippingAddress,
  });

  if (!orderResult) { showToast('Failed to place order. Please try again.'); return; }
  const savedOrder = Array.isArray(orderResult) ? orderResult[0] : orderResult;

  // 2. Insert order_items
  const orderItems = Object.entries(itemsToOrder).map(([productId, qty]) => {
    const product   = PRODUCTS.find(p => p.id === productId);
    const unitPrice = product ? product.price : 0;
    return {
      order_id:    savedOrder.id,
      product_id:  productId,
      quantity:    qty,
      unit_price:  unitPrice,
      total_price: unitPrice * qty,
    };
  });
  await db('/order_items', 'POST', orderItems);

  // NEW VERA FLOW: Request credentials for each ordered item from the backend
  console.log("[VERA] 🚀 Starting credential issuance for", Object.keys(itemsToOrder).length, "item(s)...");
  if (!window._veraExtensionReady) {
    console.warn("[VERA] ⚠️ VERA Extension was NOT detected on this page. Credentials will be issued but may not reach the vault.");
  }
  for (const [productId, qty] of Object.entries(itemsToOrder)) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (product && product.sku) {
      try {
        console.log("[VERA] 🔑 Requesting credential from backend for SKU:", product.sku);
        const credRes = await fetch('https://vera-api-buru.onrender.com/api/credentials/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeID: product.store_name, itemSKU: product.sku })
        });
        const credData = await credRes.json();
        console.log("[VERA] Backend response:", credData.success ? "SUCCESS" : "FAILED", credData);
        if (credData.success && credData.credential) {
          console.log("[VERA] 📤 Sending STORE_CREDENTIAL to extension via postMessage...");
          // Listen for the extension's confirmation
          const storePromise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.error("[VERA] ⏰ Timeout: Extension did not respond within 5s. Is the extension installed and reloaded?");
              window.removeEventListener("message", veraStoreListener);
              resolve(false);
            }, 5000);
            function veraStoreListener(event) {
              if (event.data?.source === "VERA_EXTENSION" && event.data?.type === "CREDENTIAL_STORED") {
                console.log("[VERA] Extension confirmed: Credential stored successfully!");
                clearTimeout(timeout);
                window.removeEventListener("message", veraStoreListener);
                resolve(true);
              }
              if (event.data?.source === "VERA_EXTENSION" && event.data?.type === "STORE_ERROR") {
                console.error("[VERA] Extension reported store error:", event.data.error);
                clearTimeout(timeout);
                window.removeEventListener("message", veraStoreListener);
                resolve(false);
              }
              if (event.data?.source === "VERA_EXTENSION" && event.data?.type === "ERROR") {
                console.error("[VERA] Extension service worker error:", event.data.error);
                clearTimeout(timeout);
                window.removeEventListener("message", veraStoreListener);
                resolve(false);
              }
            }
            window.addEventListener("message", veraStoreListener);
          });
          window.postMessage({
            source: "VERA_WIDGET",
            type: "STORE_CREDENTIAL",
            credential: credData.credential,
            rawMessages: credData.rawMessages,
            signature: credData.signature,
            publicKey: credData.publicKey
          }, "*");
          const stored = await storePromise;
        }
      } catch (err) {
        console.error("[VERA] Failed to issue credential:", err);
      }
    }
  }

  // 3. Deduct stock for each ordered product
  await Promise.all(
    Object.entries(itemsToOrder).map(async ([productId, qty]) => {
      const product = PRODUCTS.find(p => p.id === productId);
      if (!product) return;
      const newStock = Math.max(0, product.stock - qty);
      await db(`/products?id=eq.${productId}`, 'PATCH', { stock: newStock });
      product.stock = newStock;   // update local cache immediately
    })
  );

  // 4. Clear only the ordered (selected) items from cart if this was a normal cart checkout
  if (!buyNowItem) {
    for (const productId of Object.keys(itemsToOrder)) {
      delete cart[productId];
      cartSelected.delete(productId);
      if (cartId) {
        await db(`/cart_items?cart_id=eq.${cartId}&product_id=eq.${productId}`, 'DELETE');
      }
    }
    // If nothing left in the cart, also clean up the cart record
    if (Object.keys(cart).length === 0) {
      cartId = null;
    }
    saveSession();
    updateCartUI();
  }

  // 5. Clear buy-now state
  buyNowItem = null;
  sessionStorage.removeItem('sf_buyNowItem');
  sessionStorage.removeItem('sf_checkoutSelected');

  // Close old modal if present (non-checkout.html pages), then show success
  if (document.getElementById('checkoutModal')) closeCheckoutModal();
  showOrderSuccess(savedOrder.id, orderNumber, total);
}

function showOrderSuccess(orderId, orderNumber, total) {
  const modal = document.getElementById('orderSuccessModal');
  if (!modal) return;
  document.getElementById('successOrderNumber').textContent = orderNumber;
  document.getElementById('successOrderTotal').textContent  = '₱' + total.toLocaleString();
  // Update payment label if element exists (checkout.html has successPaymentMethod)
  const pmEl = document.getElementById('successPaymentMethod');
  if (pmEl) {
    const pm = document.getElementById('coPayment')?.value || 'cash_on_delivery';
    pmEl.textContent = pm === 'cash_on_delivery' ? 'Cash on Delivery' : pm;
  }
  modal.classList.add('open');
}

function closeOrderSuccess() {
  document.getElementById('orderSuccessModal').classList.remove('open');
}

async function loadUserOrders() {
  if (!currentUser) return [];
  const orders = await db(`/orders?user_id=eq.${currentUser.id}&order=created_at.desc`);
  if (!orders || orders.length === 0) return [];

  // Fetch ALL order_items for all orders in one query
  const orderIds = orders.map(o => o.id);
  let allItems = [];
  try {
    allItems = await db(
      `/order_items?order_id=in.(${orderIds.join(',')})&select=id,order_id,product_id,quantity,unit_price,total_price`
    ) || [];
  } catch(e) {
    console.error('[SF] Failed to batch-fetch order_items, falling back:', e);
    // Fallback: fetch sequentially
    for (const order of orders) {
      const items = await db(`/order_items?order_id=eq.${order.id}&select=id,order_id,product_id,quantity,unit_price,total_price`) || [];
      allItems.push(...items);
    }
  }

  // Fetch ALL products referenced by those items in one query
  const productIds = [...new Set(allItems.map(i => i.product_id).filter(Boolean))];
  const productMap = {};
  if (productIds.length > 0) {
    try {
      const products = await db(
        `/products?id=in.(${productIds.join(',')})&select=id,product_name,emoji,image_urls,sku`
      ) || [];
      products.forEach(p => { productMap[p.id] = p; });
    } catch(e) {
      console.error('[SF] Failed to batch-fetch products for orders:', e);
    }
  }

  // Group items by order_id and attach product info
  const itemsByOrder = {};
  allItems.forEach(i => {
    if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
    itemsByOrder[i.order_id].push({ ...i, product: productMap[i.product_id] || null });
  });

  orders.forEach(o => { o.items = itemsByOrder[o.id] || []; });
  return orders;
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  // Load all merchant products from the DB before rendering anything
  await loadAllProducts();

  loadSession();
  updateCartUI();
  updateAccountUI();

  // Close modal on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Cart overlay close
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

  // Search — clear on load to prevent autofill, only navigate on explicit Enter
  document.querySelectorAll('.search-input').forEach(el => {
    el.value = '';  // clear any browser-autofilled value immediately
    el.addEventListener('keydown', handleSearch);
    // Prevent type="search" from triggering navigation on non-Enter events
    el.addEventListener('search', e => e.preventDefault());
  });

  // Enter key on auth forms
  document.getElementById('loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('regPass')?.addEventListener('keydown',  e => { if (e.key === 'Enter') doRegister(); });

  // Reload cart from DB if already logged in
  if (currentUser) {
    loadCartFromDB();
  }
});

/* ===================================================
   SAVED ADDRESSES
   =================================================== */

/** Fetch this user's saved addresses from DB and update cache. */
async function loadSavedAddresses() {
  if (!currentUser) return [];
  try {
    const rows = await db(`/saved_addresses?user_id=eq.${currentUser.id}&order=created_at.asc`);
    savedAddresses = rows || [];
  } catch (e) {
    // Table may not exist yet — treat as null so UI can show migration notice
    console.warn('[SF] saved_addresses table not available:', e.message || e);
    savedAddresses = null;
  }
  return savedAddresses;
}

/** Open the Manage Addresses modal and render the list. */
async function openAddressesModal() {
  if (!currentUser) { openAuthModal(); return; }
  const modal = document.getElementById('addressesModal');
  if (!modal) return;
  modal.classList.add('open');
  // Close the new-address form if it was open
  document.getElementById('addrNewForm')?.classList.remove('open');
  await loadSavedAddresses();
  renderAddressesModalList();
}

function closeAddressesModal() {
  document.getElementById('addressesModal')?.classList.remove('open');
  // If we're on checkout.html, refresh the address picker
  if (document.getElementById('coAddressList')) {
    renderCheckoutPageAddresses();
  }
}

/** Render the saved address list inside the Manage Addresses modal. */
function renderAddressesModalList() {
  const container = document.getElementById('addrModalList');
  if (!container) return;

  if (!savedAddresses || savedAddresses.length === 0) {
    const msg = savedAddresses === null
      ? '<p style="color:#92400e;font-size:13px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:0.75rem;margin:0 1.5rem 0.5rem;">⚠️ Run <code>migration_saved_addresses.sql</code> in Supabase to enable saved addresses.</p>'
      : `<div class="addr-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><p>No saved addresses yet.</p></div>`;
    container.innerHTML = msg;
    return;
  }

  container.innerHTML = savedAddresses.map(addr => `
    <div class="addr-row" data-id="${addr.id}" onclick="selectCheckoutAddress('${addr.id}')">
      <div class="addr-radio-dot ${addr.id === selectedAddressId ? 'checked' : ''}"></div>
      <div class="addr-row-body">
        <div class="addr-row-name">
          <span>${escHtml(addr.contact_name)}</span>
          <span class="addr-row-sep">|</span>
          <span class="addr-row-phone">${escHtml(addr.contact_number)}</span>
          ${addr.is_default ? '<span class="addr-default-pill">Default</span>' : ''}
          ${addr.label ? `<span class="addr-label-pill">${escHtml(addr.label)}</span>` : ''}
        </div>
        <div class="addr-row-addr">${escHtml(addr.address)}</div>
      </div>
      <div class="addr-row-actions" onclick="event.stopPropagation()">
        ${!addr.is_default ? `<button class="addr-row-edit" onclick="setDefaultAddress('${addr.id}')">Set default</button>` : ''}
        <button class="addr-row-del" onclick="deleteAddress('${addr.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

/** Handle label chip selection in the new address form. */
function selectLabelChip(el, value) {
  document.querySelectorAll('.addr-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const inp = document.getElementById('anLabel');
  if (inp) inp.value = value;
}

/** Toggle the "Add new address" form inside the modal. */
function toggleNewAddressForm() {
  const form = document.getElementById('addrNewForm');
  if (!form) return;
  form.classList.toggle('open');
  if (form.classList.contains('open')) {
    document.getElementById('anContactName').value   = '';
    document.getElementById('anContactNumber').value = '';
    const labelInp = document.getElementById('anLabel');
    if (labelInp) labelInp.value = '';
    document.getElementById('anAddress').value = '';
    const defCb = document.getElementById('anIsDefault');
    if (defCb) defCb.checked = Array.isArray(savedAddresses) && savedAddresses.length === 0;
    // Reset label chips
    document.querySelectorAll('.addr-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('anContactName').focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/** Save a new address from the modal form. */
async function saveNewAddress() {
  if (!currentUser) return;
  const contactName   = document.getElementById('anContactName')?.value.trim();
  const contactNumber = document.getElementById('anContactNumber')?.value.trim();
  const label         = document.getElementById('anLabel')?.value.trim();
  const address       = document.getElementById('anAddress')?.value.trim();
  const isDefault     = document.getElementById('anIsDefault')?.checked || false;

  if (!contactName)   { showToast('Please enter a contact name');   return; }
  if (!contactNumber) { showToast('Please enter a contact number'); return; }
  if (!address)       { showToast('Please enter a delivery address'); return; }

  // If setting as default, unset current default first
  if (isDefault) await unsetCurrentDefault();

  let result;
  try {
    result = await db('/saved_addresses', 'POST', {
      user_id:        currentUser.id,
      label:          label || null,
      contact_name:   contactName,
      contact_number: contactNumber,
      address,
      is_default:     isDefault,
    });
  } catch (e) {
    showToast('Could not save address — make sure the migration has been run in Supabase.');
    console.error('[SF] saveNewAddress error:', e);
    return;
  }

  if (!result) { showToast('Failed to save address'); return; }

  showToast('Address saved');
  toggleNewAddressForm();
  await loadSavedAddresses();
  renderAddressesModalList();

  // Auto-select the new address on the checkout page
  const newAddr = Array.isArray(result) ? result[0] : result;
  if (newAddr?.id) {
    selectedAddressId = newAddr.id;
    localStorage.setItem('sf_lastAddressId', newAddr.id);
  }
  if (document.getElementById('coAddressList')) renderCheckoutPageAddresses();
}

/** Set an address as the default. */
async function setDefaultAddress(addrId) {
  if (!currentUser) return;
  await unsetCurrentDefault();
  await db(`/saved_addresses?id=eq.${addrId}&user_id=eq.${currentUser.id}`, 'PATCH', { is_default: true });
  await loadSavedAddresses();
  renderAddressesModalList();
  if (document.getElementById('coAddressList')) renderCheckoutPageAddresses();
  showToast('Default address updated');
}

/** Delete a saved address. */
async function deleteAddress(addrId) {
  if (!currentUser) return;
  await db(`/saved_addresses?id=eq.${addrId}&user_id=eq.${currentUser.id}`, 'DELETE');
  if (selectedAddressId === addrId) {
    selectedAddressId = null;
    localStorage.removeItem('sf_lastAddressId');
  }
  await loadSavedAddresses();
  renderAddressesModalList();
  if (document.getElementById('coAddressList')) renderCheckoutPageAddresses();
  showToast('Address deleted');
}

/** Clear the is_default flag on whichever address currently has it. */
async function unsetCurrentDefault() {
  const cur = savedAddresses.find(a => a.is_default);
  if (cur) {
    await db(`/saved_addresses?id=eq.${cur.id}`, 'PATCH', { is_default: false });
  }
}

/** Escape HTML to prevent XSS in rendered address strings. */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ===================================================
   CHECKOUT PAGE (checkout.html)
   =================================================== */

/** Render the item list + price summary on checkout.html. */
function renderCheckoutPageItems() {
  const container = document.getElementById('coItems');
  if (!container) return;

  // Restore items from sessionStorage
  const bnRaw = sessionStorage.getItem('sf_buyNowItem');
  buyNowItem = bnRaw ? JSON.parse(bnRaw) : null;
  const selRaw = sessionStorage.getItem('sf_checkoutSelected');
  const selectedIds = selRaw ? JSON.parse(selRaw) : [];

  const items = buyNowItem
    ? [{ id: buyNowItem.productId, qty: buyNowItem.qty }]
    : Object.entries(cart)
        .filter(([id]) => selectedIds.includes(id))
        .map(([id, qty]) => ({ id, qty }));

  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px;text-align:center;padding:1rem 0;">No items to checkout.</p>';
    return;
  }

  container.innerHTML = items.map(({ id, qty }) => {
    const p = PRODUCTS.find(p => p.id === id);
    if (!p) return '';
    const thumb = p.image_urls?.[0]
      ? `<img class="co-item-thumb" src="${p.image_urls[0]}" alt="${escHtml(p.name)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid var(--border);" />`
      : `<div class="co-item-thumb" style="width:64px;height:64px;border-radius:8px;flex-shrink:0;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:28px;">${p.emoji || '📦'}</div>`;
    return `<div class="co-item-row">
      ${thumb}
      <div class="co-item-info">
        <div class="co-item-name">${escHtml(p.name)}</div>
        <div class="co-item-qty">x${qty}</div>
      </div>
      <div class="co-item-price">₱${(p.price * qty).toLocaleString()}</div>
    </div>`;
  }).join('');

  // Price totals
  const subtotal = buyNowItem
    ? (() => { const p = PRODUCTS.find(p => p.id === buyNowItem.productId); return p ? p.price * buyNowItem.qty : 0; })()
    : items.reduce((sum, { id, qty }) => {
        const p = PRODUCTS.find(p => p.id === id);
        return sum + (p ? p.price * qty : 0);
      }, 0);
  const shipping = subtotal >= 2000 ? 0 : 99;
  const total    = subtotal + shipping;

  document.getElementById('coSubtotal').textContent  = '₱' + subtotal.toLocaleString();
  document.getElementById('coShipping').textContent  = shipping === 0 ? 'FREE' : '₱' + shipping;
  document.getElementById('coTotal').textContent     = '₱' + total.toLocaleString();
  document.getElementById('coTotalBar').textContent  = '₱' + total.toLocaleString();
}

/** Render the address picker on checkout.html. */
async function renderCheckoutPageAddresses() {
  const container = document.getElementById('coAddrBanner');
  if (!container) return;

  await loadSavedAddresses();

  // Table missing
  if (savedAddresses === null) {
    container.innerHTML = `<div class="co-migration-warn">⚠️ Run <code>migration_saved_addresses.sql</code> in Supabase to enable saved addresses.</div>`;
    return;
  }

  if (savedAddresses.length === 0) {
    container.innerHTML = `
      <div class="co-addr-empty" onclick="openAddressesModal()" style="cursor:pointer;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="font-size:14px;color:var(--muted);">No delivery address — tap to add one</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;color:var(--faint);"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    selectedAddressId = null;
    return;
  }

  // Determine pre-selected address
  const lastId = localStorage.getItem('sf_lastAddressId');
  const defaultAddr = savedAddresses.find(a => a.is_default);
  const candidate = savedAddresses.find(a => a.id === lastId) || defaultAddr || savedAddresses[0];
  if (!selectedAddressId || !savedAddresses.find(a => a.id === selectedAddressId)) {
    selectedAddressId = candidate?.id || null;
  }

  const addr = savedAddresses.find(a => a.id === selectedAddressId) || savedAddresses[0];
  if (!addr) return;

  container.innerHTML = `
    <div class="co-addr-banner" onclick="openAddressesModal()" title="Change address">
      <svg class="co-addr-pin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <div class="co-addr-content">
        <div class="co-addr-top">
          <span class="co-addr-name">${escHtml(addr.contact_name)}</span>
          <span class="co-addr-phone">(+63) ${escHtml(addr.contact_number.replace(/^0/, ''))}</span>
          ${addr.is_default ? '<span class="co-addr-badge">Default</span>' : ''}
          ${addr.label ? `<span style="font-size:11px;background:var(--border);color:var(--muted);padding:1px 7px;border-radius:3px;font-weight:600;">${escHtml(addr.label)}</span>` : ''}
        </div>
        <div class="co-addr-line">${escHtml(addr.address)}</div>
      </div>
      <svg class="co-addr-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
}

/** Select a delivery address on the checkout page. */
function selectCheckoutAddress(addrId) {
  selectedAddressId = addrId;
  localStorage.setItem('sf_lastAddressId', addrId);
  // Re-render the banner immediately
  renderCheckoutPageAddresses();
  // Update radio dots in the modal list
  document.querySelectorAll('#addrModalList .addr-radio-dot').forEach(dot => dot.classList.remove('checked'));
  const chosen = document.querySelector(`#addrModalList [data-id="${addrId}"] .addr-radio-dot`);
  if (chosen) chosen.classList.add('checked');
}
