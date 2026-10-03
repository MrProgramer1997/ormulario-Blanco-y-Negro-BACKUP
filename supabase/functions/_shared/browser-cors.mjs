// Only approved frontends may read administrative confirmation responses.
// CORS does not replace the authentication and signature checks in handler.
const allowed=new Set(['https://mrprogramer1997.github.io','http://localhost:4173','http://127.0.0.1:4173','http://localhost:5500','http://127.0.0.1:5500']);
export function withBrowserCors(handler){
 return async request=>{
  const origin=request.headers.get('origin'),permitted=!!origin&&allowed.has(origin);
  if(request.method==='OPTIONS'){
   if(!permitted)return new Response(null,{status:403,headers:{Vary:'Origin','Cache-Control':'no-store'}});
   return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Max-Age':'300',Vary:'Origin'}});
  }
  const result=await handler(request);
  if(!permitted)return result;
  const headers=new Headers(result.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');
  return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
 };
}
