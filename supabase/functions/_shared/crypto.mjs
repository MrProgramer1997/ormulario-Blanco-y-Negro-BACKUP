export async function sha256(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function equalHex(a,b){if(!/^[a-f0-9]{64}$/i.test(a)||!/^[a-f0-9]{64}$/i.test(b))return false;let v=0;for(let i=0;i<64;i++)v|=a.toLowerCase().charCodeAt(i)^b.toLowerCase().charCodeAt(i);return v===0;}
