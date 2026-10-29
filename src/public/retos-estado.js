// Vistas /retos/*: el encabezado compartido muestra el estado del servicio, como en la portada.
const status = document.querySelector('#service-status');
fetch('/health')
  .then(response => response.json())
  .then(() => { status.textContent = 'Servicio disponible'; })
  .catch(() => { status.textContent = 'Servicio no disponible'; });
