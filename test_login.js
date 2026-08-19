const http = require('http');

const data = JSON.stringify({
  username: 'Nguyễn Hoàng Nam',
  password: '15012011',
  verificationCode: '001234',
  redirect: false,
  callbackUrl: 'http://localhost:3000/student-login'
});

const req = http.request('http://localhost:3000/api/auth/callback/credentials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', console.error);
req.write(data);
req.end();
