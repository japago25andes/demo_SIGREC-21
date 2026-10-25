/* Módulo 8 · Tablero e informes
   Pendientes, tiempos, diferencias, completitud, estados e información territorial.
   Incluye los indicadores definidos para la futura ejecución del piloto (Propuesta técnica, sección 14.2). */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store, R = S21.reglas;
  const filtro = { dt: "" };

  function indicadores(exps, alertas) {
    const cerrados = exps.filter((e) => e.estado === "CERRADO");
    const conConc = exps.filter((e) => e.conciliacion);
    const analizadas = alertas.filter((a) => ["CONFIRMADA", "DESCARTADA"].includes(a.estado) || (a.estado === "CERRADA" && a.historial.some((h) => ["CONFIRMADA", "DESCARTADA"].includes(h.estado))));
    const fueConf = (a) => a.estado === "CONFIRMADA" || a.historial.some((h) => h.estado === "CONFIRMADA");
    const tiempos = cerrados.map((e) => U.diasEntre(e.creado, e.cerrado));
    const filas = conConc.flatMap((e) => e.conciliacion.filas);
    const revisadas = filas.filter((f) => ["CONFIRMADA", "DESCARTADA"].includes(f.revision.estado));
    return {
      cerrados, conConc, tiempos,
      precision: revisadas.length ? revisadas.filter((f) => f.revision.estado === "CONFIRMADA").length / revisadas.length : null,
      trazabilidad: conConc.length ? conConc.filter((e) => R.trazabilidad(e).completa).length / conConc.length : null,
      tiempoProm: tiempos.length ? U.sumar(tiempos) / tiempos.length : null,
      confirmadas: analizadas.length ? analizadas.filter(fueConf).length / analizadas.length : null,
      descartadas: analizadas.length ? analizadas.filter((a) => !fueConf(a)).length / analizadas.length : null,
      analizadas: analizadas.length,
      reprocesos: exps.length ? exps.filter((e) => (e.reprocesos || 0) > 0).length / exps.length : null,
    };
  }

  S21.vistas.m8 = {
    titulo: "Tablero e informes",
    render(el) {
      const u = S21.auth.usuarioActual();
      if (filtro.dt === "" && u.rol === "apoyo") filtro.dt = u.dt;
      const exps = st.db.expedientes.filter((e) => !filtro.dt || e.dt === filtro.dt);
      const ids = new Set(exps.map((e) => e.id));
      const alertas = st.db.alertas.filter((a) => !filtro.dt || ids.has(a.expedienteId));
      const abiertos = exps.filter((e) => e.estado !== "CERRADO");
      const ind = indicadores(exps, alertas);
      const aFavor = U.sumar(exps.filter((e) => e.conciliacion), (e) => U.sumar(e.conciliacion.filas.filter((f) => f.revision.estado === "CONFIRMADA" && f.diferencia > 0), (f) => f.diferencia));
      const porEstado = Object.entries(S21.cat.ESTADOS_EXPEDIENTE).map(([k, v]) => ({ etq: v.txt, valor: exps.filter((e) => e.estado === k).length, clase: v.chip === "ok" ? "ok" : v.chip === "error" ? "error" : v.chip === "alerta" ? "alerta" : "" }));
      const dts = [...new Set(st.db.expedientes.map((e) => e.dt))].sort();
      const porDt = dts.filter((d) => !filtro.dt || d === filtro.dt).map((d) => {
        const xs = st.db.expedientes.filter((e) => e.dt === d);
        return { dt: d, total: xs.length, abiertos: xs.filter((e) => e.estado !== "CERRADO").length, conDif: xs.filter((e) => e.estado === "CON_DIFERENCIA" || e.estado === "MESA_TECNICA").length,
          cerrados: xs.filter((e) => e.estado === "CERRADO").length, favor: U.sumar(xs.filter((e) => e.conciliacion), (e) => e.conciliacion.totales.aFavorEsap) };
      });
      const porResp = st.db.usuarios.map((x) => ({ etq: x.nombre.split(" ").slice(0, 2).join(" "), valor: abiertos.filter((e) => e.responsableId === x.id).length })).filter((x) => x.valor > 0);
      const sinResp = abiertos.filter((e) => !e.responsableId).length;
      if (sinResp) porResp.push({ etq: "Sin asignar", valor: sinResp, clase: "error" });

      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 8" }], titulo: "Tablero e informes",
          descripcion: "Seguimiento para la Dirección Financiera, el Grupo de Recaudo y Cartera y las Direcciones Territoriales. Se actualiza con cada actuación registrada.",
          acciones: `<select id="f-dt" aria-label="Dirección territorial" style="width:auto"><option value="">Todas las direcciones territoriales</option>${dts.map((d) => `<option ${d === filtro.dt ? "selected" : ""}>${esc(d)}</option>`).join("")}</select>
            <button class="btn btn-sec" data-accion="exportar">Exportar informe consolidado</button>` })}
        <div class="grid grid-4 mb-2">
          ${ui.kpi("Expedientes abiertos", U.num(abiertos.length), `${exps.length} en total · ${ind.cerrados.length} cerrados`)}
          ${ui.kpi("Diferencias confirmadas", U.pesos(aFavor), "A favor de la ESAP, tras revisión humana")}
          ${ui.kpi("Tiempo promedio por caso", ind.tiempoProm == null ? "No aplica" : `${ind.tiempoProm.toFixed(1).replace(".", ",")} días`, "Desde el requerimiento hasta el cierre")}
          ${ui.kpi("Trazabilidad completa", U.pct(ind.trazabilidad, 0), "Fuente, responsable, soporte, regla y decisión")}
        </div>
        <div class="grid grid-2 mb-2">
          <div class="tarjeta"><h3>Expedientes por estado</h3>${ui.barras(porEstado)}</div>
          <div class="tarjeta"><h3>Pendientes por responsable</h3>${porResp.length ? ui.barras(porResp) : '<p class="muted">Sin pendientes.</p>'}</div>
        </div>
        <div class="tarjeta mb-2">
          <h3>Información territorial</h3>
          ${ui.tabla({ columnas: [
            { t: "Dirección territorial", v: (d) => `<b>${esc(d.dt)}</b>` },
            { t: "Expedientes", num: true, v: (d) => d.total }, { t: "Abiertos", num: true, v: (d) => d.abiertos },
            { t: "Con diferencias / mesa", num: true, v: (d) => d.conDif }, { t: "Cerrados", num: true, v: (d) => d.cerrados },
            { t: "Diferencia a favor (conciliación)", num: true, v: (d) => U.pesos(d.favor) },
          ], filas: porDt })}
        </div>
        <div class="tarjeta">
          <h3>Indicadores para la evaluación del piloto (sección 14.2)</h3>
          <p class="small muted">Calculados con los datos de demostración. Si el denominador es cero, el indicador se reporta como “No aplica”.</p>
          ${ui.tabla({ columnas: [
            { t: "Indicador", v: (i) => `<b>${esc(i.n)}</b>` }, { t: "Fórmula", v: (i) => `<span class="small">${esc(i.f)}</span>` }, { t: "Valor", num: true, v: (i) => `<b>${i.v}</b>` },
          ], filas: [
            { n: "Precisión de validaciones y asociaciones", f: "Diferencias confirmadas / diferencias revisadas × 100 (proxy en la demo)", v: U.pct(ind.precision) },
            { n: "Trazabilidad completa", f: "Casos con fuente, responsable, soporte, regla y decisión / casos conciliados × 100", v: U.pct(ind.trazabilidad) },
            { n: "Tiempo de procesamiento", f: "Promedio (fecha de cierre − fecha de requerimiento)", v: ind.tiempoProm == null ? "No aplica" : `${ind.tiempoProm.toFixed(1).replace(".", ",")} días` },
            { n: "Alertas confirmadas", f: "Alertas confirmadas / alertas analizadas × 100", v: `${U.pct(ind.confirmadas)} <span class="small muted">(${ind.analizadas})</span>` },
            { n: "Alertas descartadas", f: "Alertas descartadas con justificación / alertas analizadas × 100", v: U.pct(ind.descartadas) },
            { n: "Reprocesos", f: "Casos devueltos o con nueva carga / casos evaluados × 100", v: U.pct(ind.reprocesos) },
            { n: "Reducción del tiempo de revisión", f: "(Línea base − tiempo con prototipo) / línea base × 100", v: '<span class="small muted">Requiere línea base del piloto</span>' },
            { n: "Facilidad de uso", f: "Promedio de valoraciones (1 a 5)", v: '<span class="small muted">Se mide con encuesta en el piloto</span>' },
          ] })}
        </div>`;

      el.querySelector("#f-dt").addEventListener("change", (e) => { filtro.dt = e.target.value; S21.app.render(); });
      ui.on(el, {
        exportar() {
          S21.excel.exportar(`informe_consolidado_SIGREC21${filtro.dt ? "_" + filtro.dt.replace(/\s/g, "_") : ""}.xlsx`,
            ["Expediente", "Entidad", "NIT", "DT", "Estado", "Responsable", "Requerido", "Plazo", "Radicado", "Esperado", "Recaudado", "Diferencia a favor", "Material", "Resultado", "Cierre", "Trazabilidad completa", "Reprocesos"],
            exps.map((e) => { const ent = st.entidad(e.entidadId); const c = e.conciliacion?.totales;
              return [e.id, ent.nombre, ent.nit, e.dt, S21.cat.ESTADOS_EXPEDIENTE[e.estado].txt, st.usuario(e.responsableId)?.nombre || "", U.fecha(e.fechaRequerimiento), U.fecha(e.fechaLimite),
                e.radicado ? U.fecha(e.radicado.fecha) : "", c?.esperado ?? "", c?.recaudado ?? "", c?.aFavorEsap ?? "", c ? (c.material ? "SI" : "NO") : "",
                e.resultado ? S21.cat.RESULTADOS[e.resultado.tipo] : "", e.cerrado ? U.fecha(e.cerrado) : "", R.trazabilidad(e).completa ? "SI" : "NO", e.reprocesos || 0]; }));
          st.auditar("Exportación", "Informe consolidado", `${exps.length} expedientes${filtro.dt ? " · DT " + filtro.dt : ""}`);
          st.guardar();
        },
      });
    },
  };
})();
