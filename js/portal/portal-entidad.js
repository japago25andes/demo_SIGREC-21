/* Portal de la entidad requerida: acceso temporal por expediente, registro de información,
   cargue de nómina editable con clasificación de factores salariales, soportes y radicación. */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc, st = S21.store, R = S21.reglas;
  const PASOS = [
    { id: "requerimiento", txt: "Requerimiento" },
    { id: "registro", txt: "Datos de la entidad" },
    { id: "nomina", txt: "Nómina y factores" },
    { id: "soportes", txt: "Soportes" },
    { id: "radicar", txt: "Radicación" },
  ];
  const OBLIGATORIOS = ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"];
  let borrador = null; // nómina leída y aún no guardada { expId, lectura, conceptos, validacion, resumen }

  const expActual = () => st.expediente(S21.auth.sesion().expedienteId);
  const editable = (exp) => exp.estado === "REQUERIDO" || exp.estado === "EN_CARGUE";

  function avance(exp) {
    const docs = st.lotesDe(exp.id).filter((l) => l.estado !== "DUPLICADO");
    return {
      requerimiento: true,
      registro: !!exp.registroEntidad,
      nomina: !!exp.nomina && exp.nomina.validacion.ok,
      soportes: OBLIGATORIOS.every((t) => docs.some((d) => d.tipo === t)),
      radicar: !!exp.radicado && exp.estado !== "EN_CARGUE",
    };
  }

  /* ---------- Acceso ---------- */

  S21.vistas.portalLogin = {
    titulo: "Acceso de la entidad",
    render(el) {
      const d = S21.seed.DEMO;
      el.innerHTML = `
        <div class="grid grid-2">
          <div class="tarjeta">
            <h2>Acceso con credencial temporal</h2>
            <p class="muted small">La ESAP habilita un usuario y una clave <b>por requerimiento o expediente</b>, con vigencia limitada al plazo otorgado. No es un usuario permanente.</p>
            <form id="f-login" novalidate>
              <div class="campo"><label for="usuario">Usuario temporal <span class="req">*</span></label><input id="usuario" type="text" autocomplete="off" placeholder="SG21-0000"></div>
              <div class="campo"><label for="clave">Clave temporal <span class="req">*</span></label><input id="clave" type="password" autocomplete="off"></div>
              <div class="err small" id="login-err" role="alert" style="color:var(--error)"></div>
              <div class="acciones mt-1"><button class="btn" type="submit">Ingresar</button><a class="btn btn-txt" href="#/">Volver</a></div>
            </form>
          </div>
          <div class="tarjeta">
            <h3>Para la demostración</h3>
            <div class="credencial mb-2">Expediente ${esc(d.expediente)} · Municipio de Valle Sereno (ficticio)<br>
              usuario <code>${esc(d.usuario)}</code> · clave <code>${esc(d.clave)}</code></div>
            <button class="btn btn-sec btn-sm" data-accion="autollenar">Usar credencial de demostración</button>
            <hr class="separador">
            <p class="small muted mb-0">Las credenciales de los demás expedientes se pueden consultar en la consola ESAP (módulo 9, “Credenciales temporales”).
            Si el plazo venció o la credencial fue revocada, el acceso se rechaza.</p>
          </div>
        </div>`;
      ui.on(el, {
        autollenar() { el.querySelector("#usuario").value = d.usuario; el.querySelector("#clave").value = d.clave; },
      });
      el.querySelector("#f-login").addEventListener("submit", (e) => {
        e.preventDefault();
        const r = S21.auth.ingresarEntidad(el.querySelector("#usuario").value, el.querySelector("#clave").value);
        if (!r.ok) { el.querySelector("#login-err").textContent = r.msg; return; }
        borrador = null;
        S21.app.ir("#/entidad/requerimiento");
      });
    },
  };

  /* ---------- Portal ---------- */

  S21.vistas.portal = {
    titulo: "Portal de la entidad",
    render(el, params) {
      const exp = expActual();
      const pasoId = editable(exp) ? (PASOS.some((p) => p.id === params.paso) ? params.paso : "requerimiento") : "estado";
      const av = avance(exp);
      const ent = st.entidad(exp.entidadId);
      const restantes = U.diasEntre(U.ahora(), exp.fechaLimite);

      const pasosHtml = editable(exp) ? `<ol class="pasos">${PASOS.map((p) =>
        `<li class="${p.id === pasoId ? "actual" : av[p.id] ? "hecho" : ""}"><a href="#/entidad/${p.id}">${esc(p.txt)}</a></li>`).join("")}</ol>` : "";

      el.innerHTML = `
        <div class="flex between wrap gap-1 mb-2 items-center">
          <div><div class="small muted">Expediente ${esc(exp.id)} · NIT ${esc(ent.nit)}-${esc(ent.dv)}</div><h1 class="mb-0">${esc(ent.nombre)}</h1></div>
          <div class="right">${ui.chipEstadoExp(exp.estado)}<div class="small ${restantes < 3 ? "" : "muted"}" style="${restantes < 3 ? "color:var(--error);font-weight:600" : ""}">
            ${restantes >= 0 ? `Plazo: ${U.fecha(exp.fechaLimite)} · quedan ${restantes} día(s)` : `Plazo vencido el ${U.fecha(exp.fechaLimite)}`}</div></div>
        </div>
        ${exp.devolucion && editable(exp) ? `<div class="aviso alerta"><p><b>La ESAP devolvió la información para ajuste</b> (${U.fecha(exp.devolucion.fecha)}): ${esc(exp.devolucion.motivo)}</p></div>` : ""}
        ${pasosHtml}
        <div id="paso"></div>`;
      const cont = el.querySelector("#paso");
      ({ requerimiento: pasoRequerimiento, registro: pasoRegistro, nomina: pasoNomina, soportes: pasoSoportes, radicar: pasoRadicar, estado: pasoEstado })[pasoId](cont, exp, ent, av);
    },
  };

  function siguiente(id) { S21.app.ir(`#/entidad/${id}`); }

  /* Paso 1: requerimiento (proforma) */
  function pasoRequerimiento(el, exp, ent, av) {
    el.innerHTML = `
      <div class="grid grid-2">
        <div class="tarjeta span-2">
          <h3>Requerimiento de validación y verificación de información</h3>
          <p>La Escuela Superior de Administración Pública – ESAP, en ejercicio de la verificación de los aportes parafiscales de la Ley 21 de 1982,
          identificó en sus herramientas de análisis la siguiente situación respecto de <b>${esc(ent.nombre)}</b>:</p>
          <div class="aviso"><p><b>${esc(exp.origen.tipo)}.</b> ${esc(exp.origen.descripcion)}</p></div>
          <p>Este requerimiento <b>no es un cobro</b>: tiene por objeto validar la información. Se solicita registrar la información de la entidad y cargar,
          para los periodos <b>${exp.periodos.map(U.periodo).join(", ")}</b>:</p>
          <ul>
            <li>La <b>nómina en archivo editable</b> (Excel o CSV), con todos los conceptos devengados por servidor.</li>
            <li>La <b>clasificación de cada concepto</b> como factor salarial o no salarial.</li>
            <li>Las <b>planillas PILA</b>, los <b>comprobantes de pago</b> y la <b>certificación de conceptos y factores salariales</b>.</li>
          </ul>
          <p class="small muted mb-0">Plazo para radicar: hasta el ${U.fecha(exp.fechaLimite)}. La credencial temporal ${esc(exp.credencial.usuario)} vence en la misma fecha.</p>
        </div>
        <div class="tarjeta span-2">
          <h3>Su avance</h3>
          ${ui.tabla({ columnas: [
            { t: "Paso", v: (p) => esc(p.txt) },
            { t: "Estado", v: (p) => (av[p.id] ? ui.chip("Completo", "ok") : ui.chip("Pendiente", "alerta")) },
            { t: "", v: (p) => `<a class="btn btn-sm btn-sec" href="#/entidad/${p.id}">Ir</a>` },
          ], filas: PASOS.slice(1) })}
          <div class="acciones mt-2"><button class="btn" data-accion="seguir">Comenzar · Datos de la entidad</button></div>
        </div>
      </div>`;
    ui.on(el, { seguir: () => siguiente("registro") });
  }

  /* Paso 2: registro de información por parte de la entidad (no búsqueda manual por la ESAP) */
  function pasoRegistro(el, exp, ent) {
    const r = exp.registroEntidad || { representante: ent.representante, responsable: ent.responsable };
    const campo = (id, etq, valor, tipo = "text", ayuda = "") => `<div class="campo"><label for="${id}">${etq} <span class="req">*</span></label>
      <input id="${id}" type="${tipo}" value="${esc(valor || "")}">${ayuda ? `<span class="ayuda">${ayuda}</span>` : ""}<span class="err" data-err="${id}"></span></div>`;
    el.innerHTML = `
      <form id="f-reg" class="grid grid-2" novalidate>
        <div class="tarjeta">
          <h3>Representante legal</h3>
          ${campo("rep-nombre", "Nombre completo", r.representante?.nombre)}
          ${campo("rep-doc", "Número de documento", r.representante?.documento, "text", "Solo números.")}
          ${campo("rep-cargo", "Cargo", r.representante?.cargo || (ent.tipo === "Municipio" ? "Alcalde(sa) municipal" : ""))}
        </div>
        <div class="tarjeta">
          <h3>Responsable de la información</h3>
          ${campo("res-nombre", "Nombre completo", r.responsable?.nombre)}
          ${campo("res-cargo", "Cargo", r.responsable?.cargo)}
          ${campo("res-correo", "Correo electrónico institucional", r.responsable?.correo, "email")}
          ${campo("res-tel", "Teléfono", r.responsable?.telefono, "tel")}
        </div>
        <div class="span-2">
          <p class="small muted">Estos datos se usan para el seguimiento de este expediente y <b>no sustituyen</b> los mecanismos oficiales de actualización de la base de aportantes.</p>
          <div class="acciones"><button class="btn" type="submit">Guardar y continuar</button></div>
        </div>
      </form>`;
    el.querySelector("#f-reg").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (id) => el.querySelector(`#${id}`).value.trim();
      const errores = {};
      ["rep-nombre", "rep-doc", "rep-cargo", "res-nombre", "res-cargo", "res-correo", "res-tel"].forEach((id) => { if (!v(id)) errores[id] = "Campo obligatorio."; });
      if (v("rep-doc") && !/^\d{5,12}$/.test(v("rep-doc"))) errores["rep-doc"] = "Documento inválido (5 a 12 dígitos).";
      if (v("res-correo") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("res-correo"))) errores["res-correo"] = "Correo inválido.";
      if (v("res-tel") && !/^[\d\s+()-]{7,15}$/.test(v("res-tel"))) errores["res-tel"] = "Teléfono inválido.";
      el.querySelectorAll("[data-err]").forEach((s) => { s.textContent = errores[s.dataset.err] || ""; el.querySelector(`#${s.dataset.err}`).setAttribute("aria-invalid", errores[s.dataset.err] ? "true" : "false"); });
      if (Object.keys(errores).length) { ui.toast("Revise los campos marcados.", "error"); return; }
      const antes = JSON.stringify(exp.registroEntidad);
      exp.registroEntidad = {
        representante: { nombre: v("rep-nombre"), documento: v("rep-doc"), cargo: v("rep-cargo") },
        responsable: { nombre: v("res-nombre"), cargo: v("res-cargo"), correo: v("res-correo"), telefono: v("res-tel") },
        fecha: U.ahora(),
      };
      ent.representante = { ...exp.registroEntidad.representante };
      ent.responsable = { ...exp.registroEntidad.responsable };
      ent.actualizado = U.ahora();
      st.bitacora(exp.id, antes === "null" || !antes ? "Registro de información de la entidad" : "Actualización de datos de la entidad",
        `Representante: ${exp.registroEntidad.representante.nombre}. Responsable de la información: ${exp.registroEntidad.responsable.nombre} (${exp.registroEntidad.responsable.correo}).`);
      st.auditar("Registro de datos de la entidad", exp.id, ent.nombre);
      st.guardar();
      ui.toast("Datos guardados.", "ok");
      siguiente("nomina");
    });
  }

  /* Paso 3: nómina editable + clasificación de factores salariales */
  function pasoNomina(el, exp) {
    if (borrador && borrador.expId !== exp.id) borrador = null;
    const guardada = exp.nomina;

    const resumenHtml = (resumen) => {
      const filas = exp.periodos.map((p) => ({ p, d: resumen.periodos[p] }));
      return ui.tabla({
        columnas: [
          { t: "Periodo", v: (f) => U.periodo(f.p) },
          { t: "Servidores", num: true, v: (f) => (f.d ? U.num(f.d.empleados) : ui.chip("Falta", "error")) },
          { t: "Total devengado", num: true, v: (f) => (f.d ? U.pesos(f.d.devengado) : "—") },
          { t: "Base factores salariales", num: true, v: (f) => (f.d ? U.pesos(R.baseSalarial(resumen, f.p)) : "—") },
          { t: "Aporte ESAP (0,5 %)", num: true, v: (f) => (f.d ? U.pesos(R.aporteEsperado(R.baseSalarial(resumen, f.p))) : "—") },
        ],
        filas,
      });
    };

    const validacionHtml = (val) => `<ul style="list-style:none;padding:0;margin:0">${val.resultados.map((r) => `<li class="mb-1">
      ${ui.chip(r.nivel === "ok" ? "Correcto" : r.nivel === "error" ? "Error" : "Advertencia", r.nivel === "ok" ? "ok" : r.nivel === "error" ? "error" : "alerta")}
      <span class="small"><span class="mono tenue">${esc(r.regla)}</span> ${esc(r.mensaje)}</span>
      ${r.detalle.length ? `<div class="small muted" style="margin-left:1rem">${r.detalle.map(esc).join("<br>")}</div>` : ""}</li>`).join("")}</ul>`;

    let html = `
      <div class="tarjeta mb-2">
        <div class="tarjeta-cab"><h3>1. Descargue la plantilla</h3>
          <div class="acciones"><button class="btn btn-sec btn-sm" data-accion="plantilla">Plantilla en blanco (.xlsx)</button>
          <button class="btn btn-sec btn-sm" data-accion="ejemplo">Ejemplo diligenciado (demo)</button></div></div>
        <p class="small muted mb-0">La plantilla tiene dos hojas: <b>Nomina</b> (una fila por servidor, periodo y concepto) y <b>Conceptos</b> (cada concepto con
        <b>ES_FACTOR_SALARIAL</b> = SI/NO). Un mismo concepto, como la prima técnica, puede ser factor salarial en una entidad y no en otra; por eso lo declara la entidad.
        ${S21.excel.disponible() ? "" : "<br><b>Sin conexión al lector de Excel:</b> puede cargar CSV."}</p>
      </div>
      <div class="tarjeta mb-2">
        <h3>2. Cargue el archivo de nómina</h3>
        ${ui.zonaCarga("archivo-nomina", guardada ? "Cargar una nueva versión de la nómina" : "Seleccione el archivo de nómina", ".xlsx,.xls,.csv")}
        <p class="small muted mt-1 mb-0">El archivo se procesa en su navegador. En el prototipo no se envía a ningún servidor.</p>
      </div>`;

    if (borrador) {
      const b = borrador;
      const errores = b.validacion.resultados.filter((r) => r.nivel === "error");
      const soloFaltanPeriodos = errores.length && errores.every((r) => r.regla === "R-V04");
      html += `
        <div class="tarjeta mb-2">
          <div class="tarjeta-cab"><h3>3. Resultado de la validación · ${esc(b.lectura.archivo)}</h3>
            ${b.validacion.ok ? ui.chip("Sin errores", "ok") : ui.chip(`${errores.length} error(es)`, "error")}</div>
          <p class="small muted">${U.num(b.lectura.filas.length)} filas leídas · hojas: ${b.lectura.hojas.map(esc).join(", ")} · huella ${esc(b.lectura.huella.slice(0, 16))}…</p>
          ${validacionHtml(b.validacion)}
        </div>
        <div class="tarjeta mb-2">
          <h3>4. Clasificación de conceptos (factor salarial)</h3>
          <p class="small muted">Revise o complete la clasificación. Los cambios recalculan la base de liquidación.</p>
          ${ui.tabla({ columnas: [
            { t: "Concepto", v: (c) => `<b>${esc(c.nombre)}</b>` },
            { t: "Total semestre", num: true, v: (c) => U.pesos(c.total) },
            { t: "¿Es factor salarial?", v: (c, i) => `<select data-cambio="clasificar" data-i="${i}" aria-label="Clasificación de ${esc(c.nombre)}" ${c.salarial === null ? 'aria-invalid="true"' : ""}>
                <option value="" ${c.salarial === null ? "selected" : ""}>— Seleccione —</option>
                <option value="SI" ${c.salarial === true ? "selected" : ""}>SI · factor salarial</option>
                <option value="NO" ${c.salarial === false ? "selected" : ""}>NO · no salarial</option></select>` },
          ], filas: b.resumen.conceptos })}
        </div>
        <div class="tarjeta mb-2">
          <h3>5. Resumen por periodo</h3>
          ${resumenHtml(b.resumen)}
          <div class="acciones mt-2">
            <button class="btn" data-accion="guardar" ${b.validacion.ok || soloFaltanPeriodos ? "" : "disabled"}>Guardar nómina${guardada ? ` (versión ${guardada.version + 1})` : ""}</button>
            <button class="btn btn-txt" data-accion="descartar">Descartar archivo</button>
          </div>
          ${!b.validacion.ok && !soloFaltanPeriodos ? `<p class="small mt-1" style="color:var(--error)">Corrija los errores en el archivo o en la clasificación para poder guardar.</p>` : ""}
          ${soloFaltanPeriodos ? `<p class="small mt-1" style="color:var(--alerta)">Puede guardar la nómina parcial, pero no podrá radicar hasta completar todos los periodos.</p>` : ""}
        </div>`;
    } else if (guardada) {
      html += `
        <div class="tarjeta mb-2">
          <div class="tarjeta-cab"><h3>Nómina guardada · versión ${guardada.version}</h3>${guardada.validacion.ok ? ui.chip("Validada", "ok") : ui.chip("Incompleta", "error")}</div>
          <p class="small muted">${esc(guardada.archivo)} · ${U.num(guardada.filas)} filas · cargada el ${U.fechaHora(guardada.cargado)}</p>
          ${resumenHtml(guardada.resumen)}
          <h4 class="mt-2">Conceptos declarados</h4>
          <p class="small">${guardada.resumen.conceptos.map((c) => ui.chip(`${c.nombre}: ${c.salarial ? "SI" : "NO"}`, c.salarial ? "info" : "")).join(" ")}</p>
          <div class="acciones mt-1"><button class="btn" data-accion="seguir">Continuar · Soportes</button></div>
        </div>`;
    }
    el.innerHTML = html;

    const revalidar = () => {
      borrador.resumen = R.resumirNomina(borrador.lectura.filas, borrador.conceptos);
      borrador.validacion = R.validarNomina({ filas: borrador.lectura.filas, conceptos: borrador.conceptos, encabezadosFaltantes: borrador.lectura.encabezadosFaltantes }, exp);
    };

    ui.activarZonas(el, async (_id, file) => {
      if (file.size > 15 * 1048576) { ui.toast("El archivo supera 15 MB.", "error"); return; }
      try {
        ui.toast("Leyendo archivo…");
        const lectura = await S21.excel.leerNomina(file);
        const nombres = [...new Set(lectura.filas.map((f) => f.concepto).filter(Boolean))];
        const conceptos = nombres.map((n) => lectura.conceptos.find((c) => c.nombre === n) || { nombre: n, salarial: null });
        borrador = { expId: exp.id, lectura, conceptos };
        revalidar();
        S21.app.render();
      } catch (err) {
        console.error(err);
        ui.toast(`No fue posible leer el archivo: ${err.message}`, "error");
      }
    });

    ui.on(el, {
      plantilla: () => S21.excel.descargarPlantilla(exp),
      ejemplo: () => { S21.excel.descargarEjemplo(exp); ui.toast("Se descargó un archivo de ejemplo con datos ficticios. Cárguelo en el paso 2."); },
      seguir: () => siguiente("soportes"),
      descartar: () => { borrador = null; S21.app.render(); },
      clasificar(sel) {
        const c = borrador.resumen.conceptos[Number(sel.dataset.i)];
        const d = borrador.conceptos.find((x) => x.nombre === c.nombre);
        d.salarial = sel.value === "SI" ? true : sel.value === "NO" ? false : null;
        revalidar();
        S21.app.render();
      },
      guardar() {
        const b = borrador;
        const lotes = st.lotesDe(exp.id);
        const version = (exp.nomina?.version || 0) + 1;
        const duplicado = lotes.find((l) => l.huella === b.lectura.huella);
        const loteId = `LOT-${exp.id.slice(-4)}-NOM-${version}`;
        st.db.lotes.push({ id: loteId, expedienteId: exp.id, origen: "ENTIDAD", tipo: "NOMINA", nombre: b.lectura.archivo, tamano: b.lectura.tamano,
          huella: b.lectura.huella, fecha: U.ahora(), cargadoPor: S21.auth.actor().nombre, version, estado: duplicado ? "DUPLICADO" : b.validacion.ok ? "VALIDADO" : "CON_ERRORES",
          filas: b.lectura.filas.length, corte: exp.periodos[exp.periodos.length - 1] });
        if (duplicado) st.crearAlerta({ tipo: "POSIBLE_DUPLICADO", expedienteId: exp.id, detalle: `El archivo ${b.lectura.archivo} tiene la misma huella que ${duplicado.nombre} (cargado el ${U.fecha(duplicado.fecha)}).` });
        if (version > 1) exp.reprocesos = (exp.reprocesos || 0) + 1;
        exp.nomina = { archivo: b.lectura.archivo, cargado: U.ahora(), version, filas: b.lectura.filas.length, resumen: b.resumen,
          validacion: { ok: b.validacion.ok, resultados: b.validacion.resultados, fecha: U.ahora() } };
        if (!b.validacion.ok) {
          st.crearAlerta({ tipo: "INFO_INCOMPLETA", expedienteId: exp.id, prioridad: "Alta",
            detalle: b.validacion.resultados.filter((r) => r.nivel === "error").map((r) => r.mensaje).join(" ") });
        }
        st.bitacora(exp.id, `Nómina cargada (versión ${version})`,
          `${b.lectura.archivo}: ${b.lectura.filas.length} registros. Conceptos salariales: ${b.resumen.conceptos.filter((c) => c.salarial).map((c) => c.nombre).join(", ")}. Resultado de calidad: ${b.validacion.ok ? "sin errores" : "con errores"}.`,
          "entidad", loteId);
        st.auditar("Carga de nómina", exp.id, `${b.lectura.archivo} · huella ${b.lectura.huella.slice(0, 12)}`);
        st.guardar();
        borrador = null;
        ui.toast(`Nómina guardada (versión ${version}).`, "ok");
        S21.app.render();
      },
    });
  }

  /* Paso 4: soportes (se registra la referencia; la versión real los enviaría al repositorio institucional) */
  function pasoSoportes(el, exp) {
    const lotes = st.lotesDe(exp.id).filter((l) => l.tipo !== "NOMINA");
    const tipos = Object.entries(S21.cat.TIPOS_DOCUMENTO).filter(([t]) => t !== "NOMINA");
    el.innerHTML = `
      <div class="tarjeta mb-2">
        <h3>Soportes requeridos</h3>
        ${ui.tabla({ columnas: [
          { t: "Documento", v: ([, d]) => `${esc(d.txt)} ${d.obligatorio ? '<span class="req" style="color:var(--error)">*</span>' : ui.chip("Opcional")}` },
          { t: "Archivos cargados", v: ([t]) => lotes.filter((l) => l.tipo === t).map((l) => `<div class="small">${esc(l.nombre)} · ${U.tamano(l.tamano)} ${l.estado === "DUPLICADO" ? ui.chip("Duplicado", "alerta") : ""}
              <button class="btn btn-txt btn-sm" data-accion="quitar" data-id="${esc(l.id)}" aria-label="Quitar ${esc(l.nombre)}">Quitar</button></div>`).join("") || '<span class="small tenue">—</span>' },
          { t: "Estado", v: ([t, d]) => (lotes.some((l) => l.tipo === t) ? ui.chip("Cargado", "ok") : d.obligatorio ? ui.chip("Pendiente", "alerta") : "") },
        ], filas: tipos })}
      </div>
      <div class="tarjeta mb-2">
        <h3>Cargar soporte</h3>
        <div class="grid grid-2">
          <div class="campo"><label for="tipo-doc">Tipo de documento</label>
            <select id="tipo-doc">${tipos.map(([t, d]) => `<option value="${t}">${esc(d.txt)}</option>`).join("")}</select></div>
          <div class="campo"><label for="periodo-doc">Periodo (opcional)</label>
            <select id="periodo-doc"><option value="">Todos los periodos</option>${exp.periodos.map((p) => `<option value="${p}">${U.periodo(p)}</option>`).join("")}</select></div>
        </div>
        ${ui.zonaCarga("archivo-soporte", "Seleccione el soporte", ".pdf,.xlsx,.xls,.csv,.jpg,.png,.zip")}
        <p class="small muted mt-1 mb-0">En el prototipo solo se registra el nombre, el tamaño y la huella del archivo. En una implementación real el documento se
        conservaría en el repositorio institucional y quedaría vinculado al expediente.</p>
      </div>
      <div class="acciones"><a class="btn btn-sec" href="#/entidad/nomina">Volver</a><button class="btn" data-accion="seguir">Continuar · Radicación</button></div>`;

    ui.activarZonas(el, async (_id, file) => {
      if (file.size > 20 * 1048576) { ui.toast("El archivo supera 20 MB.", "error"); return; }
      const tipo = el.querySelector("#tipo-doc").value;
      const periodo = el.querySelector("#periodo-doc").value;
      const huella = await U.huella(await file.arrayBuffer());
      const dup = st.lotesDe(exp.id).find((l) => l.huella === huella);
      const id = `LOT-${exp.id.slice(-4)}-${tipo}-${Date.now().toString(36).slice(-4)}`;
      st.db.lotes.push({ id, expedienteId: exp.id, origen: "ENTIDAD", tipo, nombre: file.name, tamano: file.size, huella, periodo: periodo || null,
        fecha: U.ahora(), cargadoPor: S21.auth.actor().nombre, version: 1, estado: dup ? "DUPLICADO" : "RECIBIDO", filas: null });
      if (dup) st.crearAlerta({ tipo: "POSIBLE_DUPLICADO", expedienteId: exp.id, detalle: `El soporte ${file.name} es idéntico a ${dup.nombre}.` });
      st.bitacora(exp.id, "Soporte cargado", `${S21.cat.TIPOS_DOCUMENTO[tipo].txt}: ${file.name}${periodo ? ` (${U.periodo(periodo)})` : ""}.`, "entidad", id);
      st.auditar("Carga de soporte", exp.id, `${file.name} · ${tipo}`);
      st.guardar();
      ui.toast(dup ? "Soporte cargado, pero es idéntico a otro ya cargado." : "Soporte cargado.", dup ? "" : "ok");
      S21.app.render();
    });
    ui.on(el, {
      seguir: () => siguiente("radicar"),
      quitar(b) {
        const i = st.db.lotes.findIndex((l) => l.id === b.dataset.id);
        const l = st.db.lotes[i];
        st.db.lotes.splice(i, 1);
        st.bitacora(exp.id, "Soporte retirado antes de radicar", l.nombre, "entidad");
        st.guardar();
        S21.app.render();
      },
    });
  }

  /* Paso 5: radicación */
  function pasoRadicar(el, exp, ent, av) {
    const listo = av.registro && av.nomina && av.soportes;
    const item = (ok, txt, href) => `<li class="mb-1">${ok ? ui.chip("Listo", "ok") : ui.chip("Pendiente", "alerta")} ${txt} ${ok ? "" : `<a href="${href}" class="small">Completar</a>`}</li>`;
    el.innerHTML = `
      <div class="tarjeta">
        <h3>Verificación antes de radicar</h3>
        <ul style="list-style:none;padding:0">
          ${item(av.registro, "Datos del representante legal y del responsable de la información.", "#/entidad/registro")}
          ${item(av.nomina, `Nómina de los ${exp.periodos.length} periodos, sin errores y con todos los conceptos clasificados.`, "#/entidad/nomina")}
          ${item(av.soportes, "PILA, comprobantes de pago y certificación de factores salariales.", "#/entidad/soportes")}
        </ul>
        <label class="flex gap-1 items-center small mb-2"><input type="checkbox" id="declara" ${listo ? "" : "disabled"}>
          Declaro que la información cargada es veraz, corresponde a la nómina de la entidad y que la clasificación de factores salariales es la aplicada en la liquidación.</label>
        <div class="acciones"><a class="btn btn-sec" href="#/entidad/soportes">Volver</a>
          <button class="btn btn-grande" data-accion="radicar" ${listo ? "" : "disabled"}>Radicar información</button></div>
      </div>`;
    ui.on(el, {
      radicar() {
        if (!el.querySelector("#declara").checked) { ui.toast("Debe aceptar la declaración para radicar.", "error"); return; }
        exp.radicado = { fecha: U.ahora(), numero: `RAD-E-2026-${exp.id.slice(-4)}${exp.reprocesos ? "-" + (exp.reprocesos + 1) : ""}` };
        exp.estado = "RECIBIDO";
        exp.devolucion = null;
        st.bitacora(exp.id, "Información radicada por la entidad", `Radicado ${exp.radicado.numero}. Declaración de veracidad aceptada.`, "entidad");
        st.crearAlerta({ tipo: "LISTO_VALIDACION", expedienteId: exp.id, detalle: `${ent.nombre} radicó la información del expediente ${exp.id} (${exp.radicado.numero}).` });
        if (new Date(U.ahora()) > new Date(exp.fechaLimite)) {
          st.crearAlerta({ tipo: "FUERA_DE_PLAZO", expedienteId: exp.id, detalle: `La entidad radicó después del plazo (${U.fecha(exp.fechaLimite)}).` });
        }
        if (exp.responsableId) st.notificar(exp.responsableId, `Expediente ${exp.id} radicado`, `${ent.nombre} radicó la información.`, exp.id);
        st.auditar("Radicación", exp.id, exp.radicado.numero);
        st.guardar();
        ui.toast("Información radicada. La ESAP fue notificada.", "ok");
        S21.app.render();
      },
    });
  }

  /* Estado del trámite (después de radicar) */
  function pasoEstado(el, exp, ent) {
    const hitos = st.db.bitacora.filter((b) => b.expedienteId === exp.id && (b.tipo === "entidad" || /Requerimiento|radicad|Calidad|Conciliación ejecutada|Mesa técnica|Resultado|devuelta/i.test(b.accion)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    el.innerHTML = `
      <div class="grid grid-2">
        <div class="tarjeta">
          <h3>Constancia de radicación</h3>
          ${exp.radicado ? `<dl class="dl"><dt>Radicado</dt><dd>${esc(exp.radicado.numero)}</dd><dt>Fecha</dt><dd>${U.fechaHora(exp.radicado.fecha)}</dd>
            <dt>Nómina</dt><dd>${esc(exp.nomina?.archivo || "—")} (v${exp.nomina?.version || "—"})</dd>
            <dt>Soportes</dt><dd>${st.lotesDe(exp.id).filter((l) => l.tipo !== "NOMINA").length} archivo(s)</dd></dl>` : '<p class="muted">Sin radicar.</p>'}
          <div class="acciones mt-2 no-imprimir"><button class="btn btn-sec btn-sm" data-accion="imprimir">Imprimir constancia</button></div>
        </div>
        <div class="tarjeta">
          <h3>Estado del trámite</h3>
          <p>${ui.chipEstadoExp(exp.estado)}</p>
          <p class="small muted">${esc(S21.cat.ESTADOS_EXPEDIENTE[exp.estado].desc)} La ESAP le informará por correo cualquier solicitud adicional.
          ${exp.estado === "MESA_TECNICA" && exp.mesa ? `<br><b>Mesa técnica programada:</b> ${U.fecha(exp.mesa.fecha)} ${esc(exp.mesa.hora)} · ${esc(exp.mesa.modalidad)}.` : ""}</p>
        </div>
        <div class="tarjeta span-2">
          <h3>Actuaciones del expediente</h3>
          <ul class="linea-tiempo">${hitos.map((h) => `<li class="${h.tipo}"><div class="cuando">${U.fechaHora(h.fecha)}</div><div class="que">${esc(h.accion)}</div><div class="det">${esc(h.detalle)}</div></li>`).join("")}</ul>
        </div>
      </div>`;
    ui.on(el, { imprimir: () => window.print() });
  }
})();
