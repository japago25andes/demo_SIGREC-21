/* Módulo 4 · Asociación y cruce
   Relación de pagos por entidad, NIT, periodo, planilla y referencia con las fuentes autorizadas. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store, R = S21.reglas;
  const estado = { tab: "gestion", q: "", fuente: "" };
  const ESTADOS = {
    ASOCIADO: ["Asociado", "ok"], PENDIENTE: ["Pendiente", "info"], SIN_ASOCIACION: ["Sin asociación", "error"],
    NIT_COMPARTIDO: ["NIT compartido", "alerta"], DUPLICADO: ["Posible duplicado", "alerta"], DUPLICADO_CONFIRMADO: ["Duplicado confirmado", ""],
  };

  S21.vistas.m4 = {
    titulo: "Asociación y cruce",
    render(el) {
      const pagos = st.db.pagos;
      const cuenta = (e) => pagos.filter((p) => p.estadoAsociacion === e).length;
      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 4" }], titulo: "Asociación y cruce",
          descripcion: "Cada pago de PILA y del operador financiero se relaciona con una entidad del maestro por NIT y periodo. Lo que no se puede asociar automáticamente queda como pendiente con alerta y responsable.",
          acciones: `<button class="btn" data-accion="asociar" ${ui.sinPermiso("cruce.asociar")}>Ejecutar asociación automática</button>` })}
        <div class="grid grid-4 mb-2">
          ${ui.kpi("Pagos asociados", U.num(cuenta("ASOCIADO")), `${U.pct(cuenta("ASOCIADO") / Math.max(1, pagos.length))} del total`)}
          ${ui.kpi("Sin asociación", U.num(cuenta("SIN_ASOCIACION")), "NIT que no existe en el maestro")}
          ${ui.kpi("NIT compartido", U.num(cuenta("NIT_COMPARTIDO")), "Requieren distribución manual")}
          ${ui.kpi("Posibles duplicados", U.num(cuenta("DUPLICADO")))}
        </div>
        ${ui.pestanas("m4", [{ id: "gestion", txt: "Pendientes de gestión", n: cuenta("SIN_ASOCIACION") + cuenta("NIT_COMPARTIDO") + cuenta("DUPLICADO") + cuenta("PENDIENTE") },
          { id: "todos", txt: "Todos los pagos", n: pagos.length }, { id: "cruce", txt: "Cruce por expediente" }], estado.tab)}
        <div id="tab"></div>`;
      const t = el.querySelector("#tab");
      if (estado.tab === "cruce") tabCruce(t); else tabPagos(t, estado.tab === "gestion");
      ui.on(el, {
        tab: (b) => { estado.tab = b.dataset.tab; S21.app.render(); },
        asociar() {
          const s = R.asociarPagos();
          st.auditar("Asociación automática", "Pagos", JSON.stringify(s));
          st.guardar();
          ui.toast(`Asociación: ${s.asociados} asociados, ${s.sinAsociacion} sin asociación, ${s.nitCompartido} NIT compartido, ${s.duplicados} duplicados.`, "ok");
          S21.app.render();
        },
        manual: (b) => asociarManual(st.db.pagos.find((p) => p.id === b.dataset.id)),
        duplicado: (b) => resolverDuplicado(st.db.pagos.find((p) => p.id === b.dataset.id)),
      });
    },
  };

  function tabPagos(el, soloGestion) {
    let lista = st.db.pagos.filter((p) => !soloGestion || ["SIN_ASOCIACION", "NIT_COMPARTIDO", "DUPLICADO", "PENDIENTE"].includes(p.estadoAsociacion));
    lista = lista.filter((p) => (!estado.q || (p.nit + " " + p.referencia + " " + (st.entidad(p.entidadId)?.nombre || "")).toUpperCase().includes(estado.q.toUpperCase())) && (!estado.fuente || p.fuente === estado.fuente))
      .sort((a, b) => a.estadoAsociacion.localeCompare(b.estadoAsociacion) || a.nit.localeCompare(b.nit) || a.periodo.localeCompare(b.periodo));
    const puede = S21.auth.puede("cruce.asociar");
    el.innerHTML = `
      <div class="filtros">
        <input type="search" id="f-q" placeholder="NIT, referencia o entidad" value="${esc(estado.q)}" aria-label="Buscar pago">
        <select id="f-fuente" aria-label="Fuente"><option value="">Todas las fuentes</option>${Object.entries(S21.cat.FUENTES_PAGO).map(([k, v]) => `<option value="${k}" ${k === estado.fuente ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
        <span class="small muted">${lista.length} pago(s)${lista.length > 200 ? " · se muestran 200" : ""}</span>
      </div>
      ${ui.tabla({
        columnas: [
          { t: "Referencia", v: (p) => `<span class="mono small">${esc(p.referencia)}</span><div class="small muted">Planilla ${esc(p.planilla)}</div>` },
          { t: "Fuente", v: (p) => `<span class="small">${esc(S21.cat.FUENTES_PAGO[p.fuente])}</span>` },
          { t: "NIT", v: (p) => `<span class="mono">${esc(p.nit)}</span>` },
          { t: "Periodo", v: (p) => U.periodo(p.periodo) },
          { t: "Fecha", v: (p) => U.fecha(p.fecha) },
          { t: "Valor", num: true, v: (p) => U.pesos(p.valor) },
          { t: "Entidad", v: (p) => (p.entidadId ? esc(st.entidad(p.entidadId)?.nombre) : '<span class="tenue">—</span>') },
          { t: "Estado", v: (p) => ui.chip(...ESTADOS[p.estadoAsociacion]) + (p.metodoAsociacion ? `<div class="small muted">${esc(p.metodoAsociacion)}</div>` : "") },
          { t: "", v: (p) => (["SIN_ASOCIACION", "NIT_COMPARTIDO"].includes(p.estadoAsociacion) ? `<button class="btn btn-sm" data-accion="manual" data-id="${p.id}" ${puede ? "" : "disabled"}>Asociar</button>`
            : p.estadoAsociacion === "DUPLICADO" ? `<button class="btn btn-sm btn-sec" data-accion="duplicado" data-id="${p.id}" ${puede ? "" : "disabled"}>Resolver</button>` : "") },
        ],
        filas: lista.slice(0, 200),
        vacio: soloGestion ? "No hay pagos pendientes de gestión. Ejecute la asociación automática si cargó nuevas fuentes." : "Sin pagos.",
      })}`;
    let t;
    el.querySelector("#f-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { estado.q = e.target.value; S21.app.render(); setTimeout(() => { const q = document.querySelector("#f-q"); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }, 0); }, 300); });
    el.querySelector("#f-fuente").addEventListener("change", (e) => { estado.fuente = e.target.value; S21.app.render(); });
  }

  /* Distancia de edición con transposiciones (errores típicos de digitación del NIT) */
  function distancia(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }
  /* Puntaje de sugerencia: NIT parecido y, a igualdad, entidad con requerimiento abierto sin pagos asociados */
  function puntaje(ent, p) {
    const abierto = st.expedientesDe(ent.id).some((x) => x.estado !== "CERRADO" && !st.pagosDeEntidad(ent.id, [p.periodo]).length);
    return distancia(ent.nit, p.nit) * 10 - (abierto ? 5 : 0);
  }

  function asociarManual(p) {
    const candidatas = p.estadoAsociacion === "NIT_COMPARTIDO" ? st.entidadesPorNit(p.nit)
      : st.db.entidades.slice().sort((a, b) => puntaje(a, p) - puntaje(b, p)).slice(0, 6);
    const mismos = st.db.pagos.filter((x) => x.nit === p.nit && x.estadoAsociacion === "SIN_ASOCIACION").length;
    ui.modal({
      titulo: `Asociar pago ${p.referencia}`,
      cuerpo: `
        <dl class="dl mb-2"><dt>NIT reportado</dt><dd class="mono">${esc(p.nit)}</dd><dt>Periodo</dt><dd>${U.periodo(p.periodo)}</dd><dt>Valor</dt><dd>${U.pesos(p.valor)}</dd>
          <dt>Fuente</dt><dd>${esc(S21.cat.FUENTES_PAGO[p.fuente])}</dd></dl>
        <div class="campo"><label for="am-e">Entidad ${p.estadoAsociacion === "NIT_COMPARTIDO" ? "que comparte el NIT" : "sugerida (NIT más parecido)"}</label>
          <select id="am-e">${candidatas.map((e) => `<option value="${e.id}">${esc(e.nombre)} · NIT ${esc(e.nit)}</option>`).join("")}</select></div>
        <div class="campo"><label for="am-m">Motivo y soporte <span class="req">*</span></label>
          <textarea id="am-m">${p.estadoAsociacion === "NIT_COMPARTIDO" ? "Distribución según certificación de nómina de la entidad." : "NIT mal digitado en la planilla; se verificó con el comprobante de pago del expediente."}</textarea></div>
        ${p.estadoAsociacion === "SIN_ASOCIACION" && mismos > 1 ? `<label class="small flex items-center gap-1 mb-1"><input type="checkbox" id="am-todos" checked> Asociar los ${mismos} pagos pendientes con el NIT ${esc(p.nit)}</label>` : ""}
        <p class="small muted mb-0">Si el pago tiene par en la otra fuente (misma planilla y periodo) también se asocia.</p>`,
      acciones: [{ txt: "Asociar", fn: (m) => {
        const motivo = m.querySelector("#am-m").value.trim();
        if (motivo.length < 10) { ui.toast("Indique el motivo.", "error"); return false; }
        const entidadId = m.querySelector("#am-e").value;
        const enBloque = m.querySelector("#am-todos")?.checked;
        const n = enBloque ? R.asociarNit(p.nit, entidadId, motivo) : (R.asociarManual(p, entidadId, motivo), 1);
        const exp = st.expedientesDe(entidadId).find((x) => x.estado !== "CERRADO");
        if (exp) st.bitacora(exp.id, enBloque ? "Pagos asociados manualmente en bloque" : "Pago asociado manualmente",
          enBloque ? `${n} registros con NIT ${p.nit}: ${motivo}` : `${p.referencia} (${U.periodo(p.periodo)}, ${U.pesos(p.valor)}): ${motivo}`);
        S21.acciones.refrescar();
        ui.toast(`${n} pago(s) asociado(s).`, "ok");
      } }],
    });
  }

  function resolverDuplicado(p) {
    ui.modal({
      titulo: `Posible duplicado · ${p.referencia}`,
      cuerpo: `<p>${esc(p.metodoAsociacion || "")}. NIT ${esc(p.nit)}, ${U.periodo(p.periodo)}, ${U.pesos(p.valor)}.</p><p class="small muted">Si se confirma, el registro se excluye del cruce. Si se descarta, vuelve a quedar pendiente de asociación.</p>`,
      acciones: [
        { txt: "No es duplicado", clase: "btn-sec", fn: () => { p.estadoAsociacion = "PENDIENTE"; p.metodoAsociacion = null; p.noDuplicado = true; cerrarAlertas(p, "DESCARTADA", "No corresponde a duplicado."); S21.acciones.refrescar(); } },
        { txt: "Confirmar duplicado", fn: () => { p.estadoAsociacion = "DUPLICADO_CONFIRMADO"; cerrarAlertas(p, "CONFIRMADA", "Duplicado confirmado; excluido del cruce."); S21.acciones.refrescar(); } },
      ],
    });
  }
  function cerrarAlertas(p, estadoAl, nota) {
    st.db.alertas.filter((a) => a.pagoId === p.id && ["ABIERTA", "EN_GESTION"].includes(a.estado)).forEach((a) => st.cambiarEstadoAlerta(a, estadoAl, nota));
    st.auditar("Resolución de duplicado", p.referencia, nota);
  }

  function tabCruce(el) {
    const exps = st.db.expedientes.filter((e) => e.nomina && e.estado !== "REQUERIDO");
    el.innerHTML = `<p class="small muted">Pagos asociados a la entidad de cada expediente, por periodo requerido (PILA reportado / recaudo del operador financiero).</p>
      ${ui.tabla({
        columnas: [
          { t: "Expediente", v: (e) => `<a href="#/esap/expediente/${e.id}">${esc(e.id)}</a><div class="small muted">${esc(st.entidad(e.entidadId).nombre)}</div>` },
          ...S21.seed.PERIODOS.map((per) => ({ t: U.periodo(per), num: true, v: (e) => {
            const ps = st.pagosDeEntidad(e.entidadId, [per]).filter((p) => p.estadoAsociacion === "ASOCIADO");
            const pila = U.sumar(ps.filter((p) => p.fuente.startsWith("PILA")), (p) => p.valor);
            const rec = U.sumar(ps.filter((p) => p.fuente === "LOG_FIN" || p.fuente === "CARGA_MANUAL"), (p) => p.valor);
            return ps.length ? `<span class="small">${U.num(pila)}<br><span class="muted">${U.num(rec)}</span></span>` : ui.chip("Sin pago", "error");
          } })),
          { t: "", v: (e) => `<a class="btn btn-sm btn-sec" href="#/esap/m5?exp=${e.id}">Conciliar</a>` },
        ],
        filas: exps,
      })}`;
  }
})();
