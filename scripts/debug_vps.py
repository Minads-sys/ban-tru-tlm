import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('14.225.224.121', 22, 'root', 'mFCDAPzdO7XZq7Q6szVe')

cmd = """sudo -u postgres psql -d bantrutlm_db -c "\\dt" """
_, stdout, stderr = ssh.exec_command(cmd)
print("Tables:")
print(stdout.read().decode('utf-8'))
print("Stderr:", stderr.read().decode('utf-8'))

cmd = """sudo -u postgres psql -d bantrutlm_db -c "UPDATE daily_meal_showcases SET provider_name = (SELECT value FROM system_settings WHERE key = 'CATERING_PROVIDER_NAME');" """
_, stdout, stderr = ssh.exec_command(cmd)
print("Update result:")
print(stdout.read().decode('utf-8'))
print("Stderr:", stderr.read().decode('utf-8'))

cmd2 = """sudo -u postgres psql -d bantrutlm_db -c "SELECT id, date, provider_name FROM daily_meal_showcases;" """
_, stdout2, stderr2 = ssh.exec_command(cmd2)
print("After update:")
print(stdout2.read().decode('utf-8'))

ssh.close()
