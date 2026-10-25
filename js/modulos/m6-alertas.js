/* Módulo 6 · Seguimiento y alertas
   Responsables, prioridades, fechas, aclaraciones, notificaciones y estados. Incluye el insumo de SIGIP. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store;
  const estado = { tab: "alertas", est: "ABIERTAS", tipo: "", mias: false };

  S21.vistas.m6 = {
    titulo: "Seguimiento y alertas",
    render(el, params) {
      if (params.tab) estado.tab = params.tab;
      const u = S21.auth.usuarioActual();
      const db = st.db;
      const abiertas = db.alertas.filter((a) => ["ABIERTA", "EN_GESTION"].includes(a.estado));
      const insumoPend = db.insumoSigip.filter((i) => i.estado === "PENDIENTE");
      const misNotif = db.notificaciones.filter((n) => n.destino === u.rol || n.destino === u.id);
      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 6" }], titulo: "Seguimiento y alertas",
          descripcion: "Las alertas son operativas o de diferencia; son indicios sujetos a revisión humana y cada una tiene responsable, prioridad, estado e historial." })}
        <div class="grid grid-4 mb-2">
          ${ui.kpi("Alertas abiertas", U.num(abiertas.length), `${abiertas.filter((a) => a.prioridad === "Alta").length} de prioridad alta`)}
          ${ui.kpi("Para mi rol", U.num(abiertas.filter((a) => a.rolResponsable === u.rol || a.asignadoA === u.id).length), esc(S21.auth.ROLES[u.rol].nombre))}
          ${ui.kpi("Sin responsable", U.num(abiertas.filter((a) => !a.asignadoA).length))}
          ${ui.kpi("Insumo SIGIP pendiente", U.num(insumoPend.length), "Casos sin requerimiento")}
        </div>
        ${ui.pestanas("m6", [{ id: "alertas", txt: "Alertas", n: abiertas.length }, { id: "sigip", txt: "Insumo SIGIP", n: insumoPend.length },
          { id: "agenda", txt: "Agenda y vencimientos" }, { id: "notificaciones", txt: "Notificaciones", n: misNotif.filter((n) => !n.leida).length }], estado.tab)}
        <div id="tab"></div>`;
      const t = el.querySelector("#tab");
      ({ alertas: tabAlertas, sigip: tabSigip, agenda: tabAgenda, notificaciones: tabNotif })[estado.tab](t, u);
      ui.on(el, {
        tab: (b) => { estado.tab = b.dataset.tab; S21.app.ir(`#/esap/m6?tab=${b.dataset.tab}`); },
        fila: (id) => detalleAlerta(db.alertas.find((a) => a.id === id)),
        tomar: (b) => { const a = db.alertas.find((x) => x.id === b.dataset.id); a.asignadoA = u.id; st.cambiarEstadoAlerta(a, "EN_GESTION", `Tomada por ${u.nombre}.`); S21.acciones.refrescar(); },
        requerir: (b) => { const i = db.insumoSigip.find((x) => x.id === b.dataset.id); S21.acciones.crearRequerimiento(i.entidadId, i.id); },
        leer: (b) => { const n = db.notificaciones.find((x) => x.id === b.dataset.id); n.leida = true; S21.acciones.refrescar(); },
        leerTodas: () => { misNotif.forEach((n) => (n.leida = true)); S21.acciones.refrescar(); },
      });
    },
  };

  function tabAlertas(el, u) {
    const db = st.db;
    let lista = db.alertas.filter((a) =>
      (estado.est === "TODAS" || (estado.est === "ABIERTAS" ? ["ABIERTA", "EN_GESTION"].includes(a.estado) : a.estado === estado.est)) &&
      (!estado.tipo || a.tipo === estado.tipo) && (!estado.mias || a.rolResponsable === u.rol || a.asignadoA === u.id));
    const peso = { Alta: 0, Media: 1, Baja: 2 };
    lista = lista.sort((a, b) => peso[a.prioridad] - peso[b.prioridad] || b.fecha.localeCompare(a.fecha));
    el.innerHTML = `
      <div class="filtros">
        <select id="f-est" aria-label="Estado">${[["ABIERTAS", "Abiertas y en gestión"], ...Object.entries(S21.cat.ESTADOS_ALERTA).map(([k, v]) => [k, v.txt]), ["TODAS", "Todas"]]
          .map(([k, v]) => `<option value="${k}" ${k === estado.est ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
        <select id="f-tipo" aria-label="Tipo"><option value="">Todos los tipos</option>${Object.entries(S21.cat.TIPOS_ALERTA).map(([k, v]) => `<option value="${k}" ${k === estado.tipo ? "selected" : ""}>${esc(v.txt)}</option>`).join("")}</select>
        <label class="small flex items-center gap-1"><input type="checkbox" id="f-mias" ${estado.mias ? "checked" : ""}> Solo mi rol o asignadas a mí</label>
        <span class="small muted">${lista.length} alerta(s)</span>
      </div>
      ${ui.tabla({
        columnas: [
          { t: "Alerta", v: (a) => `<span class="mono small">${esc(a.id)}</span><div class="small muted">${U.fechaHora(a.fecha)}</div>` },
          { t: "Tipo", v: (a) => `<b class="small">${esc(S21.cat.TIPOS_ALERTA[a.tipo].txt)}</b><div class="small muted">${S21.cat.TIPOS_ALERTA[a.tipo].clase === "diferencia" ? "De diferencia" : "Operativa"}</div>` },
          { t: "Detalle", v: (a) => `<span class="small">${esc(a.detalle)}</span>${a.expedienteId ? `<div class="small"><a href="#/esap/expediente/${a.expedienteId}">${esc(a.expedienteId)}</a></div>` : ""}` },
          { t: "Prioridad", v: (a) => ui.chipPrioridad(a.prioridad) },
          { t: "Responsable", v: (a) => `<span class="small">${a.asignadoA ? esc(st.usuario(a.asignadoA)?.nombre) : `<span class="tenue">Rol: ${esc(S21.auth.ROLES[a.rolResponsable].nombre)}</span>`}</span>` },
          { t: "Estado", v: (a) => ui.chipEstadoAlerta(a.estado) },
          { t: "", v: (a) => (a.estado === "ABIERTA" && S21.auth.puede("alerta.gestionar") ? `<button class="btn btn-sm btn-sec" data-accion="tomar" data-id="${a.id}">Tomar</button>` : "") },
        ],
        filas: lista, clic: (a) => a.id, vacio: "No hay alertas con estos filtros.",
      })}`;
    el.querySelector("#f-est").addEventListener("change", (e) => { estado.est = e.target.value; S21.app.render(); });
    el.querySelector("#f-tipo").addEventListener("change", (e) => { estado.tipo = e.target.value; S21.app.render(); });
    el.querySelector("#f-mias").addEventListener("change", (e) => { estado.mias = e.target.checked; S21.app.render(); });
  }

  function detalleAlerta(a) {
    const def = S21.cat.TIPOS_ALERTA[a.tipo];
    const puede = S21.auth.puede("alerta.gestionar");
    const abierta = ["ABIERTA", "EN_GESTION"].includes(a.estado);
    const usuarios = st.db.usuarios.filter((x) => x.activo && !["consulta", "auditor", "admin_tecnico"].includes(x.rol));
    ui.modal({
      titulo: `${a.id} · ${def.txt}`,
      ancho: true,
      cuerpo: `
        <dl class="dl mb-2"><dt>Detalle</dt><dd>${esc(a.detalle)}</dd><dt>Acción propuesta</dt><dd>${esc(def.accion)}</dd>
          <dt>Expediente</dt><dd>${a.expedienteId ? `<a href="#/esap/expediente/${a.expedienteId}">${esc(a.expedienteId)}</a>` : "—"}</dd>
          <dt>Entidad</dt><dd>${a.entidadId ? esc(st.entidad(a.entidadId)?.nombre) : "—"}</dd>
          <dt>Prioridad</dt><dd>${ui.chipPrioridad(a.prioridad)}</dd><dt>Estado</dt><dd>${ui.chipEstadoAlerta(a.estado)}</dd>
          ${a.justificacion ? `<dt>Justificación</dt><dd>${esc(a.justificacion)}</dd>` : ""}</dl>
        ${abierta && S21.auth.puede("alerta.asignar") ? `<div class="campo"><label for="al-u">Asignar responsable</label><select id="al-u"><option value="">— Sin asignar —</option>${usuarios.map((x) => `<option value="${x.id}" ${x.id === a.asignadoA ? "selected" : ""}>${esc(x.nombre)} · ${esc(S21.auth.ROLES[x.rol].nombre)}</option>`).join("")}</select></div>` : ""}
        <h4>Historial</h4>
        <ul class="linea-tiempo">${a.historial.map((h) => `<li><div class="cuando">${U.fechaHora(h.fecha)} · ${esc(h.por)}</div><div class="que">${esc(S21.cat.ESTADOS_ALERTA[h.estado].txt)}</div>${h.nota ? `<div class="det">${esc(h.nota)}</div>` : ""}</li>`).join("")}</ul>`,
      acciones: abierta && puede ? [
        ...(S21.auth.puede("alerta.asignar") ? [{ txt: "Guardar responsable", clase: "btn-sec", fn: (m) => {
          const id = m.querySelector("#al-u").value;
          a.asignadoA = id || null;
          a.historial.push({ fecha: U.ahora(), estado: a.estado, por: S21.auth.actor().nombre, nota: `Responsable: ${id ? st.usuario(id).nombre : "sin asignar"}` });
          if (id) st.notificar(id, `Alerta asignada: ${a.id}`, a.detalle, a.expedienteId);
          st.auditar("Asignación de alerta", a.id, id ? st.usuario(id).nombre : "sin asignar");
          S21.acciones.refrescar();
        } }] : []),
        { txt: "Descartar", clase: "btn-sec", fn: () => { setTimeout(() => ui.pedirTexto(`Descartar ${a.id}`, "Justificación", (j) => { st.cambiarEstadoAlerta(a, "DESCARTADA", j); S21.acciones.refrescar(); }, { txt: "Descartar" }), 0); } },
        { txt: "Confirmar", fn: () => { setTimeout(() => ui.pedirTexto(`Confirmar ${a.id}`, "Fundamento / gestión realizada", (j) => { st.cambiarEstadoAlerta(a, "CONFIRMADA", j); S21.acciones.refrescar(); }, { txt: "Confirmar" }), 0); } },
        { txt: "Cerrar (gestionada)", clase: "btn-ok", fn: () => { setTimeout(() => ui.pedirTexto(`Cerrar ${a.id}`, "Gestión realizada", (j) => { st.cambiarEstadoAlerta(a, "CERRADA", j); S21.acciones.refrescar(); }, { txt: "Cerrar alerta" }), 0); } },
      ] : [],
    });
  }

  function tabSigip(el) {
    const lista = st.db.insumoSigip.slice().sort((a, b) => (a.estado === "PENDIENTE" ? -1 : 1) - (b.estado === "PENDIENTE" ? -1 : 1) || b.fecha.localeCompare(a.fecha));
    const puede = S21.auth.puede("requerimiento.crear");
    el.innerHTML = `
      <div class="aviso"><p><b>Punto de entrada de SIGREC-21.</b> La identificación de presuntos omisos o morosos la realizan SIGIP, Python y Power BI (fuera del alcance de SIGREC-21).
      Aquí se reciben esos casos y se decide a cuáles requerir. La población se limita a las entidades con diferencias, dispersiones, presunta omisión o presunta mora.</p></div>
      ${ui.tabla({
        columnas: [
          { t: "Insumo", v: (i) => `<span class="mono small">${esc(i.id)}</span><div class="small muted">${U.fecha(i.fecha)}</div>` },
          { t: "Entidad", v: (i) => { const e = st.entidad(i.entidadId); return `<b>${esc(e.nombre)}</b><div class="small muted">NIT ${esc(e.nit)} · ${esc(e.dt)}</div>${e.nitCompartido ? ui.chip("NIT compartido", "alerta") : ""}`; } },
          { t: "Situación", v: (i) => `${ui.chip(i.tipo, i.tipo === "Omisión aparente" ? "error" : "alerta")}<div class="small">${esc(i.descripcion)}</div>` },
          { t: "Fuente", v: (i) => `<span class="small muted">${esc(i.fuente)}</span>` },
          { t: "Estado", v: (i) => (i.estado === "PENDIENTE" ? ui.chip("Pendiente", "alerta") : (() => { const x = st.expedientesDe(i.entidadId)[0]; return `${ui.chip("Requerido", "ok")}${x ? `<div class="small"><a href="#/esap/expediente/${x.id}">${esc(x.id)}</a></div>` : ""}`; })()) },
          { t: "", v: (i) => (i.estado === "PENDIENTE" ? `<button class="btn btn-sm" data-accion="requerir" data-id="${i.id}" ${puede ? "" : ui.sinPermiso("requerimiento.crear")}>Generar requerimiento</button>` : "") },
        ],
        filas: lista,
      })}`;
  }

  function tabAgenda(el) {
    const hoy = U.ahora();
    const items = [];
    st.db.expedientes.filter((e) => ["REQUERIDO", "EN_CARGUE"].includes(e.estado)).forEach((e) => items.push({ fecha: e.fechaLimite, exp: e, que: "Vence el plazo del requerimiento", tipo: "plazo" }));
    st.db.expedientes.filter((e) => e.estado === "MESA_TECNICA" && e.mesa).forEach((e) => items.push({ fecha: e.mesa.fecha, exp: e, que: `Mesa técnica · ${e.mesa.hora} · ${e.mesa.modalidad}`, tipo: "mesa" }));
    st.db.expedientes.filter((e) => e.estado === "RECIBIDO").forEach((e) => items.push({ fecha: U.sumarDias(e.radicado.fecha, 5), exp: e, que: "Validación funcional (5 días desde la radicación)", tipo: "validacion" }));
    items.sort((a, b) => a.fecha.localeCompare(b.fecha));
    el.innerHTML = ui.tabla({
      columnas: [
        { t: "Fecha", v: (i) => { const d = U.diasEntre(hoy, i.fecha); return `<b>${U.fecha(i.fecha)}</b><div class="small" style="color:${d < 0 ? "var(--error)" : d <= 3 ? "var(--alerta)" : "var(--texto-suave)"}">${d < 0 ? `Vencido hace ${-d} día(s)` : d === 0 ? "Hoy" : `En ${d} día(s)`}</div>`; } },
        { t: "Actividad", v: (i) => esc(i.que) },
        { t: "Expediente", v: (i) => `<a href="#/esap/expediente/${i.exp.id}">${esc(i.exp.id)}</a><div class="small muted">${esc(st.entidad(i.exp.entidadId).nombre)}</div>` },
        { t: "Responsable", v: (i) => esc(st.usuario(i.exp.responsableId)?.nombre || "Sin asignar") },
        { t: "Estado", v: (i) => ui.chipEstadoExp(i.exp.estado) },
      ],
      filas: items, vacio: "No hay actividades programadas.",
    });
  }

  function tabNotif(el, u) {
    const lista = st.db.notificaciones.filter((n) => n.destino === u.rol || n.destino === u.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    el.innerHTML = `
      <div class="flex between items-center mb-1"><p class="small muted mb-0">Notificaciones electrónicas simuladas para ${esc(u.nombre)} y su rol (${esc(S21.auth.ROLES[u.rol].nombre)}). En producción se enviarían por correo institucional.</p>
        <button class="btn btn-sm btn-sec" data-accion="leerTodas">Marcar todas como leídas</button></div>
      ${ui.tabla({
        columnas: [
          { t: "Fecha", v: (n) => `<span class="small">${U.fechaHora(n.fecha)}</span>` },
          { t: "Asunto", v: (n) => `${n.leida ? "" : "● "}<b class="small">${esc(n.asunto)}</b><div class="small muted">${esc(n.cuerpo)}</div>` },
          { t: "Expediente", v: (n) => (n.expedienteId ? `<a href="#/esap/expediente/${n.expedienteId}">${esc(n.expedienteId)}</a>` : "—") },
          { t: "", v: (n) => (n.leida ? "" : `<button class="btn btn-sm btn-txt" data-accion="leer" data-id="${n.id}">Marcar leída</button>`) },
        ],
        filas: lista.slice(0, 100), vacio: "Sin notificaciones.",
      })}`;
  }
})();
