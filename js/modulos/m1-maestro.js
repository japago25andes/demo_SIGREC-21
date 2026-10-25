/* Módulo 1 · Maestro de entidades aportantes
   Identificación y datos de referencia, sin sustituir los mecanismos oficiales de actualización. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store;
  const filtro = { q: "", tipo: "", dt: "" };

  S21.vistas.m1 = {
    titulo: "Maestro de entidades",
    render(el) {
      const db = st.db;
      const lista = db.entidades.filter((e) =>
        (!filtro.q || U.normalizar(e.nombre + " " + e.nit).includes(U.normalizar(filtro.q))) &&
        (!filtro.tipo || e.tipo === filtro.tipo) && (!filtro.dt || e.dt === filtro.dt));

      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 1" }], titulo: "Maestro de entidades aportantes",
          descripcion: "Identificación y datos de referencia de las entidades. Los datos del representante y del responsable los registra la propia entidad al atender el requerimiento.",
          acciones: `<button class="btn btn-sec" data-accion="exportar">Exportar</button><button class="btn" data-accion="nueva" ${ui.sinPermiso("entidades.editar")}>Nueva entidad</button>` })}
        <div class="aviso"><p>Este maestro <b>no sustituye</b> los mecanismos oficiales de actualización de la base de aportantes (SISPRO-PISIS). Aportantes Ley 21: Nación, departamentos, distritos, municipios y Fuerza Pública (art. 8).</p></div>
        <div class="filtros">
          <input type="search" id="f-q" placeholder="Buscar por nombre o NIT" value="${esc(filtro.q)}" aria-label="Buscar entidad">
          <select id="f-tipo" aria-label="Tipo de entidad"><option value="">Todos los tipos</option>${S21.cat.TIPOS_ENTIDAD.map((t) => `<option ${t === filtro.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
          <select id="f-dt" aria-label="Dirección territorial"><option value="">Todas las direcciones territoriales</option>${S21.cat.DIRECCIONES_TERRITORIALES.map((t) => `<option ${t === filtro.dt ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
          <span class="small muted">${lista.length} de ${db.entidades.length}</span>
        </div>
        ${ui.tabla({
          columnas: [
            { t: "Entidad", v: (e) => `<b>${esc(e.nombre)}</b><div class="small muted">${esc(e.departamento)}</div>` },
            { t: "NIT", v: (e) => `<span class="mono">${esc(e.nit)}-${esc(e.dv)}</span>${e.nitCompartido ? "<br>" + ui.chip("NIT compartido", "alerta") : ""}` },
            { t: "Tipo", v: (e) => esc(e.tipo) },
            { t: "Dir. territorial", v: (e) => esc(e.dt) },
            { t: "Responsable de la información", v: (e) => (e.responsable?.nombre ? `${esc(e.responsable.nombre)}<div class="small muted">${esc(e.responsable.correo)}</div>` : '<span class="tenue small">Sin registrar</span>') },
            { t: "Expediente", v: (e) => { const x = st.expedientesDe(e.id).sort((a, b) => b.creado.localeCompare(a.creado))[0]; return x ? `<a href="#/esap/expediente/${x.id}">${esc(x.id)}</a><br>${ui.chipEstadoExp(x.estado)}` : '<span class="tenue small">—</span>'; } },
          ],
          filas: lista, clic: (e) => e.id,
        })}`;

      const refiltrar = () => { filtro.q = el.querySelector("#f-q").value; filtro.tipo = el.querySelector("#f-tipo").value; filtro.dt = el.querySelector("#f-dt").value; S21.app.render(); setTimeout(() => { const q = document.querySelector("#f-q"); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }, 0); };
      el.querySelector("#f-q").addEventListener("input", debounce(refiltrar, 300));
      el.querySelector("#f-tipo").addEventListener("change", refiltrar);
      el.querySelector("#f-dt").addEventListener("change", refiltrar);

      ui.on(el, {
        fila: (id) => detalle(st.entidad(id)),
        nueva: () => editar(null),
        exportar: () => {
          S21.excel.exportar("maestro_entidades_SIGREC21.xlsx", ["NIT", "DV", "Entidad", "Tipo", "Departamento", "Dir. territorial", "Representante", "Responsable", "Correo", "NIT compartido"],
            lista.map((e) => [e.nit, e.dv, e.nombre, e.tipo, e.departamento, e.dt, e.representante?.nombre || "", e.responsable?.nombre || "", e.responsable?.correo || "", e.nitCompartido ? "SI" : "NO"]));
          st.auditar("Exportación", "Maestro de entidades", `${lista.length} registros`);
          st.guardar();
        },
      });
    },
  };

  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

  function detalle(e) {
    const exps = st.expedientesDe(e.id);
    const comparten = e.nitCompartido ? st.entidadesPorNit(e.nit).filter((x) => x.id !== e.id) : [];
    const insumo = st.db.insumoSigip.find((i) => i.entidadId === e.id && i.estado === "PENDIENTE");
    const abierto = exps.some((x) => x.estado !== "CERRADO");
    ui.modal({
      titulo: e.nombre,
      ancho: true,
      cuerpo: `
        <div class="grid grid-2">
          <div><h4>Identificación</h4><dl class="dl">
            <dt>NIT</dt><dd class="mono">${esc(e.nit)}-${esc(e.dv)}</dd><dt>Tipo</dt><dd>${esc(e.tipo)}</dd>
            <dt>Departamento</dt><dd>${esc(e.departamento)}</dd><dt>Dirección territorial</dt><dd>${esc(e.dt)}</dd>
            <dt>Estado</dt><dd>${esc(e.estado)}</dd><dt>Fuente</dt><dd class="small">${esc(e.fuenteDatos)}</dd></dl></div>
          <div><h4>Registrado por la entidad</h4><dl class="dl">
            <dt>Representante</dt><dd>${esc(e.representante?.nombre || "—")} ${e.representante?.cargo ? `<div class="small muted">${esc(e.representante.cargo)}</div>` : ""}</dd>
            <dt>Responsable</dt><dd>${esc(e.responsable?.nombre || "—")} ${e.responsable?.correo ? `<div class="small muted">${esc(e.responsable.correo)} · ${esc(e.responsable.telefono)}</div>` : ""}</dd>
            <dt>Actualizado</dt><dd>${U.fechaHora(e.actualizado)}</dd></dl></div>
        </div>
        ${comparten.length ? `<div class="aviso alerta mt-2"><p><b>NIT compartido</b> con: ${comparten.map((x) => esc(x.nombre)).join("; ")}. Los pagos sobre este NIT requieren distribución manual (módulo 4) y el requerimiento puede dirigirse a varias entidades.</p></div>` : ""}
        ${insumo ? `<div class="aviso mt-2"><p><b>Insumo SIGIP pendiente:</b> ${esc(insumo.tipo)} · ${esc(insumo.descripcion)}</p></div>` : ""}
        <h4 class="mt-2">Expedientes</h4>
        ${ui.tabla({ columnas: [
          { t: "Expediente", v: (x) => `<a href="#/esap/expediente/${x.id}">${esc(x.id)}</a>` },
          { t: "Creado", v: (x) => U.fecha(x.creado) },
          { t: "Estado", v: (x) => ui.chipEstadoExp(x.estado) },
          { t: "Resultado", v: (x) => (x.resultado ? esc(S21.cat.RESULTADOS[x.resultado.tipo]) : "—") },
        ], filas: exps, vacio: "La entidad no tiene expedientes." })}`,
      acciones: [
        { txt: "Editar", clase: "btn-sec", fn: () => { if (!S21.auth.puede("entidades.editar")) { ui.toast("Su rol no puede editar el maestro.", "error"); return false; } setTimeout(() => editar(e), 0); } },
        ...(!abierto ? [{ txt: "Generar requerimiento", fn: () => { if (!S21.auth.puede("requerimiento.crear")) { ui.toast("Su rol no puede generar requerimientos.", "error"); return false; } setTimeout(() => S21.acciones.crearRequerimiento(e.id, insumo?.id), 0); } }] : []),
      ],
    });
  }

  function editar(e) {
    const nueva = !e;
    const d = e || { nombre: "", nit: "", tipo: "Municipio", dt: "Sede Central", departamento: "" };
    ui.modal({
      titulo: nueva ? "Nueva entidad aportante" : `Editar · ${d.nombre}`,
      cuerpo: `
        <div class="campo"><label for="ed-n">Nombre <span class="req">*</span></label><input id="ed-n" type="text" value="${esc(d.nombre)}"></div>
        <div class="grid grid-2">
          <div class="campo"><label for="ed-nit">NIT (sin DV) <span class="req">*</span></label><input id="ed-nit" type="text" value="${esc(d.nit)}" ${nueva ? "" : "readonly"}></div>
          <div class="campo"><label for="ed-dep">Departamento</label><input id="ed-dep" type="text" value="${esc(d.departamento)}"></div>
          <div class="campo"><label for="ed-t">Tipo</label><select id="ed-t">${S21.cat.TIPOS_ENTIDAD.map((t) => `<option ${t === d.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
          <div class="campo"><label for="ed-dt">Dirección territorial</label><select id="ed-dt">${S21.cat.DIRECCIONES_TERRITORIALES.map((t) => `<option ${t === d.dt ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
        </div>
        <span class="err small" id="ed-err" style="color:var(--error)"></span>`,
      acciones: [{ txt: "Guardar", fn: (m) => {
        const v = (id) => m.querySelector(id).value.trim();
        const nit = v("#ed-nit").replace(/\D/g, "");
        if (!v("#ed-n") || !/^\d{9}$/.test(nit)) { m.querySelector("#ed-err").textContent = "Nombre obligatorio y NIT de 9 dígitos."; return false; }
        const datos = { nombre: v("#ed-n"), departamento: v("#ed-dep"), tipo: v("#ed-t"), dt: v("#ed-dt") };
        if (nueva) {
          const comparte = st.entidadesPorNit(nit);
          const ent = { id: U.uid("E"), ...datos, nit, dv: String((Number(nit.slice(-3)) * 7) % 10), estado: "Activa", representante: {}, responsable: {},
            fuenteDatos: "Registro manual en SIGREC-21", actualizado: U.ahora(), nitCompartido: comparte.length > 0 };
          comparte.forEach((x) => (x.nitCompartido = true));
          st.db.entidades.push(ent);
          st.auditar("Creación de entidad", ent.nombre, `NIT ${nit}`);
          // Pagos pendientes con ese NIT pueden asociarse ahora
          st.db.pagos.filter((p) => p.nit === nit && p.estadoAsociacion === "SIN_ASOCIACION").forEach((p) => (p.estadoAsociacion = "PENDIENTE"));
        } else {
          const antes = `${e.nombre} · ${e.tipo} · ${e.dt}`;
          Object.assign(e, datos, { actualizado: U.ahora() });
          st.auditar("Edición de entidad", e.nombre, `Antes: ${antes}`);
        }
        S21.acciones.refrescar();
        ui.toast("Entidad guardada.", "ok");
      } }],
    });
  }
})();
