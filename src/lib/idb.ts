const DB = 'futec-pos-next';
const STORE = 'kv';
function db(): Promise<IDBDatabase> { return new Promise((resolve,reject)=>{ const r=indexedDB.open(DB,1); r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE); }; r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
export async function idbSet<T>(key:string,value:T){ const d=await db(); return new Promise<void>((resolve,reject)=>{ const tx=d.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(value,key); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }
export async function idbGet<T>(key:string):Promise<T|undefined>{ const d=await db(); return new Promise((resolve,reject)=>{ const r=d.transaction(STORE,'readonly').objectStore(STORE).get(key); r.onsuccess=()=>resolve(r.result as T|undefined); r.onerror=()=>reject(r.error); }); }
export async function idbDel(key:string){ const d=await db(); return new Promise<void>((resolve,reject)=>{ const tx=d.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }
