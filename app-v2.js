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

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

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

function msg(text) {
  const el = $("#message");
  if (el) el.textContent = text || "";
}

/* =========================
   HORARIOS
========================= */

async function loadAvailability() {
  const slots = $("#slots");

  if (!slots) return;

  if (!state.date) {
    slots.innerHTML =
      '<p class="hint">Selecciona una fecha.</p>';
    return;
  }

  slots.innerHTML =
    '<p class="hint">Cargando horarios…</p>';

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

    state.availability.forEach((slot) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "slot" + (slot.available ? "" : " busy");

      button.textContent = slot.time;
      button.disabled = !slot.available;

      if (slot.available) {
        button.title = "Disponible";
      } else {
        button.title = "Ocupada";
      }

      if (
        slot.time === state.time &&
        !slot.available
      ) {
        state.time = "";
      }

      button.onclick = () => {
        if (!slot.available) return;

        state.time = slot.time;

        $$(".slot").forEach((x) => {
          x.classList.remove("selected");
        });

        button.classList.add("selected");

        render();
        renderPayment();
      };

      slots.appendChild(button);
    });

    if (!state.availability.length) {
      slots.innerHTML =
        '<p class="hint">No hay horas disponibles.</p>';
    }

  } catch (error) {
    console.error("AVAILABILITY ERROR:", error);

    slots.innerHTML =
      '<p class="hint">No se pudieron cargar las horas.</p>';
  }
}

/* =========================
   RESUMEN
========================= */

function render() {

  /* Duraciones */

  $$("#duration-options button").forEach((button) => {

    const isFree =
      button.dataset.free === "true";

    const duration =
      Number(button.dataset.duration);

    const selected =
      isFree
        ? state.free
        : !state.free &&
          duration === state.duration;

    button.classList.toggle(
      "selected",
      selected
    );
  });

  /* Resumen */

  const durationEl =
    $("#summary-duration");

  const dateEl =
    $("#summary-date");

  const timeEl =
    $("#summary-time");

  const priceEl =
    $("#summary-price");

  if (durationEl) {
    durationEl.textContent =
      state.free
        ? "10 min · Gratis"
        : label(state.duration);
  }

  if (dateEl) {
    dateEl.textContent =
      dateText(state.date);
  }

  if (timeEl) {
    timeEl.textContent =
      state.time || "—";
  }

  if (priceEl) {
    priceEl.textContent =
      state.free
        ? "0 €"
        : `${state.price} €`;
  }
}

/* =========================
   VALIDACIÓN
========================= */

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

/* =========================
   PAYPAL
========================= */

function renderPayment() {

  const paypal =
    $("#paypal-button-container");

  const freeButton =
    $("#free-booking-btn");

  if (paypal) {
    paypal.innerHTML = "";
  }

  if (state.free) {

    if (paypal) {
      paypal.style.display = "none";
    }

    if (freeButton) {
      freeButton.hidden = false;
      freeButton.style.display = "block";
    }

    return;
  }

  if (freeButton) {
    freeButton.hidden = true;
    freeButton.style.display = "none";
  }

  if (paypal) {
    paypal.style.display = "block";
  }

  if (!window.paypal || !paypal) {
    return;
  }

  window.paypal.Buttons({

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
        );

      if (error) {
        console.error(
          "CREATE ORDER ERROR:",
          error
        );

        throw error;
      }

      if (!data?.id) {
        throw new Error(
          "PayPal no devolvió el número de pedido."
        );
      }

      return data.id;
    },

    onApprove: async (data) => {

      msg("Procesando el pago…");

      try {

        const result =
          await sb.functions.invoke(
            "capture-order",
            {
              body: {
                orderID: data.orderID
              }
            }
          );

        if (result.error) {
          throw result.error;
        }

        if (
          result.data &&
          result.data.ok === false
        ) {
          throw new Error(
            result.data.error ||
            "No se pudo confirmar la reserva."
          );
        }

        msg(
          "¡Reserva confirmada! Hemos recibido tu pago."
        );

        state.time = "";

        await loadAvailability();

        render();

      } catch (error) {

        console.error(
          "CAPTURE ERROR:",
          error
        );

        msg(
          "El pago se realizó, pero hubo un problema al confirmar la reserva. Contacta con Taroteame."
        );
      }
    },

    onCancel: () => {
      msg("Pago cancelado.");
    },

    onError: (error) => {

      console.error(
        "PAYPAL ERROR:",
        error
      );

      msg(
        "Ha ocurrido un error con PayPal."
      );
    }

  }).render(
    "#paypal-button-container"
  );
}

