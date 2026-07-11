import re

with open('merchant.html', 'r') as f:
    content = f.read()

# 1. HTML Replacements
html_find = """            <div class="form-row-2" style="margin-top:1.1rem">
              <div class="form-group">
                <label>Store name</label>
                <input type="text" value="GreenLeaf Grocers" />
              </div>
              <div class="form-group">
                <label>Store ID <span style="color:var(--faint); font-weight:400">(storeID)</span></label>
                <input type="text" class="readonly-input" value="STR-GRNLEAF-014" readonly />
                <div class="hint">Matches VERA's credentialSubject.storeID</div>
              </div>
            </div>
            <div class="form-group">
              <label>Store description</label>
              <textarea rows="3">Fresh, locally-sourced groceries delivered to your door.</textarea>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Contact email</label>
                <input type="email" value="hello@greenleafgrocers.test" />
              </div>
              <div class="form-group">
                <label>Contact phone</label>
                <input type="tel" value="+63 900 000 0000" />
              </div>
            </div>
            <div class="form-group">
              <label>Business category</label>
              <select>
                <option>Food &amp; Grocery</option>
                <option>Electronics</option>
                <option>Clothing</option>
                <option>Home &amp; Garden</option>
                <option>Sports</option>
              </select>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h2>Payout details</h2></div>
            <div class="form-group">
              <label>Payout method</label>
              <select>
                <option>Bank transfer</option>
                <option>GCash</option>
                <option>Maya</option>
              </select>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Bank name</label>
                <input type="text" value="BDO Unibank" />
              </div>
              <div class="form-group">
                <label>Account number</label>
                <input type="text" value="•••• •••• 4821" />
              </div>
            </div>
            <div class="form-group">
              <label>Account holder name</label>
              <input type="text" value="Maria Santos" />
            </div>

            <div class="card-header" style="margin-top:0.5rem"><h2>Notification preferences</h2></div>"""

html_repl = """            <div class="form-group" style="margin-top:1.1rem">
              <label>Store name</label>
              <input type="text" id="settingsStoreName" placeholder="e.g. Shopfinity" />
            </div>
            <div class="form-group">
              <label>Store description</label>
              <textarea rows="3" placeholder="Tell customers about your store..."></textarea>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Contact email</label>
                <input type="email" id="settingsStoreEmail" placeholder="e.g. hello@shop.com" />
              </div>
              <div class="form-group">
                <label>Contact phone</label>
                <input type="tel" placeholder="+63 900 000 0000" />
              </div>
            </div>
            <div class="form-group">
              <label>Business category</label>
              <select>
                <option>Food &amp; Grocery</option>
                <option>Electronics</option>
                <option>Clothing</option>
                <option>Home &amp; Garden</option>
                <option>Sports</option>
              </select>
            </div>
          </div>

          <div class="card">
            <div class="card-header" style="margin-top:0.5rem"><h2>Notification preferences</h2></div>"""

content = content.replace(html_find, html_repl)

# 2. Add setting value population to populateMerchantUI()
js_find = """      if (greetEl) greetEl.innerHTML = `${greeting}, ${(s.name || 'Merchant').split(' ')[0]} <svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-1.5-5.8-3.3l-3.2-4.5A1.9 1.9 0 0 1 6 13l4-2"></path></g></svg>`;"""

js_repl = """      if (greetEl) greetEl.innerHTML = `${greeting}, ${(s.name || 'Merchant').split(' ')[0]} <svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-1.5-5.8-3.3l-3.2-4.5A1.9 1.9 0 0 1 6 13l4-2"></path></g></svg>`;
      const snameInput = document.getElementById('settingsStoreName');
      const semailInput = document.getElementById('settingsStoreEmail');
      if (snameInput && s.store_name) snameInput.value = s.store_name;
      if (semailInput && s.email) semailInput.value = s.email;"""

content = content.replace(js_find, js_repl)

# 3. Replace saveStoreSettings()
js_save_find = """  function saveStoreSettings() {
    const btn = document.querySelector('.settings-footer .btn-primary');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    // Persist display name / store name into session
    try {
      const nameInput  = document.querySelector('.settings-grid input[type="text"]');
      const emailInput = document.querySelector('.settings-grid input[type="email"]');
      const session    = JSON.parse(sessionStorage.getItem('shopfinity_merchant') || '{}');
      if (nameInput?.value)  session.store_name = nameInput.value.trim();
      if (emailInput?.value) session.email      = emailInput.value.trim();
      sessionStorage.setItem('shopfinity_merchant', JSON.stringify(session));
      // Reflect in topbar
      const nameEl  = document.getElementById('merchantDisplayName');
      const emailEl = document.getElementById('merchantDisplayEmail');
      if (nameEl  && session.name)       nameEl.textContent  = session.name;
      if (emailEl && session.store_name) emailEl.textContent = session.store_name;
    } catch(e) {}
    setTimeout(() => {
      if (btn) { btn.textContent = 'Save changes'; btn.disabled = false; }
      showSettingsToast('Settings saved ✓');
    }, 600);
  }"""

js_save_repl = """  async function saveStoreSettings() {
    const btn = document.querySelector('.settings-footer .btn-primary');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
      const nameInput  = document.getElementById('settingsStoreName');
      const emailInput = document.getElementById('settingsStoreEmail');
      const session    = JSON.parse(sessionStorage.getItem('shopfinity_merchant') || '{}');
      
      const newName = nameInput?.value?.trim();
      const newEmail = emailInput?.value?.trim();
      
      if (newName) session.store_name = newName;
      if (newEmail) session.email = newEmail;
      
      // Update DB if merchant has an id
      if (session.merchant_id && newName) {
        const { url, key } = getConfig();
        await fetch(`${url}/rest/v1/merchants?id=eq.${session.merchant_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ store_name: newName })
        });
      }
      
      sessionStorage.setItem('shopfinity_merchant', JSON.stringify(session));
      
      // Reflect in topbar
      const nameEl  = document.getElementById('merchantDisplayName');
      const emailEl = document.getElementById('merchantDisplayEmail');
      if (nameEl  && session.name)       nameEl.textContent  = session.name;
      if (emailEl && session.store_name) emailEl.textContent = session.store_name;
      
    } catch(e) { console.error('Error saving settings', e); }
    
    setTimeout(() => {
      if (btn) { btn.textContent = 'Save changes'; btn.disabled = false; }
      showSettingsToast('Settings saved');
    }, 300);
  }"""

content = content.replace(js_save_find, js_save_repl)

with open('merchant.html', 'w') as f:
    f.write(content)

