/* Acciones del flujo de un expediente, compartidas por varios módulos.
   Cada acción deja bitácora (módulo 7) y auditoría (módulo 9). */
S21.acciones = (function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store;
  const refrescar = () => { st.guardar(); S21.app.render(); };

  /* ---------- Requerimiento con credencial temporal ---------- */
  function crearRequerimiento(entidadId, insumoId) {
    const ent = st.entidad(entidadId);
    const abiertos = st.expedientesDe(entidadId).filter((e) => e.estado !== "CERRADO");
    if (abiertos.length) { ui.toast(`La entidad ya tiene el expediente abierto ${abiertos[0].id}.`, "error"); return; }
    const ins = insumoId ? st.db.insumoSigip.find((x) => x.id === insumoId) : null;
    const plazo = st.param("R06");
    const meses = st.param("R07");
    const periodos = ins?.periodos?.slice(-meses) || S21.seed.PERIODOS.slice(-meses);
    const usuarios = st.db.usuarios.filter((u) => u.activo && ["gestor", "conciliador", "revisor", "validador", "apoyo"].includes(u.rol));
    const opcionesResp = usuarios.map((u) => `<option value="${u.id}" ${u.dt === ent.dt ? "selected" : ""}>${esc(u.nombre)} · ${esc(S21.auth.ROLES[u.rol].nombre)} · ${esc(u.dt)}</option>`).join("");

    ui.modal({
      titulo: `Generar requerimiento · ${ent.nombre}`,
      cuerpo: `
        ${ins ? `<div class="aviso"><p><b>Insumo ${esc(ins.id)} (${esc(ins.fuente)}).</b> ${esc(ins.tipo)}: ${esc(ins.descripcion)}</p></div>` : ""}
        <dl class="dl mb-2"><dt>NIT</dt><dd>${esc(ent.nit)}-${esc(ent.dv)}${ent.nitCompartido ? " " + ui.chip("NIT compartido", "alerta") : ""}</dd>
          <dt>Periodos solicitados</dt><dd>${periodos.map(U.periodo).join(", ")}</dd>
          <dt>Plazo</dt><dd>${plazo} días calendario (regla R06)</dd></dl>
        <div class="campo"><label for="rq-resp">Responsable del seguimiento</label><select id="rq-resp">${opcionesResp}</select></div>
        <div class="campo"><label for="rq-prio">Prioridad</label><select id="rq-prio"><option>Alta</option><option selected>Media</option><option>Baja</option></select></div>
        <p class="small muted mb-0">Al generar el requerimiento se crea el expediente y una credencial temporal vinculada a él, con vigencia hasta el vencimiento del plazo.</p>`,
      acciones: [{ txt: "Generar requerimiento", fn: (m) => {
        const id = st.siguienteExpedienteId();
        const ahora = U.ahora();
        const exp = {
          id, entidadId, dt: ent.dt, casoReferencia: "Creado en la demostración",
          origen: { insumoId: ins?.id || null, tipo: ins?.tipo || "Requerimiento directo", descripcion: ins?.descripcion || "Verificación de aportes solicitada por el Grupo de Recaudo y Cartera." },
          motivo: `Validación y verificación de los aportes de la Ley 21 de 1982 · ${ins?.tipo || "verificación"}`,
          periodos, creado: ahora, fechaRequerimiento: ahora, fechaLimite: U.sumarDias(ahora, plazo),
          credencial: { usuario: `SG21-${id.slice(-4)}`, clave: U.claveTemporal(), emitida: ahora, vence: U.sumarDias(ahora, plazo), activa: true, ultimoAcceso: null },
          estado: "REQUERIDO", responsableId: m.querySelector("#rq-resp").value, prioridad: m.querySelector("#rq-prio").value,
          registroEntidad: null, nomina: null, conciliacion: null, mesa: null, resultado: null, radicado: null, reprocesos: 0, cerrado: null, revisionCalidad: null,
        };
        st.db.expedientes.push(exp);
        if (ins) ins.estado = "REQUERIDO";
        if (ins) st.bitacora(id, "Insumo recibido de SIGIP", `${ins.tipo}: ${ins.descripcion}`, "sistema");
        st.bitacora(id, "Requerimiento emitido", `Se solicitó la información de ${periodos.length} periodos y se habilitó la credencial temporal ${exp.credencial.usuario} hasta el ${U.fecha(exp.credencial.vence)}.`);
        st.auditar("Creación de expediente y credencial temporal", id, `${ent.nombre} · ${exp.credencial.usuario}`);
        st.notificar(exp.responsableId, `Nuevo expediente asignado: ${id}`, `${ent.nombre}. Plazo hasta ${U.fecha(exp.fechaLimite)}.`, id);
        st.guardar();
        setTimeout(() => mostrarRequerimiento(exp), 0);
        S21.app.render();
      } }],
    });
  }

  /* Proforma del requerimiento con el paso a paso y la credencial (para imprimir o enviar) */
  function mostrarRequerimiento(exp) {
    const ent = st.entidad(exp.entidadId);
    const url = location.href.split("#")[0] + "#/entidad";
    ui.modal({
      titulo: `Requerimiento ${exp.id}`,
      ancho: true,
      cuerpo: `
        <p class="small muted">Proforma generada por SIGREC-21. En la implementación real se radicaría por el aplicativo de Gestión Documental.</p>
        <div class="tarjeta">
          <p><b>Señor(a) ${esc(ent.representante?.nombre || "Representante legal")}</b><br>${esc(ent.nombre)} · NIT ${esc(ent.nit)}-${esc(ent.dv)}</p>
          <p><b>Asunto:</b> Requerimiento de validación y verificación de información · Aportes Ley 21 de 1982 · Expediente ${esc(exp.id)}</p>
          <p>En las herramientas de análisis de la ESAP se identificó: <i>${esc(exp.origen.descripcion)}</i> Este requerimiento no constituye cobro;
          tiene por objeto validar la información de los periodos ${exp.periodos.map(U.periodo).join(", ")}.</p>
          <p>Para tal efecto, deberá cargar la información en el aplicativo SIGREC-21, a más tardar el <b>${U.fecha(exp.fechaLimite)}</b>, así:</p>
          <ol class="small">
            <li>Ingrese a <span class="mono">${esc(url)}</span>.</li>
            <li>Use el <b>usuario temporal ${esc(exp.credencial.usuario)}</b> y la <b>clave ${esc(exp.credencial.clave)}</b> (válidos solo para este expediente y hasta la fecha límite).</li>
            <li>Registre los datos del representante legal y del responsable de la información.</li>
            <li>Cargue la nómina en archivo editable (plantilla del aplicativo) e indique qué conceptos constituyen factor salarial.</li>
            <li>Cargue las planillas PILA, los comprobantes de pago y la certificación de factores salariales, y radique.</li>
          </ol>
          <p class="small mb-0">Cordialmente,<br><b>Grupo de Recaudo y Cartera · Dirección Financiera</b></p>
        </div>
        <div class="credencial mt-2">Credencial temporal: usuario <code>${esc(exp.credencial.usuario)}</code> · clave <code>${esc(exp.credencial.clave)}</code> · vence ${U.fecha(exp.credencial.vence)}</div>`,
      acciones: [
        { txt: "Imprimir", clase: "btn-sec", fn: () => { document.body.classList.add("imprimiendo-modal"); window.print(); document.body.classList.remove("imprimiendo-modal"); return false; } },
        { txt: "Ver expediente", fn: () => S21.app.ir(`#/esap/expediente/${exp.id}`) },
      ],
    });
  }

  /* ---------- Calidad (módulo 3) ---------- */
  function validarCalidad(exp) {
    const v = exp.nomina?.validacion;
    if (!v) return ui.toast("El expediente no tiene nómina cargada.", "error");
    const docs = st.lotesDe(exp.id);
    const faltan = ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"].filter((t) => !docs.some((d) => d.tipo === t && d.estado !== "DUPLICADO"));
    ui.modal({
      titulo: `Validación funcional · ${exp.id}`,
      cuerpo: `<p class="small">Resultado automático de calidad de la nómina (v${exp.nomina.version}):</p>
        <ul class="small">${v.resultados.map((r) => `<li>${esc(r.regla)} · ${r.nivel === "ok" ? "✔" : r.nivel === "error" ? "✖" : "⚠"} ${esc(r.mensaje)}</li>`).join("")}</ul>
        ${faltan.length ? `<div class="aviso alerta"><p>Soportes obligatorios pendientes: ${faltan.map((t) => S21.cat.TIPOS_DOCUMENTO[t].txt).join(", ")}.</p></div>` : '<div class="aviso ok"><p>Soportes obligatorios completos.</p></div>'}
        <div class="campo"><label for="vc-obs">Observación (opcional)</label><textarea id="vc-obs"></textarea></div>`,
      acciones: [
        { txt: "Devolver para ajuste", clase: "btn-sec", fn: (m) => { const o = m.querySelector("#vc-obs").value.trim(); setTimeout(() => devolver(exp, o), 0); } },
        { txt: "Aprobar calidad", clase: "btn-ok", fn: (m) => {
          if (!v.ok) { ui.toast("No se puede aprobar: la nómina tiene errores. Devuélvala para ajuste.", "error"); return false; }
          exp.revisionCalidad = { fecha: U.ahora(), por: S21.auth.actor().nombre, resultado: "APROBADA", obs: m.querySelector("#vc-obs").value.trim() };
          exp.estado = "EN_ANALISIS";
          st.bitacora(exp.id, "Calidad y estructura validadas", `Integridad, completitud, formato y clasificación de conceptos verificados. ${exp.revisionCalidad.obs}`);
          st.alertasDe(exp.id).filter((a) => a.tipo === "LISTO_VALIDACION" && a.estado !== "CERRADA").forEach((a) => st.cambiarEstadoAlerta(a, "CERRADA", "Validación funcional realizada."));
          if (faltan.length) st.crearAlerta({ tipo: "SOPORTE_PENDIENTE", expedienteId: exp.id, detalle: `Pendientes: ${faltan.map((t) => S21.cat.TIPOS_DOCUMENTO[t].txt).join(", ")}.` });
          st.auditar("Aprobación de calidad", exp.id, "");
          ui.toast("Calidad aprobada. El expediente pasa a análisis.", "ok");
          refrescar();
        } },
      ],
    });
  }

  function devolver(exp, observacion) {
    ui.pedirTexto("Devolver a la entidad para ajuste", "Motivo de la devolución (lo verá la entidad)", (motivo) => {
      exp.estado = "EN_CARGUE";
      exp.devolucion = { fecha: U.ahora(), motivo, por: S21.auth.actor().nombre };
      exp.reprocesos = (exp.reprocesos || 0) + 1;
      const nuevoVence = U.sumarDias(U.ahora(), 5);
      if (new Date(exp.credencial.vence) < new Date(nuevoVence)) { exp.credencial.vence = nuevoVence; exp.fechaLimite = nuevoVence; }
      exp.credencial.activa = true;
      st.bitacora(exp.id, "Información devuelta para ajuste", `${motivo}. Credencial vigente hasta ${U.fecha(exp.credencial.vence)}.`);
      st.alertasDe(exp.id).filter((a) => a.tipo === "LISTO_VALIDACION" && a.estado !== "CERRADA").forEach((a) => st.cambiarEstadoAlerta(a, "CERRADA", "Devuelto para ajuste."));
      st.auditar("Devolución a la entidad", exp.id, motivo);
      ui.toast("Expediente devuelto a la entidad.", "ok");
      refrescar();
    }, { txt: "Devolver", valor: observacion });
  }

  /* ---------- Conciliación (módulo 5) ---------- */
  function conciliar(exp) {
    try {
      const c = S21.reglas.conciliar(exp);
      ui.toast(exp.estado === "CONCILIADO" ? "Conciliado: sin diferencias por encima de la tolerancia." : `Conciliación con ${c.filas.filter((f) => f.clasificacion !== "CONCILIADO").length} periodo(s) con indicio de diferencia.`, exp.estado === "CONCILIADO" ? "ok" : "");
      refrescar();
    } catch (e) { ui.toast(e.message, "error"); }
  }

  function revisarFila(exp, periodo, decision) {
    const f = exp.conciliacion.filas.find((x) => x.periodo === periodo);
    const aplicar = (nota) => {
      f.revision = { estado: decision, por: S21.auth.actor().nombre, fecha: U.ahora(), nota };
      st.alertasDe(exp.id).filter((a) => a.tipo === "DIFERENCIA_VALORES" && a.periodo === periodo && ["ABIERTA", "EN_GESTION"].includes(a.estado))
        .forEach((a) => st.cambiarEstadoAlerta(a, decision === "CONFIRMADA" ? "CONFIRMADA" : "DESCARTADA", nota));
      st.bitacora(exp.id, `Diferencia de ${U.periodo(periodo)} ${decision === "CONFIRMADA" ? "confirmada" : "descartada"}`, `${S21.reglas.CLASIFICACION[f.clasificacion].txt} por ${U.pesos(f.diferencia)}. ${nota}`);
      st.auditar(`Revisión de diferencia (${decision.toLowerCase()})`, exp.id, `${periodo}: ${nota}`);
      refrescar();
    };
    if (decision === "DESCARTADA") ui.pedirTexto(`Descartar diferencia de ${U.periodo(periodo)}`, "Justificación del descarte", aplicar, { txt: "Descartar", ayuda: "Queda registrada en la bitácora y en la auditoría (indicador de alertas descartadas)." });
    else ui.pedirTexto(`Confirmar diferencia de ${U.periodo(periodo)}`, "Fundamento de la confirmación", aplicar, { txt: "Confirmar", valor: `${S21.reglas.CLASIFICACION[f.clasificacion].indicio}. Verificado contra nómina y fuentes autorizadas.` });
  }

  /* ---------- Mesa técnica (solo diferencia material) ---------- */
  function programarMesa(exp) {
    const t = exp.conciliacion?.totales;
    if (!t?.material) return ui.toast(`La mesa técnica se reserva para diferencias materiales (≥ ${U.pesos(st.param("R04"))}).`, "error");
    const pendientes = exp.conciliacion.filas.filter((f) => f.revision.estado === "PENDIENTE");
    if (pendientes.length) return ui.toast("Primero confirme o descarte todas las diferencias.", "error");
    const manana = U.sumarDias(U.ahora(), 7).slice(0, 10);
    ui.modal({
      titulo: `Programar mesa técnica · ${exp.id}`,
      cuerpo: `<div class="aviso"><p>Diferencia material a favor de la ESAP: <b>${U.pesos(t.aFavorEsap)}</b>. La mesa se usa para análisis y conclusiones, no para recopilar información básica.</p></div>
        <div class="grid grid-2"><div class="campo"><label for="mt-f">Fecha</label><input type="date" id="mt-f" value="${manana}"></div>
        <div class="campo"><label for="mt-h">Hora</label><input type="text" id="mt-h" value="10:00"></div></div>
        <div class="campo"><label for="mt-m">Modalidad</label><select id="mt-m"><option>Virtual (Teams)</option><option>Presencial · Sede Central</option><option>Presencial · Dirección Territorial</option></select></div>
        <div class="campo"><label for="mt-p">Participantes</label><input type="text" id="mt-p" value="ESAP: Recaudo y Cartera, DT ${esc(exp.dt)}. Entidad: representante y responsable de nómina."></div>
        <div class="campo"><label for="mt-a">Agenda</label><textarea id="mt-a">Presentar el informe de verificación, las diferencias confirmadas y escuchar las aclaraciones de la entidad.</textarea></div>`,
      acciones: [{ txt: "Programar", fn: (m) => {
        exp.mesa = { fecha: m.querySelector("#mt-f").value, hora: m.querySelector("#mt-h").value, modalidad: m.querySelector("#mt-m").value,
          participantes: m.querySelector("#mt-p").value, agenda: m.querySelector("#mt-a").value, acta: null };
        exp.estado = "MESA_TECNICA";
        st.bitacora(exp.id, "Mesa técnica programada", `${U.fecha(exp.mesa.fecha)} ${exp.mesa.hora} · ${exp.mesa.modalidad}. Diferencia material ${U.pesos(t.aFavorEsap)}.`);
        st.notificar(exp.responsableId, `Mesa técnica ${exp.id}`, `Programada para el ${U.fecha(exp.mesa.fecha)}.`, exp.id);
        st.auditar("Programación de mesa técnica", exp.id, exp.mesa.fecha);
        refrescar();
      } }],
    });
  }

  /* ---------- Resultado y cierre ---------- */
  function cerrar(exp) {
    const t = exp.conciliacion?.totales;
    const confirmadas = (exp.conciliacion?.filas || []).filter((f) => f.revision.estado === "CONFIRMADA");
    const pendientes = (exp.conciliacion?.filas || []).filter((f) => f.revision.estado === "PENDIENTE");
    if (pendientes.length) return ui.toast("Hay diferencias pendientes de revisión.", "error");
    const sugerido = !exp.conciliacion ? "SIN_OBLIGACION" : confirmadas.some((f) => f.diferencia > 0) ? "OBLIGACION_DETERMINADA" : confirmadas.some((f) => f.diferencia < 0) ? "SALDO_A_FAVOR" : "SIN_OBLIGACION";
    const valorConf = U.sumar(confirmadas.filter((f) => f.diferencia > 0), (f) => f.diferencia);
    ui.modal({
      titulo: `Registrar resultado · ${exp.id}`,
      cuerpo: `
        <dl class="dl mb-2"><dt>Diferencias confirmadas</dt><dd>${confirmadas.length} periodo(s) · ${U.pesos(valorConf)}</dd>
          <dt>Total a favor ESAP (conciliación)</dt><dd>${U.pesos(t?.aFavorEsap || 0)}</dd></dl>
        ${exp.estado === "MESA_TECNICA" ? `<div class="campo"><label for="cr-acta">Conclusiones de la mesa técnica (acta) <span class="req">*</span></label><textarea id="cr-acta">${esc(exp.mesa?.acta || "")}</textarea></div>` : ""}
        <div class="campo"><label for="cr-tipo">Resultado</label><select id="cr-tipo">${Object.entries(S21.cat.RESULTADOS).map(([k, v]) => `<option value="${k}" ${k === sugerido ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="campo"><label for="cr-acto">Acto administrativo / referencia (si aplica)</label><input type="text" id="cr-acto" placeholder="Ej.: Resolución 0000 de 2026"></div>
        <div class="campo"><label for="cr-obs">Observación <span class="req">*</span></label><textarea id="cr-obs"></textarea></div>
        <p class="small muted mb-0">SIGREC-21 conserva la trazabilidad del resultado; no sustituye el expediente administrativo oficial ni las competencias de las áreas.</p>`,
      acciones: [{ txt: "Registrar y cerrar", fn: (m) => {
        const obs = m.querySelector("#cr-obs").value.trim();
        const acta = m.querySelector("#cr-acta")?.value.trim();
        if (!obs || (exp.estado === "MESA_TECNICA" && !acta)) { ui.toast("Complete los campos obligatorios.", "error"); return false; }
        if (acta) exp.mesa.acta = acta;
        const tipo = m.querySelector("#cr-tipo").value;
        exp.resultado = { tipo, fecha: U.ahora(), por: S21.auth.actor().nombre, valor: valorConf, acto: m.querySelector("#cr-acto").value.trim(), observacion: obs };
        exp.estado = "CERRADO";
        exp.cerrado = U.ahora();
        exp.credencial.activa = false;
        if (acta) st.bitacora(exp.id, "Acta de mesa técnica registrada", acta);
        st.bitacora(exp.id, "Resultado registrado y expediente cerrado", `${S21.cat.RESULTADOS[tipo]}. ${exp.resultado.acto ? exp.resultado.acto + ". " : ""}${obs}`);
        st.alertasDe(exp.id).filter((a) => ["ABIERTA", "EN_GESTION", "CONFIRMADA"].includes(a.estado)).forEach((a) => st.cambiarEstadoAlerta(a, "CERRADA", "Expediente cerrado."));
        st.auditar("Cierre de expediente", exp.id, S21.cat.RESULTADOS[tipo]);
        ui.toast("Resultado registrado.", "ok");
        refrescar();
      } }],
    });
  }

  function asignarResponsable(exp) {
    const opciones = st.db.usuarios.filter((u) => u.activo && !["consulta", "auditor", "admin_tecnico"].includes(u.rol))
      .map((u) => `<option value="${u.id}" ${u.id === exp.responsableId ? "selected" : ""}>${esc(u.nombre)} · ${esc(S21.auth.ROLES[u.rol].nombre)}</option>`).join("");
    ui.modal({
      titulo: `Responsable · ${exp.id}`,
      cuerpo: `<div class="campo"><label for="as-u">Responsable</label><select id="as-u">${opciones}</select></div>`,
      acciones: [{ txt: "Asignar", fn: (m) => {
        const u = st.usuario(m.querySelector("#as-u").value);
        exp.responsableId = u.id;
        st.bitacora(exp.id, "Responsable asignado", u.nombre);
        st.notificar(u.id, `Expediente asignado: ${exp.id}`, st.entidad(exp.entidadId).nombre, exp.id);
        st.alertasDe(exp.id).filter((a) => a.tipo === "SIN_RESPONSABLE" && a.estado !== "CERRADA").forEach((a) => st.cambiarEstadoAlerta(a, "CERRADA", `Asignado a ${u.nombre}.`));
        st.auditar("Asignación de responsable", exp.id, u.nombre);
        refrescar();
      } }],
    });
  }

  return { crearRequerimiento, mostrarRequerimiento, validarCalidad, devolver, conciliar, revisarFila, programarMesa, cerrar, asignarResponsable, refrescar };
})();
