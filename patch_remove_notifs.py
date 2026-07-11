import re

with open('merchant.html', 'r') as f:
    content = f.read()

# 1. Remove Notification Preferences HTML
html_find = """          <div class="card">
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

content = content.replace(html_find, "")

# 2. Remove JS population
js_pop_find = """      if (s.notifs) {
        if (s.notifs.n1 !== undefined) document.getElementById('settingsNotif1')?.classList.toggle('on', s.notifs.n1);
        if (s.notifs.n2 !== undefined) document.getElementById('settingsNotif2')?.classList.toggle('on', s.notifs.n2);
        if (s.notifs.n3 !== undefined) document.getElementById('settingsNotif3')?.classList.toggle('on', s.notifs.n3);
        if (s.notifs.n4 !== undefined) document.getElementById('settingsNotif4')?.classList.toggle('on', s.notifs.n4);
      }"""

content = content.replace(js_pop_find, "")

# 3. Remove JS save
js_save_find = """      session.notifs = {
        n1: document.getElementById('settingsNotif1')?.classList.contains('on'),
        n2: document.getElementById('settingsNotif2')?.classList.contains('on'),
        n3: document.getElementById('settingsNotif3')?.classList.contains('on'),
        n4: document.getElementById('settingsNotif4')?.classList.contains('on')
      };"""

content = content.replace(js_save_find, "")

with open('merchant.html', 'w') as f:
    f.write(content)

