const http = require('http');

const data = new URLSearchParams();
data.append('socket_id', '12345.67890');
data.append('channel_name', 'private-locks-node-00000000-0000-0000-0000-000000000015');

const tryCookie = (cookieName, next) => {
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/pusher/auth',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data.toString()),
      'Cookie': `${cookieName}=85328aa6af11db434d39a9569321c30a9695c9408c1eb45dba9d4921f445d783`
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`[${cookieName}] Status: ${res.statusCode}`);
      console.log(`[${cookieName}] Body: ${body}`);
      if (next) next();
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    if (next) next();
  });

  req.write(data.toString());
  req.end();
};

tryCookie('authjs.session-token', () => {
  tryCookie('next-auth.session-token');
});
