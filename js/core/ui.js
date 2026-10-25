/* Componentes de interfaz compartidos: marco institucional, menú, modales, avisos y tablas */
S21.ui = (function () {
  const U = S21.util;
  const esc = U.esc;

  const MODULOS = [
    { id: "m1", n: 1, nombre: "Maestro de entidades aportantes", corto: "Maestro de entidades" },
    { id: "m2", n: 2, nombre: "Recepción y carga controlada", corto: "Recepción y carga" },
    { id: "m3", n: 3, nombre: "Calidad y estructuración", corto: "Calidad y estructuración" },
    { id: "m4", n: 4, nombre: "Asociación y cruce", corto: "Asociación y cruce" },
    { id: "m5", n: 5, nombre: "Conciliación y diferencias", corto: "Conciliación" },
    { id: "m6", n: 6, nombre: "Seguimiento y alertas", corto: "Seguimiento y alertas" },
    { id: "m7", n: 7, nombre: "Expediente de seguimiento", corto: "Expedientes" },
    { id: "m8", n: 8, nombre: "Tablero e informes", corto: "Tablero e informes" },
    { id: "m9", n: 9, nombre: "Seguridad y auditoría", corto: "Seguridad y auditoría" },
  ];

  /* ---------- Marco ---------- */

  function barraPrototipo() {
    return `<div class="barra-prototipo" role="note">
      <span><strong>PROTOTIPO ACADÉMICO</strong> · Datos ficticios · No es un sistema oficial de la ESAP · Convocatoria Mejor Equipo de Trabajo 2026</span>
      <button type="button" data-global="reiniciar" title="Restablece todos los datos de demostración">Reiniciar demo</button>
    </div>`;
  }

  function encabezado({ subtitulo, usuarioHtml = "" }) {
    return `<header class="encabezado">
      <a href="#/" aria-label="Inicio"><img class="logo" src="assets/img/logo-esap-blanco.png" alt="Escuela Superior de Administración Pública"></a>
      <div class="sistema"><b>SIGREC-21</b><span>${esc(subtitulo)}</span></div>
      ${usuarioHtml}
    </header>`;
  }

  function pie() {
    return `<footer class="pie">SIGREC-21 · Sistema Integrado de Gestión de la Información del Recaudo asociado a las contribuciones de la Ley 21 de 1982 ·
      Prototipo funcional de la propuesta técnica (fase de diseño). Las alertas y clasificaciones son indicios sujetos a revisión humana y no producen efectos jurídicos, contables ni administrativos.</footer>`;
  }

  function usuarioEsap() {
    const u = S21.auth.usuarioActual();
    const opciones = S21.store.db.usuarios.filter((x) => x.activo)
      .map((x) => `<option value="${x.id}" ${x.id === u.id ? "selected" : ""}>${esc(x.nombre)} · ${esc(S21.auth.ROLES[x.rol].nombre)}</option>`).join("");
    const pendientes = S21.store.db.notificaciones.filter((n) => !n.leida && (n.destino === u.rol || n.destino === u.id)).length;
    return `<div class="usuario">
      <a href="#/esap/m6?tab=notificaciones" style="color:#fff;text-decoration:none" title="Notificaciones">🔔 <b>${pendientes}</b></a>
      <div class="avatar">${esc(U.iniciales(u.nombre))}</div>
      <div><b>${esc(u.nombre)}</b><span class="rol">${esc(S21.auth.ROLES[u.rol].nombre)} · ${esc(u.dt)}</span></div>
      <label class="sr-only" for="cambio-rol">Cambiar de usuario (demo)</label>
      <select id="cambio-rol" data-global="cambiar-usuario" title="Cambiar de usuario para la demostración">${opciones}</select>
      <button class="btn-salir" data-global="salir">Salir</button>
    </div>`;
  }

  function lateral(activo) {
    const db = S21.store.db;
    const u = S21.auth.usuarioActual();
    const alertasAbiertas = db.alertas.filter((a) => ["ABIERTA", "EN_GESTION"].includes(a.estado) && (a.rolResponsable === u.rol || a.asignadoA === u.id)).length;
    const link = (m) => `<a href="#/esap/${m.id}" class="${activo === m.id ? "activo" : ""}"><span class="n">${m.n}</span>${esc(m.corto)}
      ${m.id === "m6" && alertasAbiertas ? `<span class="contador" title="Alertas abiertas para su rol">${alertasAbiertas}</span>` : ""}</a>`;
    return `<nav class="lateral" aria-label="Módulos">
      <div class="titulo-nav">Gestión del recaudo</div>
      ${MODULOS.slice(0, 5).map(link).join("")}
      <div class="titulo-nav">Seguimiento y control</div>
      ${MODULOS.slice(5).map(link).join("")}
    </nav>`;
  }

  function cabecera({ migas = [], titulo, descripcion = "", acciones = "" }) {
    return `<div class="cabecera-vista">
      <div>
        ${migas.length ? `<div class="migas">${migas.map((m) => (m.href ? `<a href="${m.href}">${esc(m.txt)}</a>` : esc(m.txt))).join(" › ")}</div>` : ""}
        <h1>${esc(titulo)}</h1>
        ${descripcion ? `<p>${descripcion}</p>` : ""}
      </div>
      ${acciones ? `<div class="acciones">${acciones}</div>` : ""}
    </div>`;
  }

  /* ---------- Piezas ---------- */

  const chip = (txt, clase = "") => `<span class="chip ${clase}">${esc(txt)}</span>`;
  function chipEstadoExp(estado) { const e = S21.cat.ESTADOS_EXPEDIENTE[estado]; return chip(e?.txt || estado, e?.chip); }
  function chipEstadoAlerta(estado) { const e = S21.cat.ESTADOS_ALERTA[estado]; return chip(e?.txt || estado, e?.chip); }
  function chipClasif(c) { const d = S21.reglas.CLASIFICACION[c]; return chip(d?.txt || c, d?.chip); }
  function chipPrioridad(p) { return chip(p, p === "Alta" ? "error" : p === "Media" ? "alerta" : ""); }
  function chipRevision(r) {
    const m = { PENDIENTE: ["Pendiente de revisión", "alerta"], CONFIRMADA: ["Confirmada", "info"], DESCARTADA: ["Descartada", ""], NO_REQUIERE: ["No requiere", "ok"] };
    const [t, c] = m[r?.estado] || [r?.estado || "—", ""];
    return chip(t, c);
  }

  function tabla({ columnas, filas, vacio = "Sin registros.", clic = null, pie = null }) {
    const th = columnas.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.t)}</th>`).join("");
    const tr = filas.length
      ? filas.map((f, i) => `<tr ${clic ? `class="clic" data-fila="${esc(clic(f, i))}"` : ""}>${columnas.map((c) => `<td class="${c.num ? "num" : ""}">${c.v(f, i)}</td>`).join("")}</tr>`).join("")
      : `<tr><td class="vacio" colspan="${columnas.length}">${esc(vacio)}</td></tr>`;
    return `<div class="tabla-wrap"><table class="tabla"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${pie ? `<tfoot><tr>${pie}</tr></tfoot>` : ""}</table></div>`;
  }

  function kpi(etq, valor, det = "") {
    return `<div class="tarjeta kpi"><span class="etq">${esc(etq)}</span><span class="valor">${valor}</span>${det ? `<span class="det">${det}</span>` : ""}</div>`;
  }

  function barras(items, max) {
    const m = max || Math.max(1, ...items.map((i) => i.valor));
    return `<div class="barras">${items.map((i) => `<div class="barra"><span>${esc(i.etq)}</span>
      <div class="pista" role="img" aria-label="${esc(i.etq)}: ${esc(i.txt ?? i.valor)}"><div class="relleno ${i.clase || ""}" style="width:${Math.max(2, (i.valor / m) * 100)}%"></div></div>
      <span class="num">${esc(i.txt ?? i.valor)}</span></div>`).join("")}</div>`;
  }

  /* ---------- Avisos y ventanas ---------- */

  function toast(msg, tipo = "") {
    let cont = document.querySelector(".toasts");
    if (!cont) { cont = document.createElement("div"); cont.className = "toasts"; cont.setAttribute("aria-live", "polite"); document.body.appendChild(cont); }
    const t = document.createElement("div");
    t.className = `toast ${tipo}`;
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* modal({titulo, cuerpo, acciones:[{txt, clase, fn(modalEl) => boolean|void}], ancho}) */
  function modal({ titulo, cuerpo, acciones = [], ancho = false, alAbrir }) {
    cerrarModal();
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `<div class="modal ${ancho ? "ancho" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <div class="modal-cab"><h3 id="modal-titulo">${esc(titulo)}</h3><button class="cerrar" aria-label="Cerrar" data-cerrar>×</button></div>
      <div class="modal-cuerpo">${cuerpo}</div>
      <div class="modal-pie">${[{ txt: acciones.length ? "Cancelar" : "Cerrar", clase: "btn-sec", cerrar: true }, ...acciones]
        .map((a, i) => `<button class="btn ${a.clase || ""}" data-i="${i}">${esc(a.txt)}</button>`).join("")}</div>
    </div>`;
    const todas = [{ cerrar: true }, ...acciones];
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo || e.target.closest("[data-cerrar]")) return cerrarModal();
      const b = e.target.closest(".modal-pie [data-i]");
      if (!b) return;
      const a = todas[Number(b.dataset.i)];
      if (a.cerrar) return cerrarModal();
      const r = a.fn ? a.fn(fondo.querySelector(".modal")) : undefined;
      if (r !== false) cerrarModal();
    });
    document.addEventListener("keydown", escCierra);
    document.body.appendChild(fondo);
    const primero = fondo.querySelector(".modal-cuerpo input, .modal-cuerpo select, .modal-cuerpo textarea") || fondo.querySelector(".modal-pie .btn:last-child");
    primero?.focus();
    alAbrir?.(fondo.querySelector(".modal"));
    return fondo.querySelector(".modal");
  }
  function escCierra(e) { if (e.key === "Escape") cerrarModal(); }
  function cerrarModal() {
    document.querySelectorAll(".modal-fondo").forEach((m) => m.remove());
    document.removeEventListener("keydown", escCierra);
  }

  function confirmar(titulo, texto, fn, { txt = "Confirmar", clase = "" } = {}) {
    modal({ titulo, cuerpo: `<p>${texto}</p>`, acciones: [{ txt, clase, fn }] });
  }

  /* Pide una justificación obligatoria (descartes, cambios de regla, asociaciones manuales) */
  function pedirTexto(titulo, etiqueta, fn, { txt = "Guardar", ayuda = "", valor = "" } = {}) {
    modal({
      titulo,
      cuerpo: `<div class="campo"><label for="pt">${esc(etiqueta)} <span class="req">*</span></label>
        <textarea id="pt">${esc(valor)}</textarea>${ayuda ? `<span class="ayuda">${esc(ayuda)}</span>` : ""}<span class="err" id="pt-err"></span></div>`,
      acciones: [{ txt, fn: (m) => {
        const v = m.querySelector("#pt").value.trim();
        if (v.length < 10) { m.querySelector("#pt-err").textContent = "Escriba una justificación de al menos 10 caracteres."; return false; }
        fn(v);
      } }],
    });
  }

  /* Delegación de eventos: data-accion="nombre" en el contenedor de la vista */
  function on(raiz, acciones) {
    raiz.addEventListener("click", (e) => {
      const el = e.target.closest("[data-accion]");
      if (el && raiz.contains(el)) {
        const fn = acciones[el.dataset.accion];
        if (fn) { e.preventDefault(); fn(el, e); }
        return;
      }
      const tr = e.target.closest("tr.clic");
      if (tr && acciones.fila && !e.target.closest("a, button, input, select, label")) acciones.fila(tr.dataset.fila, tr);
    });
    raiz.addEventListener("change", (e) => {
      const el = e.target.closest("[data-cambio]");
      if (!el) return;
      const fn = acciones[el.dataset.cambio];
      if (fn) fn(el, e);
    });
  }

  function pestanas(id, items, activa) {
    return `<div class="pestanas" role="tablist">${items.map((i) => `<button role="tab" aria-selected="${i.id === activa}" data-accion="tab" data-tab="${i.id}" data-grupo="${id}">${esc(i.txt)}${i.n != null ? ` (${i.n})` : ""}</button>`).join("")}</div>`;
  }

  function zonaCarga(id, texto, acepta) {
    return `<label class="zona-carga" for="${id}" data-zona="${id}">
      <input type="file" id="${id}" accept="${acepta}">
      <div style="font-size:1.6rem">⬆</div><b>${texto}</b><div class="small muted">Arrastre el archivo aquí o haga clic para seleccionarlo · ${esc(acepta)}</div>
    </label>`;
  }
  /* Activa arrastrar y soltar sobre las zonas de carga de una vista */
  function activarZonas(raiz, alCargar) {
    raiz.querySelectorAll(".zona-carga").forEach((z) => {
      const input = z.querySelector("input");
      input.addEventListener("change", () => input.files[0] && alCargar(input.id, input.files[0]));
      z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("sobre"); });
      z.addEventListener("dragleave", () => z.classList.remove("sobre"));
      z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("sobre"); if (e.dataTransfer.files[0]) alCargar(input.id, e.dataTransfer.files[0]); });
    });
  }

  const sinPermiso = (permiso) => (S21.auth.puede(permiso) ? "" : `disabled title="Su rol no tiene el permiso: ${esc(S21.auth.PERMISOS[permiso])}"`);

  return {
    MODULOS, barraPrototipo, encabezado, pie, usuarioEsap, lateral, cabecera, chip, chipEstadoExp, chipEstadoAlerta, chipClasif,
    chipPrioridad, chipRevision, tabla, kpi, barras, toast, modal, cerrarModal, confirmar, pedirTexto, on, pestanas, zonaCarga, activarZonas, sinPermiso,
  };
})();
