import re

# Ler HTML original
with open('index.html', 'r') as f:
    content = f.read()

# Padrão para encontrar o chart-card de engajamento
pattern = r'<div class="chart-card">\s*<h3 class="chart-title">Taxa de Engajamento \(%\)</h3>\s*<canvas id="chart-engajamento"></canvas>\s*</div>'

# Ler o novo conteúdo
with open('update_html.txt', 'r') as f:
    replacement = f.read()

# Fazer a substituição
content = re.sub(pattern, replacement, content)

# Escrever de volta
with open('index.html', 'w') as f:
    f.write(content)

print("HTML atualizado com sucesso!")
