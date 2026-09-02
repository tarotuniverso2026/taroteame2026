const cfg=window.TAROTEAME_CONFIG||{};const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
async function load(){
  const {data,error}=await sb.functions.invoke("admin-list",{body:{date:$("#filter").value||null}});
  if(error){$("#status").textContent="No se pudieron cargar las reservas.";return}
  const rows=data.bookings||[];
  $("#table").innerHTML=`<table style="width:100%;border-collapse:collapse;min-width:780px"><thead><tr><th>Fecha</th><th>Hora</th><th>Duración</th><th>Cliente</th><th>Email</th><th>Pago</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.appointment_date)}</td><td>${esc(r.start_time)}</td><td>${esc(r.duration_min)} min</td><td>${esc(r.customer_name)}</td><td>${esc(r.customer_email)}</td><td>${esc(r.payment_status)}</td><td>${r.status==="cancelled"?"Cancelada":`<button class="cancel" data-id="${esc(r.id)}">Cancelar</button>`}</td></tr>`).join("")}</tbody></table>`;
  $$(".cancel").forEach(b=>b.onclick=async()=>{if(!confirm("¿Cancelar esta cita?"))return;const {error}=await sb.functions.invoke("admin-cancel",{body:{id:b.dataset.id}});if(error)alert("No se pudo cancelar.");else load()});
}
const $$=s=>[...document.querySelectorAll(s)];
$("#loginBtn").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});if(error)$("#loginMsg").textContent=error.message;else show()};
async function show(){const {data:{session}}=await sb.auth.getSession();if(!session)return;$("#login").style.display="none";$("#panel").style.display="block";$("#status").textContent=`Sesión iniciada como ${session.user.email}`;load()}
$("#logout").onclick=async()=>{await sb.auth.signOut();location.reload()};$("#refresh").onclick=load;$("#filter").onchange=load;show();
