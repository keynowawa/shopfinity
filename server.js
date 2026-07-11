const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BASE = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  // Strip query string (?id=15 etc.) before resolving the file path
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(BASE, urlPath === '/' ? '/index.html' : urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + req.url);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}).listen(PORT, () => {
  console.log('ShopFresh running at http://localhost:' + PORT);
  console.log('Open http://localhost:' + PORT + '/index.html in Chrome');
});
