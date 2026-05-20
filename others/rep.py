import os

files_to_check = [
    r'backend\server.js',
    r'frontend\src\components\GameBoard.jsx',
    r'roller.md'
]

replacements = {
    'Cinnetkar': 'Seri Katil',
    'Kiralık Katil': 'Eşkıya',
    'Cinnetkar kazanır': 'Seri Katil kazanır'
}

for fp in files_to_check:
    if os.path.exists(fp):
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        for k, v in replacements.items():
            content = content.replace(k, v)
        
        if content != original_content:
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Replaced in {fp}')
        else:
            print(f'No replacements needed or failed to match in {fp}')

print('Script execution finished.')
