/* Módulo 9 · Seguridad y auditoría
   Roles, permisos, cambios, consultas, versiones (reglas) y trazabilidad. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store;
  const estado = { tab: "auditoria", q: "", usuario: "", ver: {} };

  S21.vistas.m9 = {
    titulo: "Seguridad y auditoría",
    render(el, params) {
      if (params.tab) estado.tab = params.tab;
      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 9" }], titulo: "Seguridad y auditoría",
          descripcion: "Mínimo privilegio, credenciales temporales por expediente, reglas versionadas y registro de cada cambio y consulta relevante." })}
        ${ui.pestanas("m9", [{ id: "auditoria", txt: "Auditoría", n: st.db.auditoria.length }, { id: "credenciales", txt: "Credenciales temporales" },
          { id: "reglas", txt: "Reglas y parámetros" }, { id: "roles", txt: "Roles y permisos" }, { id: "usuarios", txt: "Usuarios" }, { id: "sistema", txt: "Sistema" }], estado.tab)}
        <div id="tab"></div>`;
      const t = el.querySelector("#tab");
      ({ auditoria: tabAuditoria, credenciales: tabCredenciales, reglas: tabReglas, roles: tabRoles, usuarios: tabUsuarios, sistema: tabSistema })[estado.tab](t);
      ui.on(el, {
        tab: (b) => { estado.tab = b.dataset.tab; S21.app.render(); },
        exportarAud: () => {
          const l = filtrarAud();
          S21.excel.exportar("auditoria_SIGREC21.xlsx", ["Fecha", "Usuario", "Rol", "Acción", "Objeto", "Detalle"], l.map((a) => [U.fechaHora(a.fecha), a.usuario, a.rol, a.accion, a.objeto, a.detalle]));
          st.auditar("Exportación", "Auditoría", `${l.length} registros`); st.guardar();
        },
        verClave: (b) => { estado.ver[b.dataset.id] = !estado.ver[b.dataset.id]; if (estado.ver[b.dataset.id]) { st.auditar("Consulta de clave temporal", b.dataset.id, ""); st.guardar(); } S21.app.render(); },
        revocar: (b) => { const e = st.expediente(b.dataset.id); ui.pedirTexto(`Revocar credencial ${e.credencial.usuario}`, "Motivo", (m) => { e.credencial.activa = false; st.bitacora(e.id, "Credencial temporal revocada", m); st.auditar("Revocación de credencial", e.credencial.usuario, m); S21.acciones.refrescar(); }, { txt: "Revocar" }); },
        extender: (b) => { const e = st.expediente(b.dataset.id); const n = U.sumarDias(new Date(Math.max(new Date(e.credencial.vence), Date.now())).toISOString(), 5);
          e.credencial.vence = n; e.fechaLimite = n; e.credencial.activa = true;
          st.bitacora(e.id, "Plazo y credencial extendidos", `Nueva fecha límite ${U.fecha(n)}.`); st.auditar("Extensión de credencial", e.credencial.usuario, U.fecha(n));
          st.db.alertas.filter((a) => a.expedienteId === e.id && a.tipo === "FUERA_DE_PLAZO" && ["ABIERTA", "EN_GESTION"].includes(a.estado)).forEach((a) => st.cambiarEstadoAlerta(a, "CERRADA", `Plazo extendido hasta ${U.fecha(n)}.`));
          S21.acciones.refrescar(); ui.toast(`Credencial vigente hasta ${U.fecha(n)}.`, "ok"); },
        editarRegla: (b) => editarRegla(st.regla(b.dataset.id)),
        toggleUsuario: (b) => { const x = st.usuario(b.dataset.id); if (x.id === S21.auth.usuarioActual().id) return ui.toast("No puede desactivar su propio usuario.", "error"); x.activo = !x.activo; st.auditar(x.activo ? "Activación de usuario" : "Desactivación de usuario", x.nombre, ""); S21.acciones.refrescar(); },
        reiniciar: () => document.querySelector("[data-global='reiniciar']").click(),
      });
    },
  };

  function filtrarAud() {
    return st.db.auditoria.filter((a) => (!estado.usuario || a.usuarioId === estado.usuario) &&
      (!estado.q || U.normalizar(`${a.accion} ${a.objeto} ${a.detalle}`).includes(U.normalizar(estado.q)))).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  function tabAuditoria(el) {
    if (!S21.auth.puede("auditoria.ver")) { el.innerHTML = `<div class="aviso alerta"><p>Su rol no tiene acceso a la auditoría. Cambie a <b>Sandra Milena Vélez (Auditora)</b> u <b>Óscar Beltrán (Administrador técnico)</b> desde el encabezado.</p></div>`; return; }
    const l = filtrarAud();
    const actores = [...new Map(st.db.auditoria.map((a) => [a.usuarioId, a.usuario])).entries()];
    el.innerHTML = `
      <div class="filtros">
        <input type="search" id="f-q" placeholder="Acción, objeto o detalle" value="${esc(estado.q)}" aria-label="Buscar en auditoría">
        <select id="f-u" aria-label="Usuario"><option value="">Todos los usuarios</option>${actores.map(([id, n]) => `<option value="${esc(id)}" ${id === estado.usuario ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
        <span class="small muted">${l.length} registro(s)</span>
        <button class="btn btn-sec btn-sm" data-accion="exportarAud">Exportar</button>
      </div>
      ${ui.tabla({ columnas: [
        { t: "Fecha", v: (a) => `<span class="small nowrap">${U.fechaHora(a.fecha)}</span>` },
        { t: "Usuario", v: (a) => `<span class="small">${esc(a.usuario)}</span><div class="small muted">${esc(S21.auth.ROLES[a.rol]?.nombre || a.rol)}</div>` },
        { t: "Acción", v: (a) => `<b class="small">${esc(a.accion)}</b>` },
        { t: "Objeto", v: (a) => `<span class="small mono">${esc(a.objeto)}</span>` },
        { t: "Detalle", v: (a) => `<span class="small">${esc(a.detalle)}</span>` },
      ], filas: l.slice(0, 300) })}`;
    let t;
    el.querySelector("#f-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { estado.q = e.target.value; S21.app.render(); setTimeout(() => { const q = document.querySelector("#f-q"); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }, 0); }, 300); });
    el.querySelector("#f-u").addEventListener("change", (e) => { estado.usuario = e.target.value; S21.app.render(); });
  }

  function tabCredenciales(el) {
    const puede = S21.auth.puede("credenciales.gestionar");
    const verClaves = puede || S21.auth.puede("requerimiento.crear");
    const exps = st.db.expedientes.slice().sort((a, b) => b.creado.localeCompare(a.creado));
    el.innerHTML = `
      <div class="aviso"><p>Cada credencial es <b>temporal</b> y está vinculada a un único requerimiento o expediente. Se desactiva al cerrar el expediente y vence con el plazo.
      ${puede ? "" : " Revocar o extender requiere el rol Administrador técnico."}</p></div>
      ${ui.tabla({ columnas: [
        { t: "Usuario", v: (e) => `<span class="mono">${esc(e.credencial.usuario)}</span>` },
        { t: "Clave", v: (e) => (verClaves ? `<span class="mono">${estado.ver[e.id] ? esc(e.credencial.clave) : "••••••••••"}</span> <button class="btn btn-txt btn-sm" data-accion="verClave" data-id="${e.id}">${estado.ver[e.id] ? "Ocultar" : "Mostrar"}</button>` : '<span class="tenue">Restringida</span>') },
        { t: "Expediente", v: (e) => `<a href="#/esap/expediente/${e.id}">${esc(e.id)}</a><div class="small muted">${esc(st.entidad(e.entidadId).nombre)}</div>` },
        { t: "Emitida", v: (e) => U.fecha(e.credencial.emitida) },
        { t: "Vence", v: (e) => U.fecha(e.credencial.vence) },
        { t: "Último acceso", v: (e) => `<span class="small">${U.fechaHora(e.credencial.ultimoAcceso)}</span>` },
        { t: "Estado", v: (e) => (!e.credencial.activa ? ui.chip("Inactiva") : new Date(e.credencial.vence) < new Date() ? ui.chip("Vencida", "error") : ui.chip("Vigente", "ok")) },
        { t: "", v: (e) => (e.estado !== "CERRADO" && puede ? `<div class="acciones"><button class="btn btn-sm btn-sec" data-accion="extender" data-id="${e.id}">+5 días</button>${e.credencial.activa ? `<button class="btn btn-sm btn-peligro" data-accion="revocar" data-id="${e.id}">Revocar</button>` : ""}</div>` : "") },
      ], filas: exps })}`;
  }

  function tabReglas(el) {
    const puede = S21.auth.puede("reglas.editar");
    el.innerHTML = `
      <p class="small muted">Cada cambio crea una nueva versión con fecha, autor y motivo. La conciliación registra la versión de regla que aplicó, de modo que un resultado se puede reconstruir.
      ${puede ? "" : "Editar requiere el rol Administrador funcional."}</p>
      ${ui.tabla({ columnas: [
        { t: "Código", v: (r) => `<span class="mono">${esc(r.codigo)}</span>` },
        { t: "Regla", v: (r) => `<b>${esc(r.nombre)}</b><div class="small muted">${esc(r.descripcion)}</div>` },
        { t: "Valor", num: true, v: (r) => `<b>${r.unidad === "proporción" ? U.pct(r.valor, 2) : r.unidad === "pesos" ? U.pesos(r.valor) : esc(String(r.valor))}</b><div class="small muted">${esc(r.unidad)}</div>` },
        { t: "Versión", v: (r) => `v${esc(r.version)}<div class="small muted">desde ${U.fecha(r.desde)}</div>` },
        { t: "Historial", v: (r) => `<span class="small">${r.historial.slice().reverse().map((h) => `v${esc(h.version)}: ${esc(String(h.valor))} · ${esc(h.por)}${h.motivo ? ` · <i>${esc(h.motivo)}</i>` : ""}`).join("<br>")}</span>` },
        { t: "", v: (r) => `<button class="btn btn-sm btn-sec" data-accion="editarRegla" data-id="${r.codigo}" ${puede ? "" : ui.sinPermiso("reglas.editar")}>Nueva versión</button>` },
      ], filas: st.db.reglas })}`;
  }

  function editarRegla(r) {
    ui.modal({
      titulo: `${r.codigo} · ${r.nombre}`,
      cuerpo: `<p class="small">${esc(r.descripcion)}</p>
        <div class="campo"><label for="rg-v">Nuevo valor (${esc(r.unidad)})</label><input id="rg-v" type="number" step="any" value="${r.valor}"></div>
        <div class="campo"><label for="rg-m">Motivo y soporte normativo <span class="req">*</span></label><textarea id="rg-m"></textarea></div>
        <p class="small muted mb-0">Las conciliaciones ya ejecutadas conservan la versión con la que se hicieron. Las nuevas usarán v${(Number(r.version) + 0.1).toFixed(1)}.</p>`,
      acciones: [{ txt: "Guardar nueva versión", fn: (m) => {
        const v = Number(m.querySelector("#rg-v").value);
        const motivo = m.querySelector("#rg-m").value.trim();
        if (!isFinite(v) || v < 0 || motivo.length < 10) { ui.toast("Valor válido y motivo (mín. 10 caracteres) obligatorios.", "error"); return false; }
        const antes = r.valor;
        r.valor = v; r.version = (Number(r.version) + 0.1).toFixed(1); r.desde = U.ahora().slice(0, 10);
        r.historial.push({ version: r.version, valor: v, desde: r.desde, por: S21.auth.actor().nombre, motivo });
        st.auditar("Nueva versión de regla", `${r.codigo} v${r.version}`, `${antes} → ${v}. ${motivo}`);
        S21.acciones.refrescar();
        ui.toast(`${r.codigo} actualizada a v${r.version}.`, "ok");
      } }],
    });
  }

  function tabRoles(el) {
    const roles = Object.entries(S21.auth.ROLES);
    el.innerHTML = `
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Permiso</th>${roles.map(([, r]) => `<th class="center" style="white-space:normal;min-width:90px">${esc(r.nombre)}</th>`).join("")}</tr></thead>
      <tbody>${Object.entries(S21.auth.PERMISOS).map(([p, d]) => `<tr><td class="small">${esc(d)}<div class="mono tenue" style="font-size:0.7rem">${esc(p)}</div></td>${roles.map(([, r]) => `<td class="center">${r.permisos.includes(p) ? '<span style="color:var(--ok);font-weight:700" aria-label="Sí">✓</span>' : '<span class="tenue" aria-label="No">·</span>'}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <div class="grid grid-3 mt-2">${roles.map(([, r]) => `<div class="tarjeta"><b>${esc(r.nombre)}</b><p class="small muted mb-0">${esc(r.desc)}</p></div>`).join("")}</div>`;
  }

  function tabUsuarios(el) {
    const puede = S21.auth.puede("usuarios.editar");
    el.innerHTML = `${puede ? "" : '<p class="small muted">Activar o desactivar usuarios requiere el rol Administrador técnico.</p>'}
      ${ui.tabla({ columnas: [
        { t: "Usuario", v: (u) => `<b>${esc(u.nombre)}</b><div class="small muted">${esc(u.correo)}</div>` },
        { t: "Cargo", v: (u) => `<span class="small">${esc(u.cargo)}</span>` },
        { t: "Rol", v: (u) => ui.chip(S21.auth.ROLES[u.rol].nombre, "info") },
        { t: "Ámbito", v: (u) => esc(u.dt) },
        { t: "Estado", v: (u) => (u.activo ? ui.chip("Activo", "ok") : ui.chip("Inactivo")) },
        { t: "", v: (u) => (puede ? `<button class="btn btn-sm btn-sec" data-accion="toggleUsuario" data-id="${u.id}">${u.activo ? "Desactivar" : "Activar"}</button>` : "") },
      ], filas: st.db.usuarios })}`;
  }

  function tabSistema(el) {
    let bytes = 0;
    try { bytes = (localStorage.getItem("sigrec21.estado.v1") || "").length * 2; } catch (e) { /* sin acceso */ }
    const db = st.db;
    el.innerHTML = `
      <div class="grid grid-2">
        <div class="tarjeta"><h3>Datos de demostración</h3><dl class="dl">
          <dt>Versión de datos</dt><dd>${esc(db.version)}</dd><dt>Creados</dt><dd>${U.fechaHora(db.creado)}</dd>
          <dt>Almacenamiento</dt><dd>${U.tamano(bytes)} en este navegador</dd>
          <dt>Registros</dt><dd class="small">${db.entidades.length} entidades · ${db.expedientes.length} expedientes · ${db.pagos.length} pagos · ${db.lotes.length} lotes · ${db.alertas.length} alertas · ${db.bitacora.length} actuaciones · ${db.auditoria.length} eventos de auditoría</dd></dl>
          <div class="acciones mt-2"><button class="btn btn-peligro" data-accion="reiniciar">Reiniciar demostración</button></div></div>
        <div class="tarjeta"><h3>Consideraciones para la implementación real</h3><ul class="small" style="padding-left:1.1rem;margin:0">
          <li>Este prototipo no tiene servidor: el control de acceso es simulado y los datos viven en el navegador.</li>
          <li>Una implementación institucional requiere autenticación real, cifrado en tránsito y en reposo, mínimo privilegio en el servidor y respaldo.</li>
          <li>Integraciones con SIGIP / PILA / operador financiero y con el gestor documental, sujetas a validación de la OTIC.</li>
          <li>Tratamiento de datos personales (Ley 1581 de 2012), tablas de retención documental y conservación.</li>
          <li>Validación jurídica de la obligatoriedad del cargue y del alcance de la población.</li></ul></div>
      </div>`;
  }
})();
