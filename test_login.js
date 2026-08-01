const http = require('http');

async function test() {
  const data = JSON.stringify([{"email":"olivia.williams@mate.com","password":"password123"}]);
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/login', // Not how server actions are tested usually
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Next-Action': 'something' // Wait, better to test the function directly in node
    }
  });
}
