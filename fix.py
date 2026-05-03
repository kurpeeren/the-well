import io
path = r'frontend/src/components/GameBoard.jsx'
with io.open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("'Dedikoducu': {", "'Gözcü': {")
content = content.replace("'Consort': {", "'Meyhaneci': {")
content = content.replace("'Yanaşma': {", "'Kaçak': {")

content = content.replace("/roles/dedikoducu.png", "/roles/gozcu.jpeg")
content = content.replace("/roles/consort.png", "/roles/meyhaneci.jpeg")
content = content.replace("/roles/yanasma.png", "/roles/kacak.jpeg")
content = content.replace(".png", ".jpeg")

content = content.replace('className="relative w-full h-40', 'className="relative w-full aspect-square')

with io.open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
