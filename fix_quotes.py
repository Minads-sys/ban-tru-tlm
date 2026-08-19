with open("src/app/admin/import/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(r'\"', '"')

with open("src/app/admin/import/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