/* =========================
   RESERVA GRATUITA
========================= */

function createFreeButton() {

  const paymentArea =
    $("#paypal-button-container");

  if (!paymentArea) return;

  let button =
    $("#free-booking-btn");

  if (button) return;

  button =
    document.createElement("button");

  button.id =
    "free-booking-btn";

  button.type =
    "button";

  button.textContent =
    "Reservar gratis";

  button.style.display =
    "none";

  button.style.width =
    "100%";

  button.style.padding =
    "14px";

  button.style.border =
    "0";

  button.style.borderRadius =
    "10px";

  button.style.cursor =
    "pointer";

  button.style.fontSize =
    "17px";

  button.style.fontWeight =
    "600";

  button.onclick =
    createFreeBooking;

  paymentArea.parentNode.insertBefore(
    button,
    paymentArea
  );
}

async function createFreeBooking() {

  if (!state.free) return;

  const name =
    $("#name")?.value.trim() || "";

  const email =
    $("#email")?.value.trim() || "";

  if (
    !state.date ||
    !state.time ||
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {

    msg(
      "Completa nombre, email, fecha y hora."
    );

    return;
  }

  const button =
    $("#free-booking-btn");

  if (button) {
    button.disabled = true;
    button.textContent =
      "Reservando…";
  }

  msg("");

  try {

    const { data, error } =
      await sb.functions.invoke(
        "create-free-booking",
        {
          body: {
            date: state.date,
            time: state.time,
            name,
            email
          }
        }
      );

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.ok === false
    ) {
      throw new Error(
        data?.error ||
        "No se pudo crear la reserva."
      );
    }

    msg(
      "¡Reserva gratuita confirmada! Te esperamos."
    );

    state.time = "";

    await loadAvailability();

    render();

  } catch (error) {

    console.error(
      "FREE BOOKING ERROR:",
      error
    );

    msg(
      error?.message ||
      "No se pudo realizar la reserva gratuita."
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent =
        "Reservar gratis";
    }
  }
}

/* =========================
   SELECCIÓN DE DURACIÓN
========================= */

async function selectDuration(
  duration,
  free = false
) {

  state.free = free;

  if (free) {
    state.duration = 10;
    state.price = 0;
  } else {
    state.duration = duration;
    state.price = prices[duration] || 0;
  }

  state.time = "";
  state.availability = [];

  render();

  await loadAvailability();

  renderPayment();
}

/* =========================
   TARJETAS DE PRECIO
========================= */

$$(".price-card").forEach((card) => {

  card.addEventListener("click", () => {

    const free =
      card.dataset.free === "true";

    const duration =
      Number(card.dataset.duration);

    if (free) {
      selectDuration(10, true);
    } else if (prices[duration]) {
      selectDuration(duration, false);
    }
  });
});

/* =========================
   OPCIONES DE DURACIÓN
========================= */

$$(
  "#duration-options button"
).forEach((button) => {

  button.addEventListener(
    "click",
    () => {

      const free =
        button.dataset.free === "true";

      const duration =
        Number(button.dataset.duration);

      if (free) {
        selectDuration(10, true);
      } else if (prices[duration]) {
        selectDuration(duration, false);
      }
    }
  );
});

/* =========================
   FECHA
========================= */

const dateInput =
  $("#date");

if (dateInput) {

  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    pad(today.getMonth() + 1);

  const day =
    pad(today.getDate());

  const todayText =
    `${year}-${month}-${day}`;

  dateInput.min =
    todayText;

  if (!dateInput.value) {
    dateInput.value =
      todayText;
  }

  state.date =
    dateInput.value;

  dateInput.addEventListener(
    "change",
    async () => {

      state.date =
        dateInput.value;

      state.time = "";

      render();

      await loadAvailability();

      renderPayment();
    }
  );
}

/* =========================
   NOMBRE / EMAIL
========================= */

const nameInput =
  $("#name");

const emailInput =
  $("#email");

if (nameInput) {
  nameInput.addEventListener(
    "input",
    renderPayment
  );
}

if (emailInput) {
  emailInput.addEventListener(
    "input",
    renderPayment
  );
}

/* =========================
   AÑO
========================= */

const yearElement =
  $("#year");

if (yearElement) {
  yearElement.textContent =
    new Date().getFullYear();
}

/* =========================
   INICIO
========================= */

createFreeButton();

render();

loadAvailability();

renderPayment();
