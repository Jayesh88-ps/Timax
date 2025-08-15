import localtunnel from 'localtunnel';

const port = 3000;
const tunnel = await localtunnel({ port });
console.log(tunnel.url);

process.on('SIGINT', () => tunnel.close());
process.on('SIGTERM', () => tunnel.close());