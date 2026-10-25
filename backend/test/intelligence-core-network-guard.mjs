// Local synthetic QA only: deny external networks, DB ports and Unix sockets.
import net from 'node:net';
function localOnly(args){
 let value=args[0];if(Array.isArray(value))value=value[0];
 const options=value&&typeof value==='object'?value:{port:value,host:typeof args[1]==='string'?args[1]:'localhost'};
 const host=options.host??'localhost',port=Number(options.port);
 if(options.path||!['localhost','127.0.0.1','::1'].includes(host)||!Number.isInteger(port)||port<=1024||port>65535||[5432,6543].includes(port))throw Error('Local Core QA blocked external, system-port or database connection');
}
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){localOnly(args);return connect.apply(this,args);};
const fetch=globalThis.fetch;
globalThis.fetch=function(input,...args){
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 localOnly([{host:url.hostname==='[::1]'?'::1':url.hostname,port:Number(url.port||(url.protocol==='https:'?443:80))}]);
 return fetch(input,...args);
};
