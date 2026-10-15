// Notificações do ritmo, carregado pelo service worker do PWA (vite.config.ts).
// O servidor manda { titulo, corpo, url, tag }; aqui vira notificação, e o
// toque abre o app direto na tela certa.

self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch {
    d = { corpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(d.titulo || "ritmo", {
      body: d.corpo || "",
      icon: "/icone-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.url) || "/", self.location.origin);
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aberta = janelas.find((c) => new URL(c.url).origin === url.origin);
      if (aberta) {
        // O app já está aberto: troca de tela sem recarregar.
        aberta.postMessage({ tipo: "abrir", caminho: url.pathname });
        return aberta.focus();
      }
      return self.clients.openWindow(url.href);
    })()
  );
});
