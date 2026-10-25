/* Módulo 3 · Calidad y estructuración
   Extracción, normalización, validación, duplicados y campos obligatorios de la información recibida. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store, R = S21.reglas;

  S21.vistas.m3 = {
    titulo: "Calidad y estructuración",
    render(el, params) {
      const conNomina = st.db.expedientes.filter((e) => e.nomina).sort((a, b) => (a.estado === "RECIBIDO" ? -1 : 0) - (b.estado === "RECIBIDO" ? -1 : 0) || b.nomina.cargado.localeCompare(a.nomina.cargado));
      const sel = params.exp ? st.expediente(params.exp) : null;
      const cola = conNomina.filter((e) => e.estado === "RECIBIDO");
      const cuenta = (e, n) => e.nomina.validacion.resultados.filter((r) => r.nivel === n).length;

      el.innerHTML = `
        ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 3" }], titulo: "Calidad y estructuración",
          descripcion: "Cada nómina cargada se lee, se normaliza (conceptos en mayúsculas sin tildes, periodos AAAA-MM, valores numéricos) y se valida con reglas versionadas antes del cruce." })}
        <div class="grid grid-4 mb-2">
          ${ui.kpi("Cola de validación", U.num(cola.length), "Radicados pendientes de validación funcional")}
          ${ui.kpi("Nóminas procesadas", U.num(conNomina.length))}
          ${ui.kpi("Con errores", U.num(conNomina.filter((e) => !e.nomina.validacion.ok).length))}
          ${ui.kpi("Registros leídos", U.num(U.sumar(conNomina, (e) => e.nomina.filas)))}
        </div>
        ${ui.tabla({
          columnas: [
            { t: "Expediente", v: (e) => `<a href="#/esap/expediente/${e.id}">${esc(e.id)}</a>` },
            { t: "Entidad", v: (e) => esc(st.entidad(e.entidadId).nombre) },
            { t: "Archivo", v: (e) => `${esc(e.nomina.archivo)}<div class="small muted">v${e.nomina.version} · ${U.fechaHora(e.nomina.cargado)}</div>` },
            { t: "Registros", num: true, v: (e) => U.num(e.nomina.filas) },
            { t: "Resultado", v: (e) => `${cuenta(e, "error") ? ui.chip(`${cuenta(e, "error")} error(es)`, "error") : ui.chip("Sin errores", "ok")} ${cuenta(e, "advertencia") ? ui.chip(`${cuenta(e, "advertencia")} advert.`, "alerta") : ""}` },
            { t: "Estado", v: (e) => ui.chipEstadoExp(e.estado) },
            { t: "", v: (e) => `<a class="btn btn-sm btn-sec" href="#/esap/m3?exp=${e.id}">Ver</a> ${e.estado === "RECIBIDO" ? `<button class="btn btn-sm" data-accion="validar" data-id="${e.id}" ${ui.sinPermiso("calidad.validar")}>Validar</button>` : ""}` },
          ],
          filas: conNomina,
        })}
        <div id="detalle" class="mt-3"></div>`;

      if (sel?.nomina) detalle(el.querySelector("#detalle"), sel);
      ui.on(el, { validar: (b) => S21.acciones.validarCalidad(st.expediente(b.dataset.id)) });
    },
  };

  function detalle(el, exp) {
    const n = exp.nomina;
    const conceptos = n.resumen.conceptos;
    el.innerHTML = `
      <div class="tarjeta mb-2">
        <div class="tarjeta-cab"><h3>Resultado de calidad · ${esc(exp.id)} · ${esc(st.entidad(exp.entidadId).nombre)}</h3>
          ${exp.estado === "RECIBIDO" ? `<button class="btn" data-accion="validar" data-id="${exp.id}" ${ui.sinPermiso("calidad.validar")}>Validación funcional</button>` : ""}</div>
        ${ui.tabla({ columnas: [
          { t: "Regla", v: (r) => `<span class="mono">${esc(r.regla)}</span>` },
          { t: "Resultado", v: (r) => ui.chip(r.nivel === "ok" ? "Correcto" : r.nivel === "error" ? "Error" : "Advertencia", r.nivel === "ok" ? "ok" : r.nivel === "error" ? "error" : "alerta") },
          { t: "Detalle", v: (r) => `${esc(r.mensaje)}${r.detalle.length ? `<div class="small muted">${r.detalle.map(esc).join("<br>")}</div>` : ""}` },
        ], filas: n.validacion.resultados })}
        ${exp.revisionCalidad ? `<p class="small muted mt-1 mb-0">Validación funcional: ${esc(exp.revisionCalidad.resultado)} por ${esc(exp.revisionCalidad.por)} el ${U.fechaHora(exp.revisionCalidad.fecha)}.</p>` : ""}
      </div>
      <div class="tarjeta">
        <h3>Estructuración: devengado por concepto y periodo</h3>
        <p class="small muted">Los conceptos marcados con ★ fueron declarados por la entidad como factor salarial y forman la base de liquidación.</p>
        <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Concepto</th>${exp.periodos.map((p) => `<th class="num">${U.periodo(p)}</th>`).join("")}<th class="num">Total</th></tr></thead>
        <tbody>${conceptos.map((c) => `<tr><td>${c.salarial ? "★ " : ""}${esc(c.nombre)}</td>${exp.periodos.map((p) => `<td class="num">${n.resumen.periodos[p]?.porConcepto[c.nombre] ? U.num(n.resumen.periodos[p].porConcepto[c.nombre]) : "—"}</td>`).join("")}<td class="num">${U.num(c.total)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Base salarial</td>${exp.periodos.map((p) => `<td class="num">${n.resumen.periodos[p] ? U.num(R.baseSalarial(n.resumen, p)) : "—"}</td>`).join("")}<td class="num">${U.num(U.sumar(exp.periodos, (p) => R.baseSalarial(n.resumen, p)))}</td></tr>
        <tr><td>Servidores</td>${exp.periodos.map((p) => `<td class="num">${n.resumen.periodos[p]?.empleados ?? "—"}</td>`).join("")}<td></td></tr></tfoot></table></div>
      </div>`;
  }
})();
