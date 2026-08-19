import re

with open("src/app/admin/import/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add export URL for class
content = re.sub(
    r'templateUrl="/api/excel/template\?type=class"\s*\n\s*templateFilename="Template_DanhSach_Lop.xlsx"',
    r'templateUrl="/api/excel/template?type=class"\n              templateFilename="Template_DanhSach_Lop.xlsx"\n              exportUrl="/api/excel/export/classes"\n              exportFilename="DanhSachLop_Export.xlsx"',
    content
)

# Add export URL for schedule
content = re.sub(
    r'templateUrl="/api/excel/template\?type=schedule"\s*\n\s*templateFilename="Template_ThoiKhoaBieu.xlsx"',
    r'templateUrl="/api/excel/template?type=schedule"\n              templateFilename="Template_ThoiKhoaBieu.xlsx"\n              exportUrl={weekString ? `/api/excel/export/schedules?weekString=${weekString}` : "/api/excel/export/schedules"}\n              exportFilename="ThoiKhoaBieu_Export.xlsx"',
    content
)

with open("src/app/admin/import/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
