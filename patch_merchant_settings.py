import re

with open('merchant.html', 'r') as f:
    content = f.read()

# 1. Remove Topbar Search and Notification Bell
topbar_find = """      <div class="topbar-right">
        <div class="topbar-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Search orders, products…" />
        </div>
        <button class="icon-btn" title="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="dot"></span>
        </button>"""

topbar_repl = """      <div class="topbar-right">"""
content = content.replace(topbar_find, topbar_repl)


# 2. Add IDs to the rest of the settings form
html_find = """            <div class="form-group">
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
            <div class="card-header" style="margin-top:0.5rem"><h2>Notification preferences</h2></div>
            <div class="toggle-row">
              <div><div class="t-title">New order alerts</div><div class="t-sub">Get notified when a customer places an order</div></div>
              <div class="switch on"></div>
            </div>
            <div class="toggle-row">
              <div><div class="t-title">Low stock alerts</div><div class="t-sub">Get notified when a product is running low</div></div>
              <div class="switch on"></div>
            </div>
            <div class="toggle-row">
              <div><div class="t-title">Review notifications</div><div class="t-sub">Get notified for new customer reviews</div></div>
              <div class="switch"></div>
            </div>
            <div class="toggle-row">
              <div><div class="t-title">Marketing emails</div><div class="t-sub">Tips and product updates from Shopfinity</div></div>
              <div class="switch"></div>
            </div>
          </div>"""

html_repl = """            <div class="form-group">
              <label>Store description</label>
              <textarea id="settingsStoreDesc" rows="3" placeholder="Tell customers about your store..."></textarea>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Contact email</label>
                <input type="email" id="settingsStoreEmail" placeholder="e.g. hello@shop.com" />
              </div>
              <div class="form-group">
                <label>Contact phone</label>
                <input type="tel" id="settingsStorePhone" placeholder="+63 900 000 0000" />
              </div>
            </div>
            <div class="form-group">
              <label>Business category</label>
              <select id="settingsCategory">
                <option value="Food & Grocery">Food &amp; Grocery</option>
                <option value="Electronics">Electronics</option>
                <option value="Clothing">Clothing</option>
                <option value="Home & Garden">Home &amp; Garden</option>
                <option value="Sports">Sports</option>
              </select>
            </div>
          </div>

          <div class="card">
            <div class="card-header" style="margin-top:0.5rem"><h2>Notification preferences</h2></div>
            <div class="toggle-row">
              <div><div class="t-title">New order alerts</div><div class="t-sub">Get notified when a customer places an order</div></div>
              <div class="switch on" id="settingsNotif1" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="toggle-row">
              <div><div class="t-title">Low stock alerts</div><div class="t-sub">Get notified when a product is running low</div></div>
              <div class="switch on" id="settingsNotif2" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="toggle-row">
              <div><div class="t-title">Review notifications</div><div class="t-sub">Get notified for new customer reviews</div></div>
              <div class="switch" id="settingsNotif3" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="toggle-row">
              <div><div class="t-title">Marketing emails</div><div class="t-sub">Tips and product updates from Shopfinity</div></div>
              <div class="switch" id="settingsNotif4" onclick="this.classList.toggle('on')"></div>
            </div>
          </div>"""

content = content.replace(html_find, html_repl)


# 3. Add population of settings
js_pop_find = """      if (snameInput && s.store_name) snameInput.value = s.store_name;
      if (semailInput && s.email) semailInput.value = s.email;"""

js_pop_repl = """      if (snameInput && s.store_name) snameInput.value = s.store_name;
      if (semailInput && s.email) semailInput.value = s.email;
      
      const sdescInput = document.getElementById('settingsStoreDesc');
      const sphoneInput = document.getElementById('settingsStorePhone');
      const scatInput = document.getElementById('settingsCategory');
      
      if (sdescInput && s.store_desc) sdescInput.value = s.store_desc;
      if (sphoneInput && s.store_phone) sphoneInput.value = s.store_phone;
      if (scatInput && s.store_cat) scatInput.value = s.store_cat;
      
      if (s.notifs) {
        if (s.notifs.n1 !== undefined) document.getElementById('settingsNotif1')?.classList.toggle('on', s.notifs.n1);
        if (s.notifs.n2 !== undefined) document.getElementById('settingsNotif2')?.classList.toggle('on', s.notifs.n2);
        if (s.notifs.n3 !== undefined) document.getElementById('settingsNotif3')?.classList.toggle('on', s.notifs.n3);
        if (s.notifs.n4 !== undefined) document.getElementById('settingsNotif4')?.classList.toggle('on', s.notifs.n4);
      }"""

content = content.replace(js_pop_find, js_pop_repl)


# 4. Add saving of settings
js_save_find = """      if (newName) session.store_name = newName;
      if (newEmail) session.email = newEmail;"""

js_save_repl = """      if (newName) session.store_name = newName;
      if (newEmail) session.email = newEmail;
      
      session.store_desc = document.getElementById('settingsStoreDesc')?.value || '';
      session.store_phone = document.getElementById('settingsStorePhone')?.value || '';
      session.store_cat = document.getElementById('settingsCategory')?.value || 'Food & Grocery';
      
      session.notifs = {
        n1: document.getElementById('settingsNotif1')?.classList.contains('on'),
        n2: document.getElementById('settingsNotif2')?.classList.contains('on'),
        n3: document.getElementById('settingsNotif3')?.classList.contains('on'),
        n4: document.getElementById('settingsNotif4')?.classList.contains('on')
      };"""

content = content.replace(js_save_find, js_save_repl)

with open('merchant.html', 'w') as f:
    f.write(content)

