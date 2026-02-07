import json
import os

file_path = os.path.join('config', 'publications.json')

try:
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        data = json.load(f)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Successfully formatted " + file_path)

except Exception as e:
    print("Error: " + str(e))
