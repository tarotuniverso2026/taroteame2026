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
/* TAROTEAME - RESERVA GRATUITA */
(function(){

  const freeCard=document.querySelector('.price-card[data-free="true"]');

  if(!freeCard)return;

  const freeButton=document.createElement('button');
  freeButton.id='free-booking-btn';
  freeButton.type='button';
  freeButton.hidden=true;
  freeButton.textContent='🆓 Confirmar reserva gratuita';
  freeButton.style.cssText=
    'width:100%;margin-top:12px;padding:14px;border:0;border-radius:10px;background:#d9aa55;color:#120d18;font-weight:600;font-size:16px;cursor:pointer;';

  const paypal=document.querySelector('#paypal-button-container');
  paypal.parentNode.insertBefore(freeButton,paypal);

  function freeValid(){
    const email=document.querySelector('#email').value.trim();
    return state.date &&
      state.time &&
      document.querySelector('#name').value.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function confirmFree(){

    if(!freeValid()){
      msg('Completa nombre, email, fecha y hora.');
      return;
    }

    freeButton.disabled=true;
    msg('Guardando tu reserva gratuita…');

    try{

      const {data,error}=await sb.functions.invoke(
        'create-free-booking',
        {
          body:{
            date:state.date,
            time:state.time,
            name:document.querySelector('#name').value.trim(),
            email:document.querySelector('#email').value.trim()
          }
        }
      );

      if(error||!data?.ok){
        throw error||new Error(data?.error||'No se pudo crear la reserva');
      }

      msg(
        `✨ Reserva gratuita confirmada. Te esperamos el ${dateText(state.date)} a las ${state.time}.`
      );

      state.time='';
      render();

      await loadAvailability();

    }catch(e){

      console.error(e);
      msg(e?.message||'No se pudo crear la reserva.');
      await loadAvailability();

    }finally{

      freeButton.disabled=false;

    }
  }
  

  freeButton.onclick=confirmFree;

  document.addEventListener('click',function(e){

    if(!e.target.closest('.price-card[data-free="true"]'))return;

    e.preventDefault();
    e.stopImmediatePropagation();

    state.duration=10;
    state.price=8;
    state.free=true;
    state.time='';

    render();

    document.querySelector('#paypal-button-container').innerHTML='';
    freeButton.hidden=false;

    loadAvailability();

  },true);

  document.addEventListener('click',function(e){

    const normal=e.target.closest('.duration-options button[data-free="true"]');

    if(!normal)return;

    e.preventDefault();
    e.stopImmediatePropagation();
    

    state.duration=10;
    state.price=8;
    state.free=true;
    state.time='';

    render();

    document.querySelector('#paypal-button-container').innerHTML='';
    freeButton.hidden=false;

    loadAvailability();

  },true);
  /* TAROTEAME - AJUSTE VISUAL RESERVA GRATUITA */
document.addEventListener("click",function(e){

  const free=e.target.closest('.price-card[data-free="true"]');

  if(!free)return;

  setTimeout(function(){

    const total=document.querySelector("#summary-price");
    const lectura=document.querySelector("#summary-duration");
    const paypal=document.querySelector("#paypal-button-container");
    const freeBtn=document.querySelector("#free-booking-btn");

    if(total)total.textContent="0 €";
    if(lectura)lectura.textContent="10 min · Gratis";

    if(paypal){
      paypal.innerHTML="";
      paypal.style.display="none";
    }

    if(freeBtn){
      freeBtn.hidden=false;
      freeBtn.style.display="block";
    }

  },100);
})();
