/* Módulo 2 · Recepción y carga controlada
   Registro de archivos, documentos, lotes y fechas de corte (de las entidades y de fuentes autorizadas). */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store;
  const estado = { tab: "lotes", origen: "", tipo: "", previa: null };

  const ETQ_TIPO = (t) => S21.cat.TIPOS_DOCUMENTO[t]?.txt || S21.cat.FUENTES_PAGO[t] || t;
  const CHIP_LOTE = { VALIDADO: "ok", RECIBIDO: "info", CON_ERRORES: "error", DUPLICADO: "alerta" };

  S21.vistas.m2 = {
    titulo: "Recepción y carga",
    render(el, params) {
      if (params.tab) estado.tab = params.tab;
      const lotes = st.db.lotes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 2" }], titulo: "Recepción y carga controlada",
          descripcion: "Registro de cada archivo recibido: quién lo cargó, cuándo, su huella digital (para detectar duplicados), su versión y la fecha de corte de la información." })}
        ${ui.pestanas("m2", [{ id: "lotes", txt: "Lotes y archivos", n: lotes.length }, { id: "fuente", txt: "Cargar fuente autorizada" }], estado.tab)}
        <div id="tab"></div>`;
      const t = el.querySelector("#tab");
      if (estado.tab === "lotes") tabLotes(t, lotes); else tabFuente(t);
      ui.on(el, {
        tab: (b) => { estado.tab = b.dataset.tab; S21.app.render(); },
        ...accionesFuente(),
      });
    },
  };

  function tabLotes(el, lotes) {
    const lista = lotes.filter((l) => (!estado.origen || l.origen === estado.origen) && (!estado.tipo || l.tipo === estado.tipo));
    const tipos = [...new Set(lotes.map((l) => l.tipo))];
    el.innerHTML = `
      <div class="grid grid-4 mb-2">
        ${ui.kpi("Archivos de entidades", U.num(lotes.filter((l) => l.origen === "ENTIDAD").length))}
        ${ui.kpi("Lotes institucionales", U.num(lotes.filter((l) => l.origen === "ESAP").length), "PILA, operador financiero, cargas controladas")}
        ${ui.kpi("Con errores", U.num(lotes.filter((l) => l.estado === "CON_ERRORES").length))}
        ${ui.kpi("Posibles duplicados", U.num(lotes.filter((l) => l.estado === "DUPLICADO").length), "Huella idéntica a otro archivo")}
      </div>
      <div class="filtros">
        <select id="f-origen" aria-label="Origen"><option value="">Todos los orígenes</option><option value="ENTIDAD" ${estado.origen === "ENTIDAD" ? "selected" : ""}>Entidad requerida</option><option value="ESAP" ${estado.origen === "ESAP" ? "selected" : ""}>Institucional (ESAP)</option></select>
        <select id="f-tipo" aria-label="Tipo"><option value="">Todos los tipos</option>${tipos.map((t) => `<option value="${t}" ${t === estado.tipo ? "selected" : ""}>${esc(ETQ_TIPO(t))}</option>`).join("")}</select>
        <span class="small muted">${lista.length} archivo(s)</span>
      </div>
      ${ui.tabla({
        columnas: [
          { t: "Lote", v: (l) => `<span class="mono small">${esc(l.id)}</span>` },
          { t: "Archivo", v: (l) => `${esc(l.nombre)}<div class="small muted">${esc(ETQ_TIPO(l.tipo))}${l.periodo ? " · " + U.periodo(l.periodo) : ""}</div>` },
          { t: "Expediente", v: (l) => (l.expedienteId ? `<a href="#/esap/expediente/${l.expedienteId}">${esc(l.expedienteId)}</a>` : ui.chip("Institucional", "info")) },
          { t: "Cargado", v: (l) => `${U.fechaHora(l.fecha)}<div class="small muted">${esc(l.cargadoPor)}</div>` },
          { t: "Corte", v: (l) => (l.corte ? U.periodo(l.corte.slice(0, 7)) : "—") },
          { t: "Versión", num: true, v: (l) => l.version },
          { t: "Registros", num: true, v: (l) => (l.filas != null ? U.num(l.filas) : "—") },
          { t: "Tamaño", num: true, v: (l) => U.tamano(l.tamano) },
          { t: "Huella", v: (l) => `<span class="mono tenue small" title="${esc(l.huella)}">${esc(String(l.huella).slice(0, 10))}…</span>` },
          { t: "Estado", v: (l) => ui.chip(l.estado.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), CHIP_LOTE[l.estado]) },
        ],
        filas: lista,
      })}`;
    el.querySelector("#f-origen").addEventListener("change", (e) => { estado.origen = e.target.value; S21.app.render(); });
    el.querySelector("#f-tipo").addEventListener("change", (e) => { estado.tipo = e.target.value; S21.app.render(); });
  }

  function tabFuente(el) {
    const p = estado.previa;
    el.innerHTML = `
      <div class="aviso"><p>Carga controlada de <b>fuentes autorizadas</b> (PILA tipo A/I, log del operador financiero u otra fuente aprobada) cuando la integración automática no está disponible.
      En la implementación real estas fuentes llegarían por integración con SIGIP / PILA y no por carga manual.</p></div>
      <div class="tarjeta mb-2">
        <div class="tarjeta-cab"><h3>Archivo de pagos</h3><button class="btn btn-sec btn-sm" data-accion="plantillaPagos">Descargar plantilla</button></div>
        ${S21.auth.puede("recepcion.cargar") ? ui.zonaCarga("archivo-pagos", "Seleccione el archivo de pagos", ".xlsx,.xls,.csv") : `<div class="aviso alerta"><p>Su rol no tiene permiso para cargar lotes.</p></div>`}
        <p class="small muted mt-1 mb-0">Columnas: FUENTE (PILA_A, PILA_I, LOG_FIN), NIT, PERIODO (AAAA-MM), PLANILLA, REFERENCIA, FECHA, VALOR. La plantilla trae un ejemplo con el NIT mal digitado del caso “pago sin asociación”.</p>
      </div>
      ${p ? `<div class="tarjeta">
        <div class="tarjeta-cab"><h3>Vista previa · ${esc(p.archivo)}</h3>${p.errores.length ? ui.chip(`${p.errores.length} fila(s) con error`, "error") : ui.chip("Sin errores", "ok")}</div>
        ${p.faltan.length ? `<div class="aviso error"><p>Faltan columnas: ${p.faltan.join(", ")}.</p></div>` : ""}
        ${p.errores.length ? `<div class="aviso alerta"><p>${p.errores.slice(0, 6).map(esc).join("<br>")}</p></div>` : ""}
        ${p.dup ? `<div class="aviso alerta"><p>Este archivo tiene la misma huella que el lote ${esc(p.dup.id)} (${esc(p.dup.nombre)}).</p></div>` : ""}
        ${ui.tabla({ columnas: [
          { t: "Fila", num: true, v: (x) => x._fila }, { t: "Fuente", v: (x) => esc(S21.cat.FUENTES_PAGO[x.fuente]) }, { t: "NIT", v: (x) => `<span class="mono">${esc(x.nit)}</span>` },
          { t: "Periodo", v: (x) => U.periodo(x.periodo) }, { t: "Referencia", v: (x) => esc(x.referencia) }, { t: "Fecha", v: (x) => esc(x.fecha) }, { t: "Valor", num: true, v: (x) => U.pesos(x.valor) },
        ], filas: p.pagos.slice(0, 50) })}
        <div class="acciones mt-2"><button class="btn" data-accion="confirmarPagos" ${p.validos.length ? "" : "disabled"}>Registrar ${p.validos.length} pago(s) válidos</button><button class="btn btn-txt" data-accion="descartarPagos">Descartar</button></div>
      </div>` : ""}`;
    ui.activarZonas(el, async (_id, file) => {
      try {
        const r = await S21.excel.leerPagos(file);
        const errores = [];
        const validos = r.pagos.filter((x) => {
          const e = [];
          if (!/^\d{9}$/.test(x.nit)) e.push("NIT inválido");
          if (!/^\d{4}-\d{2}$/.test(x.periodo)) e.push("periodo inválido");
          if (!(x.valor > 0)) e.push("valor inválido");
          if (e.length) errores.push(`Fila ${x._fila}: ${e.join(", ")}`);
          return !e.length;
        });
        estado.previa = { ...r, errores, validos, dup: st.db.lotes.find((l) => l.huella === r.huella) };
        S21.app.render();
      } catch (err) { ui.toast(`No fue posible leer el archivo: ${err.message}`, "error"); }
    });
  }

  function accionesFuente() {
    return {
      plantillaPagos: () => S21.excel.descargarPlantillaPagos(),
      descartarPagos: () => { estado.previa = null; S21.app.render(); },
      confirmarPagos() {
        const p = estado.previa;
        const loteId = `LOTE-MAN-${Date.now().toString(36).toUpperCase()}`;
        p.validos.forEach((x) => st.db.pagos.push({ id: U.uid("pag"), fuente: x.fuente, nit: x.nit, periodo: x.periodo, planilla: x.planilla, referencia: x.referencia,
          fecha: x.fecha, valor: x.valor, entidadId: null, estadoAsociacion: "PENDIENTE", metodoAsociacion: null, loteId }));
        st.db.lotes.push({ id: loteId, expedienteId: null, origen: "ESAP", tipo: "CARGA_MANUAL", nombre: p.archivo, tamano: p.tamano, huella: p.huella,
          fecha: U.ahora(), cargadoPor: S21.auth.actor().nombre, version: 1, estado: p.dup ? "DUPLICADO" : p.errores.length ? "CON_ERRORES" : "VALIDADO",
          filas: p.validos.length, corte: p.validos.map((x) => x.periodo).sort().pop() });
        if (p.dup) st.crearAlerta({ tipo: "POSIBLE_DUPLICADO", detalle: `El lote ${loteId} (${p.archivo}) repite el contenido del lote ${p.dup.id}.` });
        st.auditar("Carga controlada de fuente autorizada", loteId, `${p.validos.length} pagos · ${p.archivo}`);
        estado.previa = null;
        st.guardar();
        ui.toast(`${p.validos.length} pago(s) registrados. Ejecute la asociación en el módulo 4.`, "ok");
        S21.app.ir("#/esap/m4");
      },
    };
  }
})();
