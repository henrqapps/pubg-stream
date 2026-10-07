import http from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import path from "node:path";
import {URL} from "node:url";

const ROOT=process.cwd();
const PORT=Number(process.env.PORT||3000);
const PUBG_API_KEY=process.env.PUBG_API_KEY||"";
const PUBG_PLATFORM=process.env.PUBG_PLATFORM||"steam";
const TWITCH_CLIENT_ID=process.env.TWITCH_CLIENT_ID||"";
const TWITCH_CLIENT_SECRET=process.env.TWITCH_CLIENT_SECRET||"";
const ADMIN_TOKEN=process.env.ADMIN_TOKEN||"";
const MAX_MATCHES=Math.min(32,Math.max(1,Number(process.env.MAX_MATCHES||10)));
const VOD_MATCH_TOLERANCE_SECONDS=Math.max(0,Number(process.env.VOD_MATCH_TOLERANCE_SECONDS||90));
const STREAMERS_FILE=path.join(ROOT,"data","streamers.json");
const PUBLIC_DIR=path.join(ROOT,"public");
let twitchToken=null,twitchTokenExpiresAt=0;

async function readJson(file,fallback){try{return JSON.parse(await readFile(file,"utf8"))}catch{return fallback}}
async function streamers(){const x=await readJson(STREAMERS_FILE,[]);return Array.isArray(x)?x:[]}
async function saveStreamers(x){await mkdir(path.dirname(STREAMERS_FILE),{recursive:true});await writeFile(STREAMERS_FILE,JSON.stringify(x,null,2)+"\n")}
function send(res,status,data,headers={}){const body=typeof data==="string"?data:JSON.stringify(data);res.writeHead(status,{"Content-Type":typeof data==="string"?"text/plain; charset=utf-8":"application/json; charset=utf-8",...headers});res.end(body)}
function cors(){return{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, X-Admin-Token","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS"}}
async function pubg(url){if(!PUBG_API_KEY)throw new Error("PUBG_API_KEY não configurada.");const r=await fetch(url,{headers:{Authorization:`Bearer ${PUBG_API_KEY}`,Accept:"application/vnd.api+json"}});const t=await r.text();if(!r.ok)throw new Error(`PUBG API ${r.status}: ${t.slice(0,400)}`);return JSON.parse(t)}
async function twitchTokenGet(){if(!TWITCH_CLIENT_ID||!TWITCH_CLIENT_SECRET)throw new Error("TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET não configurados.");if(twitchToken&&Date.now()<twitchTokenExpiresAt-60000)return twitchToken;const body=new URLSearchParams({client_id:TWITCH_CLIENT_ID,client_secret:TWITCH_CLIENT_SECRET,grant_type:"client_credentials"});const r=await fetch("https://id.twitch.tv/oauth2/token",{method:"POST",body});const d=await r.json();if(!r.ok)throw new Error(`Twitch token ${r.status}`);twitchToken=d.access_token;twitchTokenExpiresAt=Date.now()+d.expires_in*1000;return twitchToken}
async function twitch(url){const token=await twitchTokenGet();const r=await fetch("https://api.twitch.tv/helix"+url,{headers:{Authorization:`Bearer ${token}`,"Client-Id":TWITCH_CLIENT_ID}});const t=await r.text();if(!r.ok)throw new Error(`Twitch API ${r.status}: ${t.slice(0,400)}`);return JSON.parse(t)}
async function twitchUser(login){const d=await twitch(`/users?login=${encodeURIComponent(login)}`);return d.data?.[0]||null}
function duration(s){let n=0;for(const [re,m] of [[/(\\d+)h/,3600],[/(\\d+)m/,60],[/(\\d+)s/,1]]){const x=String(s||"").match(re);if(x)n+=Number(x[1])*m}return n}
async function vods(userId,target){const ms=new Date(target).getTime();const from=new Date(ms-12*3600000).toISOString(),to=new Date(ms+12*3600000).toISOString();const q=new URLSearchParams({user_id:userId,type:"archive",first:"100",started_at:from,ended_at:to});const d=await twitch(`/videos?${q}`);return(d.data||[]).filter(v=>v.viewable!=="private")}
function matchingVod(v,target){const t=new Date(target).getTime(),s=new Date(v.created_at).getTime(),e=s+duration(v.duration)*1000;return t>=s-VOD_MATCH_TOLERANCE_SECONDS*1000&&t<=e+VOD_MATCH_TOLERANCE_SECONDS*1000}
function vodOffset(v,target){return Math.max(0,Math.floor((new Date(target).getTime()-new Date(v.created_at).getTime())/1000))}
async function getPlayer(n){const d=await pubg(`https://api.pubg.com/shards/${PUBG_PLATFORM}/players?filter[playerNames]=${encodeURIComponent(n.trim())}`);return d.data?.[0]||null}
async function getMatch(id){return pubg(`https://api.pubg.com/shards/${PUBG_PLATFORM}/matches/${encodeURIComponent(id)}`)}
function telemetryUrl(match){const inc=match.included||[],assets=inc.filter(x=>x.type==="asset"),refs=new Set((match.data?.relationships?.assets?.data||[]).map(x=>x.id)),a=assets.find(x=>refs.has(x.id))||assets[0];return a?.attributes?.URL||a?.attributes?.url||null}
async function telemetry(url){const r=await fetch(url);if(!r.ok)throw new Error(`Telemetry ${r.status}`);return r.json()}
function account(c){return c?.accountId||c?.accountID||c?.account_id||null}
function name(c){return c?.name||c?.Name||""}
function weapon(e){return e?.damageCauserName||e?.killerDamageInfo?.damageCauserName||e?.finishDamageInfo?.damageCauserName||"Desconhecida"}
function distance(e){const n=e?.distance??e?.killerDamageInfo?.distance??e?.finishDamageInfo?.distance;return typeof n==="number"?Math.round(n):null}
function streamerFor(otherName,list){const n=String(otherName||"").toLowerCase();return list.find(s=>s.enabled!==false&&((s.pubgNickname||"").toLowerCase()===n||(s.twitchLogin||"").toLowerCase()===n||(s.displayName||"").toLowerCase()===n))||null}
async function confirmStreamer(s,eventTime){const u=await twitchUser(s.twitchLogin);if(!u)return null;const vs=await vods(u.id,eventTime),v=vs.find(x=>matchingVod(x,eventTime));if(!v)return null;return{twitch:{id:u.id,login:u.login,displayName:u.display_name,profileImageUrl:u.profile_image_url},vod:{id:v.id,title:v.title,url:v.url,createdAt:v.created_at,duration:v.duration,gameName:v.game_name,offsetSeconds:vodOffset(v,eventTime)}}}
async function report(nickname){const p=await getPlayer(nickname);if(!p)return{player:null,encounters:[],message:"Jogador não encontrado."};const refs=(p.relationships?.matches?.data||[]).slice(0,MAX_MATCHES),list=(await streamers()).filter(s=>s.enabled!==false&&s.twitchLogin);const encounters=[],errors=[];for(const ref of refs){try{const m=await getMatch(ref.id),u=telemetryUrl(m);if(!u)continue;const events=await telemetry(u);for(const e of events){if(e._T!=="LogPlayerKillV2")continue;const k=e.killer,v=e.victim,kid=account(k),vid=account(v);if(kid!==p.id&&vid!==p.id)continue;const other=kid===p.id?v:k,otherName=name(other),s=streamerFor(otherName,list);if(!s||!e._D)continue;const confirmed=await confirmStreamer(s,e._D);if(!confirmed)continue;encounters.push({id:`${ref.id}:${e._D}:${otherName}`,matchId:ref.id,eventTime:e._D,direction:kid===p.id?"killed":"died",player:p.attributes?.name||nickname,streamer:confirmed.twitch.displayName,streamerLogin:confirmed.twitch.login,streamerAvatar:confirmed.twitch.profileImageUrl,weapon:weapon(e),distance:distance(e),vod:confirmed.vod,map:m.data?.attributes?.mapName||null,mode:m.data?.attributes?.gameMode||null})}}catch(e){errors.push({matchId:ref.id,error:e.message})}}encounters.sort((a,b)=>new Date(b.eventTime)-new Date(a.eventTime));return{player:{id:p.id,name:p.attributes?.name||nickname},checkedMatches:refs.length,encounters,errors}}
async function jsonBody(req){let s="";for await(const c of req)s+=c;return s?JSON.parse(s):{}}
async function handle(req,res){
 const u=new URL(req.url,`http://${req.headers.host||"localhost"}`);
 if(req.method==="OPTIONS")return send(res,204,"",cors());
 if(u.pathname==="/api/health")return send(res,200,{ok:true,pubgConfigured:Boolean(PUBG_API_KEY),twitchConfigured:Boolean(TWITCH_CLIENT_ID&&TWITCH_CLIENT_SECRET)},cors());
 if(u.pathname==="/api/streamers"&&req.method==="GET")return send(res,200,(await streamers()).filter(s=>s.enabled!==false).map(({twitchLogin,displayName})=>({twitchLogin,displayName})),cors());
 if(u.pathname==="/api/report"&&req.method==="GET"){const n=u.searchParams.get("nickname")?.trim();if(!n)return send(res,400,{error:"Informe nickname."},cors());try{return send(res,200,await report(n),cors())}catch(e){return send(res,500,{error:e.message},cors())}}
 if(u.pathname==="/api/admin/streamers"&&req.method==="GET"){if(!ADMIN_TOKEN||req.headers["x-admin-token"]!==ADMIN_TOKEN)return send(res,401,{error:"Não autorizado."},cors());return send(res,200,await streamers(),cors())}
 if(u.pathname==="/api/admin/streamers"&&req.method==="POST"){if(!ADMIN_TOKEN||req.headers["x-admin-token"]!==ADMIN_TOKEN)return send(res,401,{error:"Não autorizado."},cors());const b=await jsonBody(req);if(!b.twitchLogin)return send(res,400,{error:"twitchLogin é obrigatório."},cors());const list=await streamers(),login=String(b.twitchLogin).trim().toLowerCase(),item={twitchLogin:login,displayName:b.displayName||login,pubgNickname:b.pubgNickname||"",enabled:b.enabled!==false},i=list.findIndex(x=>x.twitchLogin?.toLowerCase()===login);if(i>=0)list[i]=item;else list.push(item);await saveStreamers(list);return send(res,200,item,cors())}
 if(u.pathname.startsWith("/api/admin/streamers/")&&req.method==="DELETE"){if(!ADMIN_TOKEN||req.headers["x-admin-token"]!==ADMIN_TOKEN)return send(res,401,{error:"Não autorizado."},cors());const login=decodeURIComponent(u.pathname.split("/").pop()).toLowerCase(),list=await streamers();await saveStreamers(list.map(s=>s.twitchLogin?.toLowerCase()===login?{...s,enabled:false}:s));return send(res,200,{ok:true},cors())}
 let file=u.pathname==="/"?"index.html":u.pathname.replace(/^\/+/, "");const full=path.resolve(PUBLIC_DIR,file);if(!full.startsWith(path.resolve(PUBLIC_DIR)+path.sep))return send(res,403,"Forbidden");try{const content=await readFile(full),ext=path.extname(full),types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8"};res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});res.end(content)}catch{send(res,404,"Not found")}
}
http.createServer((req,res)=>handle(req,res).catch(e=>send(res,500,{error:e.message},cors()))).listen(PORT,"0.0.0.0",()=>console.log(`PUBG Stream Report: ${PORT}`));
