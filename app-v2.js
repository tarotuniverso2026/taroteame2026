const cfg = window.TAROTEAME_CONFIG || {};
const sb = supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const prices = {
  10: 8,
  20: 15,
  30: 23,
  60: 48
};

let state = {
  duration: 30,
  price: 23,
  free: false,
  date: "",
  time: "",
  availability: []
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function pad(n) {
  return String(n).padStart(2, "0");
}

function label(d) {
  return d === 60 ? "1 hora" : `${d} min`;
}

function dateText(v) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(v + "T12:00:00"));
}

function msg(t) {
  const el = $("#message");
  if (el) el.textContent = t || "";
}

async function loadAvailability() {
  const slots = $("#slots");

  if (!slots) return;

  slots.innerHTML =
    '<p class="hint">Cargando horarios…</p>';

  if (!state.date) {
    slots.innerHTML =
      '<p class="hint">Selecciona una fecha.</p>';
    return;
  }

  try {
    const { data, error } =
      await sb.functions.invoke("availability", {
        body: {
          date: state.date,
          duration: state.duration
        }
      });

    if (error) throw error;

    state.availability = data?.slots || [];
    slots.innerHTML = "";

    state.availability.forEach(s => {
      const b = document.createElement("button");

      b.type = "button";
      b.className =
        "slot" + (s.available ? "" : " busy");

      b.textContent = s.time;
      b.disabled = !s.available;
      b.title =
        s.available ? "Disponible" : "Ocupada";

      if (
        s.time === state.time &&
        !s.available
      ) {
        state.time = "";
      }

      b.onclick = () => {
        state.time = s.time;

        $$(".slot").forEach(x =>
          x.classList.remove("selected")
        );

        b.classList.add("selected");

        render();
        renderPayment();
      };

      slots.appendChild(b);
    });

    if (!state.availability.length) {
      slots.innerHTML =
        '<p class="hint">No hay horas disponibles.</p>';
    }

  } catch (e) {
    console.error(e);

    slots.innerHTML =
      '<p class="hint">No se pudieron cargar las horas.</p>';
  }
}

function render() {
  $$("#duration-options button").forEach(b => {
    const isFree =
      b.dataset.free === "true";

    b.classList.toggle(
      "selected",
      isFree
        ? state.free
        : !state.free &&
          Number(b.dataset.duration) === state.duration
    );
  });

  const duration = $("#summary-duration");
  const date = $("#summary-date");
  const time = $("#summary-time");
  const price = $("#summary-price");

  if (duration) {
    duration.textContent = state.free
      ? "10 min · Gratis"
      : label(state.duration);
  }

  if (date) {
    date.textContent = dateText(state.date);
  }

  if (time) {
    time.textContent = state.time || "—";
  }

  if (price) {
    price.textContent = state.free
      ? "0 €"
      : `${state.price} €`;
  }
}

function valid() {
  const name =
    $("#name")?.value.trim() || "";

  const email =
    $("#email")?.value.trim() || "";

  return (
    state.date &&
    state.time &&
    name &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function renderPayment() {
  const paypal = $("#paypal-button-container");
  const freeBtn = $("#free-booking-btn");

  if (paypal) {
    paypal.innerHTML = "";
  }

  if (state.free) {
    if (paypal) {
      paypal.style.display = "none";
    }

    if (freeBtn) {
      freeBtn.hidden = false;
      freeBtn.style.display = "block";
    }

    return;
  }

  if (freeBtn) {
    freeBtn.hidden = true;
    freeBtn.style.display = "none";
  }

  if (paypal) {
    paypal.style.display = "block";
  }

  if (!window.paypal || !paypal) return;

  paypal.Buttons({

    style: {
      layout: "vertical",
      shape: "rect",
      label: "paypal",
      height: 42
    },

    onClick: (data, actions) => {
      if (!valid()) {
        msg(
          "Completa nombre, email, fecha y hora."
        );

        return actions.reject();
      }

      msg("");
      return actions.resolve();
    },

    createOrder: async () => {
      const { data, error } =
        await sb.functions.invoke(
          "create-order",
          {
            body: {
              duration: state.duration,
              date: state.date,
              time: state.time,
              name: $("#name").value.trim(),
              email: $("#email").value.trim()
            }
          }
