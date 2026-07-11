import re

with open('merchant.html', 'r') as f:
    content = f.read()

# 1. Update settings-grid
html_find = """        <div class="settings-grid">"""
html_repl = """        <div class="settings-grid" style="grid-template-columns:1fr; max-width:600px; margin:0 auto;">"""
content = content.replace(html_find, html_repl)

# 2. Remove Export button
export_find = """            <button class="btn btn-outline">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export
            </button>"""
content = content.replace(export_find, "")

with open('merchant.html', 'w') as f:
    f.write(content)

