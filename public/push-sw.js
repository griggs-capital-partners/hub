self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.title || "Smart Hub";
  const options = {
    body: payload.body,
    icon: payload.icon || "/logo.png",
    badge: payload.badge || "/logo.png",
    image: payload.image || "/AgentBackground.png",
    tag: payload.tag,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [100, 30, 100],
    timestamp: Date.now(),
    data: {
      url: payload.url || "/",
      actionUrl: payload.url || "/",
    },
    actions: Array.isArray(payload.actions) ? payload.actions : [
      { action: "open", title: "Open Smart Hub" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.actionUrl || event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        const desiredUrl = new URL(targetUrl, self.location.origin);

        if ("focus" in client) {
          if (clientUrl.origin === desiredUrl.origin) {
            client.navigate(desiredUrl.pathname + desiredUrl.search + desiredUrl.hash);
          }
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
