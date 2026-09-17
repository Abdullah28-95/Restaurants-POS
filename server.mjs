import next from 'next';import http from 'node:http';import {WebSocketServer,WebSocket} from 'ws';
const dev=process.argv.includes('--dev');const hostname=process.env.HOSTNAME||'0.0.0.0';const port=Number(process.env.PORT||3000);const app=next({dev,hostname,port});const handle=app.getRequestHandler();
await app.prepare();const server=http.createServer((req,res)=>handle(req,res));server.listen(port,hostname,()=>console.log(`POS: http://${hostname}:${port}`));
const wss=new WebSocketServer({port:Number(process.env.KDS_PORT||8080),host:'0.0.0.0'});wss.on('connection',socket=>{socket.on('message',data=>{for(const c of wss.clients)if(c!==socket&&c.readyState===WebSocket.OPEN)c.send(data);});});console.log(`KDS WebSocket: ws://0.0.0.0:${process.env.KDS_PORT||8080}`);
