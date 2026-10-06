const KEY='ashenedspire.card-assembler.v1';
let database;
function open(){
  return database??=new Promise((resolve,reject)=>{
    const request=indexedDB.open('ashenedspire-card-assembler',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Draft storage is blocked by another tab.'));
  });
}
export async function readDraft(){
  try{const fallback=localStorage.getItem(KEY);if(fallback)return JSON.parse(fallback);}catch{}
  try{const db=await open();const value=await new Promise((resolve,reject)=>{
    const request=db.transaction('drafts').objectStore('drafts').get('current');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });if(value)return value;}catch{}
  const text=localStorage.getItem(KEY);return text?JSON.parse(text):null;
}
export async function writeDraft(doc){
  try{const db=await open();await new Promise((resolve,reject)=>{
    const transaction=db.transaction('drafts','readwrite');transaction.objectStore('drafts').put(doc,'current');
    transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });try{localStorage.removeItem(KEY);}catch{}return;
  }catch(error){
    // Small drafts can still recover in browsers that disallow IndexedDB.
    localStorage.setItem(KEY,JSON.stringify(doc));
  }
}
