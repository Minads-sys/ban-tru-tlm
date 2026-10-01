import os
import sys
import paramiko
from pathlib import Path

# Load env local
env_path = Path(__file__).parent.parent / '.env.local'
env_vars = {}
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, _, v = line.partition('=')
            env_vars[k.strip()] = v.strip().strip('"').strip("'")

HOST = env_vars.get('VPS_HOST', '14.225.224.121')
PORT = int(env_vars.get('VPS_PORT', '22'))
USER = env_vars.get('VPS_USER', 'root')
PASS = env_vars.get('VPS_PASS', '')

print(f"Connecting to VPS ({HOST})...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15)

def run_command(cmd):
    print(f"\n>>> Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("STDERR:", err)

# 1. Update Nginx configuration
nginx_conf = """server {
    server_name bantrutlm.com congkhai.bantrutlm.com;

    client_max_body_size 50M;

    # Phuc vu file upload truc tiep tu o dia (nhe, toc do cao, khong ton RAM Next.js)
    location /uploads/ {
        alias /var/www/bantrutlm/public/uploads/;
        expires 30d;
        access_log off;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # Cau hinh toi uu rieng cho Server-Sent Events (SSE) Realtime
    location /api/realtime {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        chunked_transfer_encoding off;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/bantrutlm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bantrutlm.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name bantrutlm.com congkhai.bantrutlm.com;
    return 301 https://$host$request_uri;
}
"""

print("Updating /etc/nginx/sites-available/bantrutlm...")
sftp = ssh.open_sftp()
with sftp.open('/etc/nginx/sites-available/bantrutlm', 'w') as f:
    f.write(nginx_conf)
sftp.close()

# 2. Test and reload nginx
run_command("nginx -t && systemctl reload nginx")

# 3. Expand certbot certificate to cover congkhai.bantrutlm.com (no www)
run_command("certbot --nginx -d bantrutlm.com -d congkhai.bantrutlm.com --expand --non-interactive --agree-tos -m admin@bantrutlm.com")

# 4. Final verification
run_command("nginx -t && systemctl reload nginx")
run_command("certbot certificates")

ssh.close()
print("\nDone installing SSL!")
