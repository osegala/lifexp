// Run Expo on localhost:8081 first. This serves existing DEV entries only.
const http = require('node:http');
const screens = new Set(['home','tasks','base','avatar','shop','ui','account','notices']);
http.createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost:8082');
  if (path.pathname === '/review') {
    const frameWidth = Math.max(320, Math.min(1440, Number(path.searchParams.get('width') || 390)));
    response.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    response.end(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evrenthia UI review</title><style>body{margin:0;display:flex;justify-content:center;background:#242b27}iframe{width:${frameWidth}px;max-width:100vw;height:100dvh;border:0}</style></head><body><iframe title="Evrenthia fixture review" src="/?${path.searchParams.toString().replace(/&/g, '&amp;')}"></iframe></body></html>`);
    return;
  }
  const accountRoutes = new Set(['/login', '/register', '/profile', '/premium', '/onboarding', '/(tabs)/profile', '/(tabs)/dashboard']);
  const screen = path.searchParams.get('screen') || (accountRoutes.has(path.pathname) ? 'account' : path.pathname === '/base' ? 'base' : 'avatar');
  if ((path.pathname === '/' || accountRoutes.has(path.pathname) || path.pathname === '/base') && screens.has(screen)) {
    const width = Math.max(320, Math.min(1440, Number(path.searchParams.get('width') || 390)));
    const largeText = path.searchParams.get("text") === "large";
    const controls = path.searchParams.get("controls") === "1";
    const requestedHeight = Number(path.searchParams.get('height') || 0);
    const height = requestedHeight > 0 ? `${Math.max(320, Math.min(1600, requestedHeight))}px` : '100dvh';
    response.writeHead(200, {'Content-Type':'text/html'});
    response.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evrenthia · ${screen} review</title><style>html,body{margin:0;height:100%;background:#242b27}#root{width:${width}px;height:${height};max-width:100%;margin:0 auto;display:flex;overflow:hidden}#root>div{flex:1;min-height:0}${controls ? "" : `[data-testid$="-review-controls"],[aria-label="Preview All Cosmetics"]{display:none!important}`}${largeText ? `[dir="auto"]{font-size:24px!important;line-height:1.35!important}[aria-level="1"]{font-size:42px!important}` : ""}</style></head><body><div id="root"></div><script src="/${screen}-preview.bundle?platform=web&dev=true&hot=false&lazy=false"></script></body></html>`);
    return;
  }
  if (request.headers.accept?.includes('text/html')) {
    response.writeHead(404); response.end('Unknown fixture review screen'); return;
  }
  const proxy = http.request({hostname:'localhost',port:8081,path:request.url,method:request.method,headers:request.headers}, upstream => {
    response.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(response);
  });
  proxy.on('error', error => {response.writeHead(502);response.end(error.message)});
  request.pipe(proxy);
}).listen(8082, '127.0.0.1', () => console.log('Evrenthia fixture review: http://localhost:8082/review?screen=avatar&width=390'));
