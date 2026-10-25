/* Arranque y enrutamiento por hash (#/...), compatible con GitHub Pages sin configuración */
S21.vistas = S21.vistas || {};

S21.app = (function () {
  const ui = () => S21.ui;
  const raiz = () => document.getElementById("app");

  function ruta() {
    const h = location.hash.replace(/^#/, "") || "/";
    const [camino, query = ""] = h.split("?");
    const partes = camino.split("/").filter(Boolean);
    const params = Object.fromEntries(new URLSearchParams(query));
    return { partes, params };
  }

  function ir(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    const { partes, params } = ruta();
    const s = S21.auth.sesion();
    ui().cerrarModal();
    window.scrollTo(0, 0);

    // Portal de la entidad requerida
    if (partes[0] === "entidad") {
      if (s?.tipo !== "entidad" || !S21.store.expediente(s.expedienteId)) {
        return montar("portal", () => S21.vistas.portalLogin);
      }
      return montar("portal", () => S21.vistas.portal, { paso: partes[1], ...params });
    }

    // Consola institucional
    if (partes[0] === "esap") {
      if (s?.tipo !== "esap" || !S21.auth.usuarioActual()) return montar("publico", () => S21.vistas.esapLogin);
      let mod = partes[1] || "m8";
      let p = { ...params };
      if (mod === "expediente") { p.id = decodeURIComponent(partes[2] || ""); mod = "m7"; }
      if (!S21.vistas[mod]) mod = "m8";
      return montar("consola", () => S21.vistas[mod], p, mod);
    }

    return montar("publico", () => S21.vistas.inicio);
  }

  function montar(marco, obtenerVista, params = {}, modulo = null) {
    const vista = obtenerVista();
    const el = raiz();
    const u = S21.auth.usuarioActual();
    if (marco === "consola") {
      el.innerHTML = `${ui().barraPrototipo()}${ui().encabezado({ subtitulo: "Consola institucional · Sede Central y Direcciones Territoriales", usuarioHtml: ui().usuarioEsap() })}
        <div class="consola">${ui().lateral(modulo)}<main class="contenido" id="vista" tabindex="-1"></main></div>${ui().pie()}`;
    } else if (marco === "portal") {
      const s = S21.auth.sesion();
      const usuarioHtml = s?.tipo === "entidad"
        ? `<div class="usuario"><div><b>${S21.util.esc(S21.store.entidad(S21.store.expediente(s.expedienteId).entidadId).nombre)}</b><span class="rol">Usuario temporal ${S21.util.esc(s.usuario)} · Expediente ${S21.util.esc(s.expedienteId)}</span></div><button class="btn-salir" data-global="salir">Salir</button></div>`
        : "";
      el.innerHTML = `${ui().barraPrototipo()}${ui().encabezado({ subtitulo: "Portal de entidades requeridas · Ley 21 de 1982", usuarioHtml })}
        <main class="portal" id="vista" tabindex="-1"></main>${ui().pie()}`;
    } else {
      el.innerHTML = `${ui().barraPrototipo()}${ui().encabezado({ subtitulo: "Sistema Integrado de Gestión de la Información del Recaudo · Ley 21 de 1982" })}
        <main class="portal" id="vista" tabindex="-1"></main>${ui().pie()}`;
    }
    const cont = document.createElement("div");
    document.getElementById("vista").appendChild(cont);
    try {
      vista.render(cont, params);
    } catch (err) {
      console.error(err);
      cont.innerHTML = `<div class="aviso error"><p><b>Ocurrió un error al mostrar esta vista.</b></p><p class="mono">${S21.util.esc(err.message)}</p>
        <p>Puede usar “Reiniciar demo” en la barra superior para restablecer los datos.</p></div>`;
    }
    document.title = `SIGREC-21 · ${vista.titulo || "Prototipo"}${u ? " · " + u.nombre : ""}`;
  }

  /* Acciones globales del marco */
  function enlazarGlobales() {
    document.addEventListener("click", (e) => {
      const g = e.target.closest("[data-global]");
      if (!g || g.tagName === "SELECT") return;
      if (g.dataset.global === "reiniciar") {
        ui().confirmar("Reiniciar demostración", "Se borrarán los cambios hechos en este navegador y se cargarán de nuevo los datos ficticios iniciales. ¿Desea continuar?", () => {
          S21.store.reiniciar();
          ui().toast("Datos de demostración restablecidos.", "ok");
          ir("#/");
        }, { txt: "Reiniciar", clase: "btn-peligro" });
      }
      if (g.dataset.global === "salir") {
        S21.auth.salir();
        ir("#/");
      }
    });
    document.addEventListener("change", (e) => {
      const g = e.target.closest("[data-global='cambiar-usuario']");
      if (!g) return;
      S21.auth.ingresarEsap(g.value);
      S21.store.guardar();
      ui().toast(`Ahora está como ${S21.auth.usuarioActual().nombre} (${S21.auth.ROLES[S21.auth.usuarioActual().rol].nombre}).`);
      render();
    });
  }

  function iniciar() {
    S21.store.cargar();
    enlazarGlobales();
    window.addEventListener("hashchange", render);
    render();
  }

  return { iniciar, render, ir, ruta };
})();

document.addEventListener("DOMContentLoaded", S21.app.iniciar);
