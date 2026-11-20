/* ============================================================
   NoSkip Studio — CONTENIDO DE LA TARJETA
   Edita solo este archivo. Todo lo marcado con // CAMBIAR es un ejemplo.
   Los enlaces sin "url" no se muestran.
   ============================================================ */

window.NOSKIP = {
  email: "hola@noskipstudio.com",                       // CAMBIAR

  // JUEGOS (salen bajo la tarjeta, en el orden de esta lista)
  //   name:   nombre (si lleva ":", lo de después sale como subtítulo en la portada)
  //   text:   una o dos frases de presentación
  //   genre:  género o plataformas
  //   cover:  opcional, ruta a una imagen 16:10 (ej. "assets/kairos.jpg"); sin ella se dibuja una portada con el nombre
  //   color:  opcional, color de la portada
  //   url:    opcional, enlace (Steam, itch.io, tráiler...)
  games: [
    {
      name: "KAIROS: The Last Runner",
      status: "En desarrollo",
      text: "Nuestro proyecto principal. El juego que hemos traído al evento.",
      genre: "",
      color: "#9b1df6",
      url: "",
    },
    {
      name: "Studio With Friends",
      status: "En desarrollo",
      text: "",                 // añade una frase de presentación
      genre: "",
      color: "#2e5cff",
      url: "",
    },
    {
      name: "NightShift",
      status: "En desarrollo",
      text: "",                 // añade una frase de presentación
      genre: "Terror",
      color: "#ff2b5c",
      url: "",
    },
  ],

  team: [
    { name: "Oihan", role: "Game Designer & Developer" },
    { name: "Alex", role: "Game Designer & Developer" },
    { name: "Pablo", role: "3D Artist" },
  ],

  links: [
    { name: "Steam", url: "https://store.steampowered.com" },  // CAMBIAR
    { name: "itch.io", url: "https://itch.io" },               // CAMBIAR
    { name: "Discord", url: "https://discord.com" },           // CAMBIAR
    { name: "Instagram", url: "https://instagram.com" },       // CAMBIAR
    { name: "TikTok", url: "https://tiktok.com" },             // CAMBIAR
    { name: "YouTube", url: "https://youtube.com" },           // CAMBIAR
  ],

  // Ficha que se descarga con "Guardar contacto"
  contactCard: {
    name: "NoSkip Studio",
    email: "hola@noskipstudio.com",      // CAMBIAR
    phone: "",                            // opcional, ej: "+34600000000"
    web: "https://noskipstudio.com",      // CAMBIAR
    note: "Estudio de videojuegos",
  },
};
