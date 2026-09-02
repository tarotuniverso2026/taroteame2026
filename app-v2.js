const cfg=window.TAROTEAME_CONFIG||{};
const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const prices={10:8,20:15,30:23,60:48};
let state={duration:30,price:23,date:"",time:"",availability:[]};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function pad(n){return String(n).padStart(2,"0")}
function label(d){return d===60?"1 hora":`${d} min`}
function dateText(v){if(!v)return"—";return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(v+"T12:00:00"))}
function msg(t){$("#message").textContent=t||""}

async function loadAvailability(){
  const slots=$("#slots"); slots.innerHTML='<p class="hint">Cargando horarios…</p>';
  if(!state.date){slots.innerHTML='<p class="hint">Selecciona una fecha.</p>';return}
  try{
    const {data,error}=await sb.functions.invoke("availability",{body:{date:state.date,duration:state.duration}});
    if(error)throw error;
    state.availability=data.slots||[];
    slots.innerHTML="";
    state.availability.forEach(s=>{
      const b=document.createElement("button");b.type="button";b.className="slot"+(s.available?"":" busy");b.textContent=s.time;
      b.disabled=!s.available;b.title=s.available?"Disponible":"Ocupada";
      if(s.time===state.time&&!s.available)state.time="";
      b.onclick=()=>{state.time=s.time;$$(".slot").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");render();renderPayPal()};
      slots.appendChild(b);
    });
    if(!state.availability.length)slots.innerHTML='<p class="hint">No hay horas disponibles.</p>';
  }catch(e){console.error(e);slots.innerHTML='<p class="hint">No se pudieron cargar las horas. Revisa la configuración de Supabase.</p>'}
}
function render(){
  $$("#duration-options button").forEach(b=>b.classList.toggle("selected",+b.dataset.duration===state.duration));
  $("#summary-duration").textContent=label(state.duration);$("#summary-price").textContent=`${state.price} €`;
  $("#summary-date").textContent=dateText(state.date);$("#summary-time").textContent=state.time||"—";
}
function valid(){
  const email=$("#email").value.trim();
  return state.date&&state.time&&$("#name").value.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function renderPayPal(){
  const c=$("#paypal-button-container");c.innerHTML="";
  if(!window.paypal)return;
  paypal.Buttons({
    style:{layout:"vertical",shape:"rect",label:"paypal",height:42},
    onClick:(data,actions)=>{if(!valid()){msg("Completa nombre, email, fecha y hora.");return actions.reject()}msg("");return actions.resolve()},
    createOrder:async()=>{
      const {data,error}=await sb.functions.invoke("create-order",{body:{duration:state.duration,date:state.date,time:state.time,name:$("#name").value.trim(),email:$("#email").value.trim()}});
      if(error||!data?.id)throw error||new Error("No se pudo crear la orden");
      return data.id;
    },
    onApprove:async(data)=>{
      const {data:result,error}=await sb.functions.invoke("capture-order",{body:{orderID:data.orderID}});
      if(error||!result?.ok){msg("No se pudo confirmar la reserva. Si PayPal muestra el cobro, contacta con Taroteame.");return}
      msg(`✨ Reserva confirmada. Hemos enviado la confirmación a ${result.email}.`);
      c.innerHTML="";
      await loadAvailability();
    },
    onCancel:()=>msg("Pago cancelado. La reserva pendiente se liberará automáticamente."),
    onError:e=>{console.error(e);msg("Ha ocurrido un error con PayPal.")}
  }).render(c);
}
function selectDuration(d){state.duration=d;state.price=prices[d];state.time="";render();loadAvailability();renderPayPal()}
$$(".price-card").forEach(b=>b.onclick=()=>{selectDuration(+b.dataset.duration);$("#reservar").scrollIntoView({behavior:"smooth"})});
$$(".duration-options button").forEach(b=>b.onclick=()=>selectDuration(+b.dataset.duration));
const now=new Date();const date=$("#date");date.min=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;date.value=date.min;
date.onchange=()=>{state.date=date.value;state.time="";render();loadAvailability();renderPayPal()};
$("#name").oninput=renderPayPal;$("#email").oninput=renderPayPal;
$("#year").textContent=new Date().getFullYear();state.date=date.value;render();loadAvailability();renderPayPal();
