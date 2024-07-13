const PUBLIC_VAPID_KEY = 'BJeeEU2GdRgwRoOXa9o5EvQ2ioSJePVEwuGCIVe4IxaFDJQQxkJlH8GmLieOjgWzAeswBQOlQt89v9KKwnGTsSo';

const subscription = async (username, idrol) => {
  try {
    console.log("Registering a Service worker");
    const register = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/"
    });
    console.log("New Service Worker registered");
    const subscription = await register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    console.log('Subscription:', subscription);
    console.log(idrol);

    await fetch("/subscription", {
      method: "POST",
      body: JSON.stringify({ subscription, username, idrol }), // Enviar el username junto con la suscripción
      headers: {
        "Content-Type": "application/json"
      }
    });
    console.log("Subscribed!");
  } catch (error) {
    console.error("Error during subscription:", error);
  }
};


function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


// Service Worker Support
if ("serviceWorker" in navigator) {
  const username = window.username;
  const idrol = window.idrol; // Obtener el idrol del objeto global
  subscription(username, idrol).catch(err => console.log(err));
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(error => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}


document.addEventListener('DOMContentLoaded', function () {
  // Inicializar select2
  $('.select2').select2();

  // Manejar el evento de clic en los botones de eliminar
  document.querySelectorAll('.btn-danger').forEach(button => {
    button.addEventListener('click', function (event) {
      if (!confirm('¿Estás seguro de que quieres eliminar este ítem?')) {
        event.preventDefault();
      }
    });
  });

  // Puedes añadir más funcionalidades aquí
});