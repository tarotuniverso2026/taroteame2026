const cfg = window.TAROTEAME_CONFIG || {};

const sb = supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

async function load() {
  const { data, error } = await sb.functions.invoke("admin-list", {
    body: {
      date: $("#filter").value || null
    }
  });

  if (error) {
    $("#status").textContent = "No se pudieron cargar las reservas.";
    return;
  }

  const rows = data.bookings || [];

  $("#table").innerHTML = `
    <table style="width:100%;border-collapse:collapse;min-width:780px">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Duración</th>
          <th>Cliente</th>
          <th>Email</th>
          <th>Pago</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${esc(r.appointment_date)}</td>
            <td>${esc(r.start_time)}</td>
            <td>${esc(r.duration_min)} min</td>
            <td>${esc(r.customer_name)}</td>
            <td>${esc(r.customer_email)}</td>
            <td>${esc(r.payment_status)}</td>
            <td>
              ${
                r.status === "cancelled"
                  ? "Cancelada"
                  : `
                    ${
                      r.payment_status === "pending"
                        ? `<button class="approve" data-id="${esc(r.id)}">
                             ✅ Aprobar Bizum
                           </button>`
                        : ""
                    }
                    <button class="cancel" data-id="${esc(r.id)}">
                      ❌ Cancelar
                    </button>
                  `
              }
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $$(".approve").forEach(b => {
    b.onclick = async () => {
      if (!confirm("¿Confirmar que has recibido el Bizum?")) return;

      const { error } = await sb.functions.invoke("admin-approve", {
        body: { id: b.dataset.id }
      });

      if (error) {
        alert("No se pudo aprobar el Bizum.");
      } else {
        alert("Reserva aprobada correctamente.");
        load();
      }
    };
  });

  $$(".cancel").forEach(b => {
    b.onclick = async () => {
      if (!confirm("¿Cancelar esta cita?")) return;

      const { error } = await sb.functions.invoke("admin-cancel", {
        body: { id: b.dataset.id }
      });

      if (error) {
        alert("No se pudo cancelar.");
      } else {
        load();
      }
    };
  });
}

// Mostrar/ocultar formulario de clientes
$("#addCustomer").onclick = () => {
  $("#customerForm").style.display = "block";
  $("#customerMsg").textContent = "";
};

$("#cancelCustomer").onclick = () => {
  $("#customerForm").style.display = "none";
};

// Guardar cliente sin crear reserva
$("#saveCustomer").onclick = async () => {
  const name = $("#customerName").value.trim();
  const phone = $("#customerPhone").value.trim();
  const email = $("#customerEmail").value.trim();
  const notes = $("#customerNotes").value.trim();

  if (!name) {
    $("#customerMsg").textContent = "Escribe al menos el nombre del cliente.";
    return;
  }

  $("#customerMsg").textContent = "Guardando cliente...";

  const { error } = await sb
    .from("customers")
    .insert({
      name,
      phone: phone || null,
      email: email || null,
      notes: notes || null
    });

  if (error) {
    console.error(error);
    $("#customerMsg").textContent =
      "No se pudo guardar el cliente. Comprueba que eres administrador.";
    return;
  }

  $("#customerMsg").textContent = "✅ Cliente añadido correctamente.";

  $("#customerName").value = "";
  $("#customerPhone").value = "";
  $("#customerEmail").value = "";
  $("#customerNotes").value = "";

  setTimeout(() => {
    $("#customerForm").style.display = "none";
    $("#customerMsg").textContent = "";
  }, 1500);
};

$("#loginBtn").onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({
    email: $("#email").value,
    password: $("#password").value
  });

  if (error) {
    $("#loginMsg").textContent = error.message;
  } else {
    show();
  }
};

async function show() {
  const {
    data: { session }
  } = await sb.auth.getSession();

  if (!session) return;

  $("#login").style.display = "none";
  $("#panel").style.display = "block";

  $("#status").textContent =
    `Sesión iniciada como ${session.user.email}`;

  load();
}

$("#logout").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

$("#refresh").onclick = load;
$("#filter").onchange = load;

show();
