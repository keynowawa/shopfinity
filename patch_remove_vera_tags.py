import re

with open('merchant.html', 'r') as f:
    content = f.read()

# 1. Remove the note-box
html_find = """          <div class="note-box" style="margin-bottom:1.5rem">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <div>
              <strong>Product ID</strong> and <strong>SKU</strong> are shown for every listing below. These are the same identifiers the <strong>VERA Vault</strong> extension uses (<span class="code-chip accent">storeID</span> + <span class="code-chip accent">itemSKU</span>) to match a purchase to a verified review credential — keeping them consistent now makes that integration a drop-in later.
            </div>
          </div>"""

content = content.replace(html_find, "")


# 2. Remove VERA-ready tags in HTML
html_find_tag = """<h2 id="add-product-modal-title">Add product <span class="vera-tag">VERA-ready</span></h2>"""
html_repl_tag = """<h2 id="add-product-modal-title">Add product</h2>"""
content = content.replace(html_find_tag, html_repl_tag)


# 3. Remove VERA-ready tags in JS
js_find_tag = """    const title = id
      ? 'Edit product <span class="vera-tag">VERA-ready</span>'
      : 'Add product <span class="vera-tag">VERA-ready</span>';"""
js_repl_tag = """    const title = id ? 'Edit product' : 'Add product';"""
content = content.replace(js_find_tag, js_repl_tag)

with open('merchant.html', 'w') as f:
    f.write(content)

