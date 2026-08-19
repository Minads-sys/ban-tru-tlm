import re

with open("prisma/seed.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("where: { id: studentId },", "where: { studentCode: studentId },")
content = content.replace("id: studentId,\n          userId: user.id,", "studentCode: studentId,\n          userId: user.id,")

with open("prisma/seed.ts", "w", encoding="utf-8") as f:
    f.write(content)
