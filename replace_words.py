import os

files = [
    'backend/roles.js',
    'backend/GameEngine.js',
    'backend/server.js',
    'frontend/src/components/GameBoard.jsx',
    'frontend/src/App.jsx',
    'roller.md'
]

for file_path in files:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = content.replace('Dilber', 'Eskort')
        content = content.replace('Meyhaneci', 'Consort')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {file_path}')
