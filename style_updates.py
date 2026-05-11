# coding: utf-8
import re

# ========== 1. ADICIONAR HTML HAMBURGER MENU ==========
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_sidebar = '''        <aside class="sidebar">
            <div class="sidebar-logo">'''

new_sidebar = '''        <aside class="sidebar" id="sidebar">
            <button class="hamburger" id="hamburger-btn" aria-label="Menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="sidebar-logo">'''

html = html.replace(old_sidebar, new_sidebar)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("HTML: Hamburger menu adicionado")

# ========== 2. ATUALIZAR CSS ==========
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Atualizar root com novas cores e transições
old_root = ':root {'
idx = css.find(old_root)
idx_end = css.find('}', idx) + 1

old_root_block = css[idx:idx_end]

new_root_block = ''':root {
    --bg: #111111;
    --bg-card: #1a1a1a;
    --bg-card-hover: #222222;
    --primary: #eab308;
    --primary-dark: #ca8a04;
    --text: #ffffff;
    --text-muted: #a8a8a8;
    --border: rgba(255, 255, 255, 0.08);
    --danger: #ef4444;
    --warning: #f59e0b;
    --success: #22c55e;
    --info: #3b82f6;
    --sidebar-width: 200px;
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}'''

css = css.replace(old_root_block, new_root_block)

# Salvar CSS com updates
with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("CSS: Root variables atualizadas")
