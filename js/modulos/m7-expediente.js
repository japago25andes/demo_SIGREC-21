/* Módulo 7 · Expediente de seguimiento
   Bitácora y referencias a soportes institucionales, sin sustituir el expediente oficial. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store, R = S21.reglas, A = () => S21.acciones;
  const filtro = { q: "", estado: "", dt: "" };
  const pestana = { actual: "resumen" };

  S21.vistas.m7 = {
    titulo: "Expedientes",
    render(el, params) {
      if (params.id) return detalle(el, st.expediente(params.id), params);
      lista(el);
    },
  };

  /* ---------- Listado ---------- */
  function lista(el) {
    const exps = st.db.expedientes.filter((e) => {
      const ent = st.entidad(e.entidadId);
      return (!filtro.q || U.normalizar(`${e.id} ${ent.nombre} ${ent.nit}`).includes(U.normalizar(filtro.q))) &&
        (!filtro.estado || e.estado === filtro.estado) && (!filtro.dt || e.dt === filtro.dt);
    }).sort((a, b) => S21.cat.ESTADOS_EXPEDIENTE[a.estado].orden - S21.cat.ESTADOS_EXPEDIENTE[b.estado].orden || b.creado.localeCompare(a.creado));
    el.innerHTML = `
      ${ui.cabecera({ migas: [{ txt: "Consola" }, { txt: "Módulo 7" }], titulo: "Expedientes de seguimiento",
        descripcion: "Cada expediente reúne los cinco elementos de la trazabilidad: insumo SIGIP, requerimiento, información de la entidad, análisis y conciliación, y resultado. Referencia el expediente administrativo oficial sin sustituirlo." })}
      <div class="filtros">
        <input type="search" id="f-q" placeholder="Expediente, entidad o NIT" value="${esc(filtro.q)}" aria-label="Buscar expediente">
        <select id="f-est" aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(S21.cat.ESTADOS_EXPEDIENTE).map(([k, v]) => `<option value="${k}" ${k === filtro.estado ? "selected" : ""}>${esc(v.txt)}</option>`).join("")}</select>
        <select id="f-dt" aria-label="Dirección territorial"><option value="">Todas las DT</option>${S21.cat.DIRECCIONES_TERRITORIALES.map((t) => `<option ${t === filtro.dt ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <span class="small muted">${exps.length} expediente(s)</span>
      </div>
      ${ui.tabla({
        columnas: [
          { t: "Expediente", v: (e) => `<b>${esc(e.id)}</b><div class="small muted">${esc(e.casoReferencia || "")}</div>` },
          { t: "Entidad", v: (e) => `${esc(st.entidad(e.entidadId).nombre)}<div class="small muted">DT ${esc(e.dt)}</div>` },
          { t: "Requerido", v: (e) => `${U.fecha(e.fechaRequerimiento)}<div class="small muted">Plazo ${U.fecha(e.fechaLimite)}</div>` },
          { t: "Responsable", v: (e) => (e.responsableId ? esc(st.usuario(e.responsableId).nombre) : ui.chip("Sin asignar", "alerta")) },
          { t: "Diferencia a favor", num: true, v: (e) => (e.conciliacion ? U.pesos(e.conciliacion.totales.aFavorEsap) : "—") },
          { t: "Estado", v: (e) => ui.chipEstadoExp(e.estado) + (e.resultado ? `<div class="small muted">${esc(S21.cat.RESULTADOS[e.resultado.tipo].split("·")[0])}</div>` : "") },
        ],
        filas: exps, clic: (e) => e.id,
      })}`;
    let t;
    el.querySelector("#f-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { filtro.q = e.target.value; S21.app.render(); setTimeout(() => { const q = document.querySelector("#f-q"); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }, 0); }, 300); });
    el.querySelector("#f-est").addEventListener("change", (e) => { filtro.estado = e.target.value; S21.app.render(); });
    el.querySelector("#f-dt").addEventListener("change", (e) => { filtro.dt = e.target.value; S21.app.render(); });
    ui.on(el, { fila: (id) => S21.app.ir(`#/esap/expediente/${id}`) });
  }

  /* ---------- Siguiente paso según estado y rol ---------- */
  function siguientePaso(exp) {
    const c = exp.conciliacion;
    const pend = (c?.filas || []).filter((f) => f.revision.estado === "PENDIENTE").length;
    const p = (perm) => S21.auth.puede(perm);
    switch (exp.estado) {
      case "REQUERIDO": return { txt: "Esperando que la entidad ingrese con la credencial temporal.", btn: `<button class="btn btn-sec" data-accion="verRequerimiento">Ver requerimiento y credencial</button>` };
      case "EN_CARGUE": return { txt: "La entidad está registrando información. Se notificará cuando radique.", btn: `<button class="btn btn-sec" data-accion="verRequerimiento">Ver requerimiento</button>` };
      case "RECIBIDO": return { txt: "La entidad radicó. Corresponde la validación funcional de calidad (validador o gestor).", btn: `<button class="btn" data-accion="validar" ${p("calidad.validar") ? "" : ui.sinPermiso("calidad.validar")}>Validación funcional</button>` };
      case "EN_ANALISIS": return { txt: "Calidad aprobada. Corresponde ejecutar la conciliación (conciliador).", btn: `<button class="btn" data-accion="conciliar" ${ui.sinPermiso("conciliacion.ejecutar")}>Ejecutar conciliación</button>` };
      case "CON_DIFERENCIA":
        if (pend) return { txt: `Hay ${pend} diferencia(s) pendientes de revisión humana (revisor o validador).`, btn: `<button class="btn" data-accion="tabConc">Revisar diferencias</button>` };
        if (c.totales.material && c.filas.some((f) => f.revision.estado === "CONFIRMADA" && f.diferencia > 0)) return { txt: `Diferencia material confirmada (${U.pesos(c.totales.aFavorEsap)}). Procede la mesa técnica o el registro del resultado.`,
          btn: `<button class="btn" data-accion="mesa" ${ui.sinPermiso("mesa.programar")}>Programar mesa técnica</button> <button class="btn btn-sec" data-accion="cerrar" ${ui.sinPermiso("expediente.cerrar")}>Registrar resultado</button>` };
        return { txt: "Diferencias revisadas y no materiales. Registre el resultado.", btn: `<button class="btn" data-accion="cerrar" ${ui.sinPermiso("expediente.cerrar")}>Registrar resultado</button>` };
      case "CONCILIADO": return { txt: "Sin diferencias. Registre el resultado para cerrar el seguimiento.", btn: `<button class="btn" data-accion="cerrar" ${ui.sinPermiso("expediente.cerrar")}>Registrar resultado</button>` };
      case "MESA_TECNICA": return { txt: `Mesa técnica el ${U.fecha(exp.mesa.fecha)} ${esc(exp.mesa.hora)}. Registre el acta y el resultado.`, btn: `<button class="btn" data-accion="cerrar" ${ui.sinPermiso("expediente.cerrar")}>Registrar acta y resultado</button>` };
      default: return { txt: `Cerrado: ${esc(S21.cat.RESULTADOS[exp.resultado?.tipo] || "")}.`, btn: "" };
    }
  }

  /* ---------- Detalle ---------- */
  function detalle(el, exp, params) {
    if (!exp) { el.innerHTML = `<div class="aviso error"><p>No existe el expediente.</p></div>`; return; }
    if (params.tab) pestana.actual = params.tab;
    const ent = st.entidad(exp.entidadId);
    const sp = siguientePaso(exp);
    const traz = R.trazabilidad(exp);
    const alertas = st.alertasDe(exp.id);
    const lotes = st.lotesDe(exp.id);
    const bit = st.db.bitacora.filter((b) => b.expedienteId === exp.id).sort((a, b) => b.fecha.localeCompare(a.fecha));

    el.innerHTML = `
      ${ui.cabecera({ migas: [{ txt: "Expedientes", href: "#/esap/m7" }, { txt: exp.id }], titulo: `${exp.id} · ${ent.nombre}`,
        descripcion: `NIT ${esc(ent.nit)}-${esc(ent.dv)} · DT ${esc(exp.dt)} · ${esc(exp.casoReferencia || "")}`,
        acciones: `${ui.chipEstadoExp(exp.estado)} <button class="btn btn-sec" data-accion="informe">Informe de verificación</button>` })}
      <div class="aviso ${exp.estado === "CERRADO" ? "ok" : ""}"><div class="flex between items-center wrap gap-1"><p class="mb-0"><b>Siguiente paso:</b> ${sp.txt}</p><div class="acciones">${sp.btn}</div></div></div>
      ${ui.pestanas("m7", [{ id: "resumen", txt: "Resumen" }, { id: "conciliacion", txt: "Conciliación" }, { id: "documentos", txt: "Documentos", n: lotes.length },
        { id: "alertas", txt: "Alertas", n: alertas.length }, { id: "bitacora", txt: "Bitácora", n: bit.length }], pestana.actual)}
      <div id="tab"></div>`;
    const t = el.querySelector("#tab");

    if (pestana.actual === "resumen") {
      const r = exp.registroEntidad;
      t.innerHTML = `
        <div class="grid grid-2">
          <div class="tarjeta"><h3>1 · Insumo y requerimiento</h3><dl class="dl">
            <dt>Origen</dt><dd>${esc(exp.origen.tipo)} ${exp.origen.insumoId ? `<span class="small muted">(${esc(exp.origen.insumoId)})</span>` : ""}<div class="small muted">${esc(exp.origen.descripcion)}</div></dd>
            <dt>Requerido</dt><dd>${U.fechaHora(exp.fechaRequerimiento)}</dd>
            <dt>Periodos</dt><dd>${exp.periodos.map(U.periodo).join(", ")}</dd>
            <dt>Plazo</dt><dd>${U.fecha(exp.fechaLimite)}</dd>
            <dt>Credencial temporal</dt><dd><span class="mono">${esc(exp.credencial.usuario)}</span> · ${exp.credencial.activa ? (new Date(exp.credencial.vence) > new Date() ? ui.chip("Vigente", "ok") : ui.chip("Vencida", "error")) : ui.chip("Inactiva")}<div class="small muted">Vence ${U.fecha(exp.credencial.vence)} · último acceso ${U.fechaHora(exp.credencial.ultimoAcceso)}</div></dd>
            <dt>Responsable ESAP</dt><dd>${exp.responsableId ? esc(st.usuario(exp.responsableId).nombre) : ui.chip("Sin asignar", "alerta")}
              <button class="btn btn-txt btn-sm no-imprimir" data-accion="asignar" ${S21.auth.puede("alerta.asignar") || S21.auth.puede("expediente.gestionar") ? "" : "disabled"}>Cambiar</button></dd>
            <dt>Prioridad</dt><dd>${ui.chipPrioridad(exp.prioridad)}</dd></dl></div>
          <div class="tarjeta"><h3>2 · Información de la entidad</h3>${r ? `<dl class="dl">
            <dt>Representante</dt><dd>${esc(r.representante.nombre)}<div class="small muted">${esc(r.representante.cargo)} · CC ${esc(r.representante.documento)}</div></dd>
            <dt>Responsable</dt><dd>${esc(r.responsable.nombre)}<div class="small muted">${esc(r.responsable.cargo)} · ${esc(r.responsable.correo)} · ${esc(r.responsable.telefono)}</div></dd>
            <dt>Nómina</dt><dd>${exp.nomina ? `${esc(exp.nomina.archivo)} (v${exp.nomina.version}, ${U.num(exp.nomina.filas)} filas) ${exp.nomina.validacion.ok ? ui.chip("Sin errores", "ok") : ui.chip("Con errores", "error")}` : "—"}</dd>
            <dt>Factores salariales</dt><dd class="small">${exp.nomina ? exp.nomina.resumen.conceptos.filter((c) => c.salarial).map((c) => esc(c.nombre)).join(", ") : "—"}</dd>
            <dt>Radicado</dt><dd>${exp.radicado ? `${esc(exp.radicado.numero)} · ${U.fechaHora(exp.radicado.fecha)}` : "—"}</dd>
            <dt>Reprocesos</dt><dd>${exp.reprocesos || 0}</dd></dl>` : '<p class="muted">La entidad aún no ha registrado información.</p>'}</div>
          <div class="tarjeta"><h3>3 · Análisis y conciliación</h3>${exp.conciliacion ? `<dl class="dl">
            <dt>Esperado</dt><dd>${U.pesos(exp.conciliacion.totales.esperado)}</dd><dt>Recaudado</dt><dd>${U.pesos(exp.conciliacion.totales.recaudado)}</dd>
            <dt>A favor ESAP</dt><dd><b>${U.pesos(exp.conciliacion.totales.aFavorEsap)}</b> ${exp.conciliacion.totales.material ? ui.chip("Material", "error") : ""}</dd>
            <dt>Periodos con indicio</dt><dd>${exp.conciliacion.filas.filter((f) => f.clasificacion !== "CONCILIADO").length} de ${exp.conciliacion.filas.length}</dd>
            ${exp.mesa ? `<dt>Mesa técnica</dt><dd>${U.fecha(exp.mesa.fecha)} ${esc(exp.mesa.hora)} · ${esc(exp.mesa.modalidad)}${exp.mesa.acta ? `<div class="small muted">Acta: ${esc(exp.mesa.acta)}</div>` : ""}</dd>` : ""}</dl>` : '<p class="muted">Pendiente.</p>'}</div>
          <div class="tarjeta"><h3>4 · Resultado y trazabilidad</h3>
            ${exp.resultado ? `<dl class="dl mb-2"><dt>Resultado</dt><dd>${esc(S21.cat.RESULTADOS[exp.resultado.tipo])}</dd>${exp.resultado.acto ? `<dt>Acto / referencia</dt><dd>${esc(exp.resultado.acto)}</dd>` : ""}
              <dt>Registrado</dt><dd>${U.fechaHora(exp.resultado.fecha)} · ${esc(exp.resultado.por)}</dd><dt>Observación</dt><dd class="small">${esc(exp.resultado.observacion)}</dd></dl>` : '<p class="muted">Sin resultado registrado.</p>'}
            <h4>Trazabilidad completa ${traz.completa ? ui.chip("Sí", "ok") : ui.chip("Incompleta", "alerta")}</h4>
            <p class="small mb-0">${[["fuente", "Fuente"], ["responsable", "Responsable"], ["soporte", "Soporte"], ["regla", "Regla aplicada"], ["decision", "Decisión"]].map(([k, v]) => ui.chip(`${traz[k] ? "✓" : "✗"} ${v}`, traz[k] ? "ok" : "")).join(" ")}</p>
            <div class="acciones mt-2"><button class="btn btn-sec btn-sm" data-accion="nota" ${ui.sinPermiso("expediente.gestionar")}>Agregar actuación a la bitácora</button></div>
          </div>
        </div>`;
    } else if (pestana.actual === "conciliacion") {
      t.innerHTML = `<div class="tarjeta">${exp.estado !== "CERRADO" && exp.estado !== "MESA_TECNICA" && exp.revisionCalidad ? `<div class="acciones mb-2"><button class="btn btn-sec" data-accion="conciliar" ${ui.sinPermiso("conciliacion.ejecutar")}>${exp.conciliacion ? "Volver a conciliar" : "Ejecutar conciliación"}</button></div>` : ""}${S21.comp.tablaConciliacion(exp)}</div>`;
    } else if (pestana.actual === "documentos") {
      t.innerHTML = `<p class="small muted">Referencias a los soportes. En producción cada referencia apuntaría al repositorio institucional / gestor documental.</p>
        ${ui.tabla({ columnas: [
          { t: "Documento", v: (l) => `${esc(S21.cat.TIPOS_DOCUMENTO[l.tipo]?.txt || l.tipo)}<div class="small muted">${esc(l.nombre)}</div>` },
          { t: "Lote", v: (l) => `<span class="mono small">${esc(l.id)}</span>` },
          { t: "Versión", num: true, v: (l) => l.version },
          { t: "Cargado", v: (l) => `${U.fechaHora(l.fecha)}<div class="small muted">${esc(l.cargadoPor)}</div>` },
          { t: "Huella", v: (l) => `<span class="mono tenue small">${esc(String(l.huella).slice(0, 12))}…</span>` },
          { t: "Estado", v: (l) => ui.chip(l.estado, l.estado === "DUPLICADO" ? "alerta" : l.estado === "CON_ERRORES" ? "error" : "ok") },
        ], filas: lotes, vacio: "Sin documentos." })}`;
    } else if (pestana.actual === "alertas") {
      t.innerHTML = ui.tabla({ columnas: [
        { t: "Alerta", v: (a) => `<span class="mono small">${esc(a.id)}</span><div class="small muted">${U.fechaHora(a.fecha)}</div>` },
        { t: "Tipo", v: (a) => esc(S21.cat.TIPOS_ALERTA[a.tipo].txt) },
        { t: "Detalle", v: (a) => `<span class="small">${esc(a.detalle)}</span>${a.justificacion ? `<div class="small muted">Justificación: ${esc(a.justificacion)}</div>` : ""}` },
        { t: "Prioridad", v: (a) => ui.chipPrioridad(a.prioridad) },
        { t: "Estado", v: (a) => ui.chipEstadoAlerta(a.estado) },
      ], filas: alertas, vacio: "Sin alertas." }) + `<div class="acciones mt-1"><a class="btn btn-sec btn-sm" href="#/esap/m6">Gestionar en el módulo 6</a></div>`;
    } else {
      t.innerHTML = `<div class="tarjeta"><ul class="linea-tiempo">${bit.map((b) => `<li class="${b.tipo}"><div class="cuando">${U.fechaHora(b.fecha)} · ${esc(b.actor)}</div><div class="que">${esc(b.accion)}</div>${b.detalle ? `<div class="det">${esc(b.detalle)}</div>` : ""}${b.evidencia ? `<div class="small tenue mono">Evidencia: ${esc(b.evidencia)}</div>` : ""}</li>`).join("")}</ul></div>`;
    }

    ui.on(el, {
      tab: (b) => { pestana.actual = b.dataset.tab; S21.app.render(); },
      tabConc: () => { pestana.actual = "conciliacion"; S21.app.render(); },
      verRequerimiento: () => A().mostrarRequerimiento(exp),
      validar: () => A().validarCalidad(exp),
      conciliar: () => { A().conciliar(exp); },
      mesa: () => A().programarMesa(exp),
      cerrar: () => A().cerrar(exp),
      asignar: () => A().asignarResponsable(exp),
      informe: () => informe(exp),
      nota: () => ui.pedirTexto("Agregar actuación", "Descripción de la actuación (aclaración, llamada, comunicación, decisión)", (txt) => {
        st.bitacora(exp.id, "Actuación registrada", txt);
        st.auditar("Actuación manual", exp.id, txt);
        A().refrescar();
      }, { txt: "Agregar" }),
      ...S21.comp.accionesConciliacion,
    });
  }

  /* Informe de verificación (insumo para requerimiento, mesa técnica o acto administrativo) */
  function informe(exp) {
    const ent = st.entidad(exp.entidadId);
    const c = exp.conciliacion;
    st.auditar("Consulta de informe de verificación", exp.id, "");
    st.guardar();
    ui.modal({
      titulo: `Informe de verificación · ${exp.id}`,
      ancho: true,
      cuerpo: `
        <div class="flex between items-center mb-2"><img src="assets/img/logo-esap.png" alt="ESAP" style="height:44px"><div class="right small muted">Generado ${U.fechaHora(U.ahora())}<br>PROTOTIPO · DATOS FICTICIOS</div></div>
        <h2>Informe de verificación de aportes · Ley 21 de 1982</h2>
        <dl class="dl mb-2"><dt>Entidad</dt><dd>${esc(ent.nombre)} · NIT ${esc(ent.nit)}-${esc(ent.dv)}</dd><dt>Expediente</dt><dd>${esc(exp.id)}</dd>
          <dt>Periodos</dt><dd>${exp.periodos.map(U.periodo).join(", ")}</dd><dt>Origen</dt><dd>${esc(exp.origen.tipo)}: ${esc(exp.origen.descripcion)}</dd>
          <dt>Nómina analizada</dt><dd>${exp.nomina ? `${esc(exp.nomina.archivo)} (v${exp.nomina.version})` : "—"}</dd>
          <dt>Factores salariales declarados</dt><dd>${exp.nomina ? exp.nomina.resumen.conceptos.filter((x) => x.salarial).map((x) => esc(x.nombre)).join(", ") : "—"}</dd></dl>
        <h3>Conciliación</h3>
        ${S21.comp.tablaConciliacion(exp, { acciones: false })}
        ${c ? `<h3 class="mt-2">Conclusión preliminar</h3><p>${c.totales.aFavorEsap > 0
          ? `Se identifican indicios de diferencia a favor de la ESAP por <b>${U.pesos(c.totales.aFavorEsap)}</b> en ${c.filas.filter((f) => f.diferencia > st.param("R03")).length} periodo(s), sujetos a confirmación del área competente.`
          : "No se identifican diferencias a favor de la ESAP por encima de la tolerancia."}</p>` : ""}
        <p class="small muted">Este informe es un insumo de trabajo. No produce efectos jurídicos, contables ni administrativos por sí mismo y no sustituye el expediente administrativo oficial.</p>`,
      acciones: [{ txt: "Imprimir / guardar PDF", fn: () => { document.body.classList.add("imprimiendo-modal"); window.print(); document.body.classList.remove("imprimiendo-modal"); return false; } }],
    });
  }
})();
