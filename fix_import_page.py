import re

with open("src/app/admin/import/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix ImportSectionProps
content = re.sub(
    r"interface ImportSectionProps \{([\s\S]*?)templateFilename: string;",
    r"interface ImportSectionProps {\1templateFilename: string;\n    exportUrl?: string;\n    exportFilename?: string;",
    content
)

# Fix ImportSection arguments
content = re.sub(
    r"function ImportSection\(\{([\s\S]*?)templateFilename,",
    r"function ImportSection({\1templateFilename,\n    exportUrl,\n    exportFilename,",
    content
)

# Fix CardHeader buttons
# Since the previous replacement messed up the DOM for CardHeader, let's just find the entire CardHeader inside ImportSection.
import_section_header = r"<CardHeader className=\"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4\">[\s\S]*?</CardHeader>"

new_header = """<CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {exportUrl && (
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 shrink-0 flex items-center gap-2"
                asChild
              >
                <a href={exportUrl} download={exportFilename}>
                  <Download className="h-4 w-4 text-emerald-600" />
                  Tải danh sách hiện hành
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950 shrink-0 flex items-center gap-2"
              asChild
            >
              <a href={templateUrl} download={templateFilename}>
                <Download className="h-4 w-4 text-blue-600" />
                Tải file mẫu Excel
              </a>
            </Button>
          </div>
        </CardHeader>"""

content = re.sub(import_section_header, new_header, content, count=1)

# Now inject exportUrl and exportFilename for Student tab
content = re.sub(
    r"templateUrl=\"/api/excel/template\?type=student\"\s*\n\s*templateFilename=\"Template_DanhSach_HocSinh.xlsx\"",
    r"templateUrl=\"/api/excel/template?type=student\"\n              templateFilename=\"Template_DanhSach_HocSinh.xlsx\"\n              exportUrl=\"/api/excel/export/students\"\n              exportFilename=\"DanhSachHocSinh_Export.xlsx\"",
    content
)

with open("src/app/admin/import/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
