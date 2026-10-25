/* Módulo 5 · Conciliación y diferencias
   Comparación de valores (aporte esperado vs. reportado vs. recaudado), clasificación, observaciones y revisión funcional. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store, R = S21.reglas;

  /* Tabla de conciliación reutilizada en el expediente (módulo 7) */
  S21.comp = S21.comp || {};
  S21.comp.tablaConciliacion = function (exp, { acciones = true } = {}) {
    const c = exp.conciliacion;
    if (!c) return `<p class="muted">Aún no se ha ejecutado la conciliación.</p>`;
    const puede = S21.auth.puede("diferencia.revisar") && exp.estado !== "CERRADO";
    return `
      ${ui.tabla({
        columnas: [
          { t: "Periodo", v: (f) => `<b>${U.periodo(f.periodo)}</b><div class="small muted">${f.empleados} servidores</div>` },
          { t: "Base salarial", num: true, v: (f) => U.pesos(f.base) },
          { t: "Esperado 0,5 %", num: true, v: (f) => U.pesos(f.esperado) },
          { t: "Reportado PILA", num: true, v: (f) => U.pesos(f.reportado) },
          { t: "Recaudado", num: true, v: (f) => `${U.pesos(f.recaudado)}<div class="small muted">${f.fechaPago ? U.fecha(f.fechaPago) : "sin pago"} · límite ${U.fecha(f.limite)}</div>` },
          { t: "Diferencia", num: true, v: (f) => `<b style="color:${f.diferencia > st.param("R03") ? "var(--error)" : f.diferencia < -st.param("R03") ? "var(--info)" : "inherit"}">${U.pesos(f.diferencia)}</b>${f.diasMora > 0 ? `<div class="small muted">${f.diasMora} días después del límite</div>` : ""}` },
          { t: "Clasificación (indicio)", v: (f) => `${ui.chipClasif(f.clasificacion)}<div class="small muted">${esc(R.CLASIFICACION[f.clasificacion].indicio)}</div>` },
          { t: "Revisión humana", v: (f) => `${ui.chipRevision(f.revision)}${f.revision.nota ? `<div class="small muted" title="${esc(f.revision.nota)}">${esc(f.revision.por)}: ${esc(f.revision.nota.slice(0, 70))}${f.revision.nota.length > 70 ? "…" : ""}</div>` : ""}
            ${acciones && puede && f.revision.estado === "PENDIENTE" ? `<div class="acciones mt-1"><button class="btn btn-sm" data-accion="confirmarDif" data-exp="${exp.id}" data-per="${f.periodo}">Confirmar</button><button class="btn btn-sm btn-sec" data-accion="descartarDif" data-exp="${exp.id}" data-per="${f.periodo}">Descartar</button></div>` : ""}` },
        ],
        filas: c.filas,
        pie: `<td>Total</td><td class="num">${U.pesos(c.totales.base)}</td><td class="num">${U.pesos(c.totales.esperado)}</td><td class="num">${U.pesos(c.totales.reportado)}</td><td class="num">${U.pesos(c.totales.recaudado)}</td><td class="num">${U.pesos(c.totales.diferencia)}</td><td colspan="2">A favor ESAP: <b>${U.pesos(c.totales.aFavorEsap)}</b> ${c.totales.material ? ui.chip("Diferencia material", "error") : ""}</td>`,
      })}
      <p class="small muted mt-1 mb-0">Ejecutada el ${U.fechaHora(c.fecha)} por ${esc(c.por)} · reglas ${c.reglas.map(esc).join(", ")}. Las clasificaciones son indicios; no determinan por sí mismas mora, omisión, inexactitud ni deuda.</p>`;
  };

  S21.comp.accionesConciliacion = {
    confirmarDif: (b) => S21.acciones.revisarFila(st.expediente(b.dataset.exp), b.dataset.per, "CONFIRMADA"),
    descartarDif: (b) => S21.acciones.revisarFila(st.expediente(b.dataset.exp), b.dataset.per, "DESCARTADA"),
  };

  S21.vistas.m5 = {
    titulo: "Conciliación y diferencias",
    render(el, params) {
      const candidatos = st.db.expedientes.filter((e) => ["EN_ANALISIS", "CON_DIFERENCIA", "CONCILIADO", "MESA_TECNICA", "CERRADO"].includes(e.estado) && e.nomina);
      const sel = params.exp ? st.expediente(params.exp) : candidatos.find((e) => e.estado === "EN_ANALISIS") || candidatos.find((e) => e.estado === "CON_DIFERENCIA");
      const filasTodas = candidatos.flatMap((e) => (e.conciliacion?.filas || []).map((f) => ({ ...f, exp: e })));
      const porClas = Object.keys(R.CLASIFICACION).map((k) => ({ etq: R.CLASIFICACION[k].txt, valor: filasTodas.filter((f) => f.clasificacion === k).length, clase: k === "CONCILIADO" ? "ok" : k === "MAYOR_VALOR" ? "" : k === "PAGO_EXTEMPORANEO" ? "alerta" : "error" }));

      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 5" }], titulo: "Conciliación y diferencias",
          descripcion: `Aporte esperado = base de factores salariales × ${String(st.param("R01") * 100).replace(".", ",")} % (aproximado a la centena superior). Se compara con lo reportado en PILA y lo recaudado por el operador financiero. Tolerancia ${U.pesos(st.param("R03"))}.` })}
        <div class="grid grid-2 mb-2">
          <div class="tarjeta"><h3>Periodos conciliados por clasificación</h3>${ui.barras(porClas)}</div>
          <div class="tarjeta"><h3>Revisión humana pendiente</h3>
            ${ui.tabla({ columnas: [
              { t: "Expediente", v: (f) => `<a href="#/esap/m5?exp=${f.exp.id}">${esc(f.exp.id)}</a>` },
              { t: "Periodo", v: (f) => U.periodo(f.periodo) },
              { t: "Clasificación", v: (f) => ui.chipClasif(f.clasificacion) },
              { t: "Diferencia", num: true, v: (f) => U.pesos(f.diferencia) },
            ], filas: filasTodas.filter((f) => f.revision.estado === "PENDIENTE").slice(0, 8), vacio: "No hay diferencias pendientes de revisión." })}
          </div>
        </div>
        <div class="tarjeta">
          <div class="tarjeta-cab">
            <div class="flex items-center gap-1 wrap"><label for="sel-exp" class="small"><b>Expediente</b></label>
              <select id="sel-exp" style="width:auto">${candidatos.map((e) => `<option value="${e.id}" ${e === sel ? "selected" : ""}>${esc(e.id)} · ${esc(st.entidad(e.entidadId).nombre)} · ${esc(S21.cat.ESTADOS_EXPEDIENTE[e.estado].txt)}</option>`).join("")}</select></div>
            ${sel && sel.estado !== "CERRADO" && sel.estado !== "MESA_TECNICA" ? `<button class="btn" data-accion="conciliar" ${ui.sinPermiso("conciliacion.ejecutar")}>${sel.conciliacion ? "Volver a conciliar" : "Ejecutar conciliación"}</button>` : ""}
          </div>
          ${sel ? `${sel.estado === "EN_ANALISIS" && !sel.conciliacion ? `<div class="aviso"><p>La calidad de la nómina fue aprobada. Ejecute la conciliación para comparar el aporte esperado con los pagos asociados.</p></div>` : ""}
            ${S21.comp.tablaConciliacion(sel)}
            <div class="acciones mt-2"><a class="btn btn-sec" href="#/esap/expediente/${sel.id}">Abrir expediente</a></div>` : '<p class="muted">No hay expedientes listos para conciliar.</p>'}
        </div>`;

      el.querySelector("#sel-exp")?.addEventListener("change", (e) => S21.app.ir(`#/esap/m5?exp=${e.target.value}`));
      ui.on(el, { conciliar: () => S21.acciones.conciliar(sel), ...S21.comp.accionesConciliacion });
    },
  };
})();
