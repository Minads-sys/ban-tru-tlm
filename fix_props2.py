import re

with open("src/app/admin/import/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(
    r"    exportUrl\?: string;\n    exportFilename\?: string;\n  exportUrl\?: string;\n  exportFilename\?: string;",
    r"  exportUrl?: string;\n  exportFilename?: string;",
    content
)

content = re.sub(
    r"    exportUrl,\n    exportFilename,\n  exportUrl,\n  exportFilename,",
    r"  exportUrl,\n  exportFilename,",
    content
)

with open("src/app/admin/import/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
