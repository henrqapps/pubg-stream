const $=s=>document.querySelector(s);
const form=$("#searchForm"),input=$("#nickname"),loading=$("#loading"),error=$("#error"),results=$("#results");
async function health(){
 try{const r=await fetch("/api/health"),d=await r.json();$("#status").textContent=d.pubgConfigured&&d.twitchConfigured?"APIs configuradas":"Configure as APIs no servidor";}
 catch{$("#status").textContent="Servidor offline";}
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function attr(s){return esc(s);}
function date(v){return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"medium"});}
function card(x){
 const action=x.direction==="killed"?`Você matou <b>${esc(x.streamer)}</b>`:`<b>${esc(x.streamer)}</b> matou você`;
 const offset=x.vod?.offsetSeconds||0;
 const url=x.vod?.url?`${x.vod.url}?t=${offset}s`:"#";
 return `<article class="card">
 <div class="card-top"><div class="streamer"><img class="avatar" src="${attr(x.streamerAvatar||"")}" onerror="this.style.visibility='hidden'"><div><strong>${esc(x.streamer)}</strong><small>@${esc(x.streamerLogin)}</small></div></div><span class="badge">VOD CONFIRMADO</span></div>
 <div class="direction">${action}</div>
 <div class="meta"><span>${esc(x.weapon||"Arma desconhecida")}</span>${x.distance!=null?`<span>${x.distance} m</span>`:""}<span>${esc(x.map||"Mapa indisponível")}</span><span>${date(x.eventTime)}</span></div>
 <a class="watch" target="_blank" rel="noopener" href="${attr(url)}">▶ VER MOMENTO NA TWITCH</a>
 </article>`;
}
form.addEventListener("submit",async e=>{
 e.preventDefault();const nickname=input.value.trim();if(!nickname)return;
 loading.classList.remove("hidden");error.classList.add("hidden");results.classList.add("hidden");
 try{
  const r=await fetch("/api/report?nickname="+encodeURIComponent(nickname)),d=await r.json();
  if(!r.ok)throw new Error(d.error||"Erro ao pesquisar");
  if(!d.player)throw new Error(d.message||"Jogador não encontrado");
  $("#playerName").textContent=d.player.name;
  $("#count").textContent=`${d.encounters.length} encontro(s) confirmado(s) • ${d.checkedMatches} partida(s) analisada(s)`;
  $("#cards").innerHTML=d.encounters.length?d.encounters.map(card).join(""):'<div class="card"><strong>Nenhum encontro encontrado.</strong><div class="direction">Nenhum streamer cadastrado teve um VOD cobrindo o horário de uma kill/morte nas partidas analisadas.</div></div>';
  results.classList.remove("hidden");
 }catch(err){error.textContent=err.message;error.classList.remove("hidden");}
 finally{loading.classList.add("hidden");}
});
health();
