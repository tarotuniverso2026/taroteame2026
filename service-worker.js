self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  const title = data.title || "💬 Taroteame";
  const options = {
    body: data.body || "Tienes un nuevo mensaje.",
    icon: "/logo-taroteame.png",
    badge: "/logo-taroteame.png",
    data: {
      url: data.url || "/chat-admin.html"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const url = event.notification.data?.url || "/chat-admin.html";

  event.waitUntil(
    clients.openWindow(url)
  );
});
