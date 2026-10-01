import paramiko
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('14.225.224.121', 22, 'root', 'mFCDAPzdO7XZq7Q6szVe')
sftp = ssh.open_sftp()

files_to_sync = [
    "src/app/api/public/daily-showcase/route.ts",
    "src/app/api/settings/route.ts",
    "src/components/admin/central-kitchen/weekly-menu-matrix.tsx",
]

base_local = r"d:\2. HYMINH\PHẦN MỀM\BAN-TRU-TLM"
base_remote = "/var/www/bantrutlm"

for rel_path in files_to_sync:
    local_p = os.path.join(base_local, rel_path.replace("/", "\\"))
    remote_p = base_remote + "/" + rel_path
    print(f"Uploading {rel_path} -> {remote_p}")
    sftp.put(local_p, remote_p)

sftp.close()

# Rebuild and reload PM2
build_cmd = "cd /var/www/bantrutlm && npm run build && pm2 reload bantrutlm"
print("Running build & reload on VPS...")
stdin, stdout, stderr = ssh.exec_command(build_cmd)
exit_status = stdout.channel.recv_exit_status()
print("Build output:")
print(stdout.read().decode('utf-8'))
if exit_status != 0:
    print("Build error:", stderr.read().decode('utf-8'))
else:
    print("Build & Reload successful!")

ssh.close()
