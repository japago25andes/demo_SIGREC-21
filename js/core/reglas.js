/* Motor de reglas versionadas: calidad (módulo 3), asociación (módulo 4) y conciliación (módulo 5).
   Los resultados son INDICIOS informativos sujetos a revisión humana; no producen por sí mismos
   efectos jurídicos, contables o administrativos. */
S21.reglas = (function () {
  const U = S21.util;
  const st = () => S21.store;

  const CLASIFICACION = {
    CONCILIADO: { txt: "Conciliado", chip: "ok", indicio: "Sin diferencia por encima de la tolerancia" },
    PAGO_EXTEMPORANEO: { txt: "Pago extemporáneo", chip: "alerta", indicio: "Indicio de mora (intereses)" },
    MENOR_VALOR: { txt: "Menor valor pagado", chip: "error", indicio: "Indicio de inexactitud" },
    SIN_PAGO: { txt: "Sin pago registrado", chip: "error", indicio: "Indicio de omisión" },
    MAYOR_VALOR: { txt: "Mayor valor pagado", chip: "info", indicio: "Posible saldo a favor del aportante" },
  };

  const version = (codigo) => { const r = st().regla(codigo); return r ? `${r.codigo} v${r.version}` : codigo; };

  /* ---------- Nómina ---------- */

  /* Totales por periodo y concepto a partir de las filas cargadas */
  function resumirNomina(filas, conceptosDeclarados) {
    const periodos = {};
    const totConcepto = {};
    filas.forEach((f) => {
      const p = (periodos[f.periodo] = periodos[f.periodo] || { docs: new Set(), porConcepto: {} });
      p.docs.add(f.documento);
      p.porConcepto[f.concepto] = (p.porConcepto[f.concepto] || 0) + f.valor;
      totConcepto[f.concepto] = (totConcepto[f.concepto] || 0) + f.valor;
    });
    const nombres = new Set([...conceptosDeclarados.map((c) => c.nombre), ...Object.keys(totConcepto)]);
    const conceptos = [...nombres].map((n) => {
      const d = conceptosDeclarados.find((c) => c.nombre === n);
      return { nombre: n, salarial: d ? d.salarial : null, total: totConcepto[n] || 0 };
    });
    const salida = {};
    Object.entries(periodos).forEach(([per, p]) => {
      salida[per] = { empleados: p.docs.size, porConcepto: p.porConcepto, devengado: Object.values(p.porConcepto).reduce((s, v) => s + v, 0) };
    });
    return { conceptos, periodos: salida, filas: filas.length };
  }

  function baseSalarial(resumen, per) {
    const pc = resumen.periodos[per]?.porConcepto || {};
    return Object.entries(pc).reduce((s, [c, v]) => (resumen.conceptos.find((x) => x.nombre === c)?.salarial ? s + v : s), 0);
  }

  function aporteEsperado(base) {
    const tasa = st().param("R01");
    return Math.ceil((base * tasa) / 100) * 100; // R02: aproximación a la centena superior
  }

  /* Validación de integridad, completitud, formato, duplicidad y clasificación (módulo 3) */
  function validarNomina({ filas, conceptos, encabezadosFaltantes = [] }, exp) {
    const res = [];
    const add = (regla, nivel, mensaje, detalle) => res.push({ regla, nivel, mensaje, detalle: detalle || [] });

    if (encabezadosFaltantes.length) {
      add("R-V01", "error", `Faltan columnas obligatorias en la hoja Nómina: ${encabezadosFaltantes.join(", ")}.`);
      return { ok: false, resultados: res };
    }
    if (!filas.length) {
      add("R-V01", "error", "La hoja Nómina no contiene registros.");
      return { ok: false, resultados: res };
    }

    const incompletas = filas.filter((f) => !f.periodo || !f.documento || !f.nombre || !f.concepto || f.valor === null || isNaN(f.valor));
    if (incompletas.length) add("R-V01", "error", `${incompletas.length} fila(s) con campos obligatorios vacíos o valor no numérico.`, incompletas.slice(0, 8).map((f) => `Fila ${f._fila}`));
    else add("R-V01", "ok", "Todas las filas tienen los campos obligatorios (periodo, documento, nombre, concepto, valor).");

    const malPeriodo = filas.filter((f) => f.periodo && !/^\d{4}-(0[1-9]|1[0-2])$/.test(f.periodo));
    if (malPeriodo.length) add("R-V02", "error", `${malPeriodo.length} fila(s) con periodo en formato distinto a AAAA-MM.`, malPeriodo.slice(0, 8).map((f) => `Fila ${f._fila}: "${f.periodo}"`));
    else add("R-V02", "ok", "Formato de periodo AAAA-MM correcto.");

    const presentes = new Set(filas.map((f) => f.periodo));
    const fuera = [...presentes].filter((p) => /^\d{4}-\d{2}$/.test(p) && !exp.periodos.includes(p));
    if (fuera.length) add("R-V03", "advertencia", `Se cargaron periodos no requeridos (${fuera.map(U.periodo).join(", ")}); no se tendrán en cuenta en la conciliación.`);
    const faltan = exp.periodos.filter((p) => !presentes.has(p));
    if (faltan.length) add("R-V04", "error", `Faltan periodos requeridos: ${faltan.map(U.periodo).join(", ")}.`);
    else add("R-V04", "ok", `Están los ${exp.periodos.length} periodos requeridos.`);

    const vistos = new Map();
    const dup = [];
    filas.forEach((f) => {
      const k = `${f.periodo}|${f.documento}|${U.normalizar(f.concepto)}`;
      if (vistos.has(k)) dup.push(`Fila ${f._fila} repite la fila ${vistos.get(k)} (${f.documento} · ${f.concepto} · ${U.periodo(f.periodo)})`);
      else vistos.set(k, f._fila);
    });
    if (dup.length) add("R-V05", "advertencia", `${dup.length} posible(s) registro(s) duplicado(s) (mismo periodo, documento y concepto).`, dup.slice(0, 8));
    else add("R-V05", "ok", "No se detectaron registros duplicados.");

    const enFilas = [...new Set(filas.map((f) => f.concepto))];
    const sinClasificar = enFilas.filter((c) => { const d = conceptos.find((x) => x.nombre === c); return !d || d.salarial === null; });
    if (sinClasificar.length) add("R-V06", "error", `Conceptos sin clasificar como factor salarial (SI/NO): ${sinClasificar.join(", ")}.`);
    else add("R-V06", "ok", `Los ${enFilas.length} conceptos de nómina están clasificados como factor salarial o no salarial.`);

    const negativos = filas.filter((f) => f.valor !== null && f.valor <= 0);
    if (negativos.length) add("R-V07", "advertencia", `${negativos.length} fila(s) con valor cero o negativo.`, negativos.slice(0, 8).map((f) => `Fila ${f._fila}`));

    const docRaro = filas.filter((f) => f.documento && !/^\d{5,12}$/.test(f.documento));
    if (docRaro.length) add("R-V08", "advertencia", `${docRaro.length} fila(s) con número de documento no numérico o de longitud inusual.`, docRaro.slice(0, 8).map((f) => `Fila ${f._fila}: ${f.documento}`));

    return { ok: !res.some((r) => r.nivel === "error"), resultados: res };
  }

  /* ---------- Asociación y cruce (módulo 4) ---------- */

  function asociarPagos() {
    const db = st().db;
    const stats = { asociados: 0, sinAsociacion: 0, nitCompartido: 0, duplicados: 0 };
    const firmas = new Map();
    const grupos = {}; // una alerta por NIT, no por cada pago
    const agrupar = (tipo, p) => { const k = `${tipo}|${p.nit}`; (grupos[k] = grupos[k] || { tipo, nit: p.nit, pagos: [] }).pagos.push(p); };
    db.pagos.forEach((p) => {
      if (p.estadoAsociacion === "DUPLICADO") return;
      const k = `${p.fuente}|${p.nit}|${p.periodo}|${p.planilla}|${p.valor}`;
      if (firmas.has(k) && p.estadoAsociacion === "PENDIENTE" && !p.noDuplicado) {
        p.estadoAsociacion = "DUPLICADO";
        p.metodoAsociacion = `Duplica a ${firmas.get(k)}`;
        stats.duplicados++;
        st().crearAlerta({ tipo: "POSIBLE_DUPLICADO", pagoId: p.id, periodo: p.periodo,
          detalle: `Registro ${p.referencia} (${S21.cat.FUENTES_PAGO[p.fuente]}) del NIT ${p.nit}, periodo ${U.periodo(p.periodo)}, por ${U.pesos(p.valor)} aparece dos veces.` });
        return;
      }
      firmas.set(k, p.referencia);
      if (p.estadoAsociacion !== "PENDIENTE") return;
      if (!p.periodo) {
        p.estadoAsociacion = "SIN_ASOCIACION";
        st().crearAlerta({ tipo: "SIN_PERIODO", pagoId: p.id, detalle: `El registro ${p.referencia} no tiene periodo de cotización.` });
        stats.sinAsociacion++;
        return;
      }
      const cand = st().entidadesPorNit(p.nit);
      if (cand.length === 1) {
        p.entidadId = cand[0].id;
        p.estadoAsociacion = "ASOCIADO";
        p.metodoAsociacion = `Automática por NIT (${version("R08")})`;
        stats.asociados++;
      } else if (cand.length > 1) {
        p.estadoAsociacion = "NIT_COMPARTIDO";
        stats.nitCompartido++;
        agrupar("NIT_COMPARTIDO", p);
      } else {
        p.estadoAsociacion = "SIN_ASOCIACION";
        stats.sinAsociacion++;
        agrupar("PAGO_SIN_ASOCIACION", p);
      }
    });
    Object.values(grupos).forEach((g) => {
      const total = U.sumar(g.pagos, (p) => p.valor);
      const periodos = [...new Set(g.pagos.map((p) => p.periodo))].sort().map(U.periodo).join(", ");
      const n = st().entidadesPorNit(g.nit).length;
      st().crearAlerta({
        tipo: g.tipo, nit: g.nit, prioridad: g.tipo === "PAGO_SIN_ASOCIACION" ? "Alta" : "Media",
        detalle: g.tipo === "NIT_COMPARTIDO"
          ? `${g.pagos.length} registro(s) por ${U.pesos(total)} (${periodos}) se reportaron con el NIT ${g.nit}, compartido por ${n} entidades. Deben distribuirse.`
          : `${g.pagos.length} registro(s) por ${U.pesos(total)} (${periodos}) tienen el NIT ${g.nit}, que no existe en el maestro de entidades.`,
      });
    });
    return stats;
  }

  /* Cierra la alerta agrupada de un NIT cuando ya no quedan pagos pendientes con ese NIT */
  function cerrarAlertasNit(nit, nota) {
    const quedan = st().db.pagos.some((p) => p.nit === nit && ["SIN_ASOCIACION", "NIT_COMPARTIDO"].includes(p.estadoAsociacion));
    if (quedan) return;
    st().db.alertas.filter((a) => a.nit === nit && ["ABIERTA", "EN_GESTION"].includes(a.estado)).forEach((a) => st().cambiarEstadoAlerta(a, "CERRADA", nota));
  }

  function asociarManual(pago, entidadId, motivo) {
    const ent = st().entidad(entidadId);
    pago.entidadId = entidadId;
    pago.estadoAsociacion = "ASOCIADO";
    pago.metodoAsociacion = `Manual: ${motivo}`;
    st().auditar("Asociación manual de pago", pago.referencia, `Asociado a ${ent.nombre} (NIT ${ent.nit}). Motivo: ${motivo}`);
    // Si el pago tiene par (mismo periodo y planilla en otra fuente) se asocia igual
    st().db.pagos.filter((p) => p !== pago && p.planilla === pago.planilla && p.periodo === pago.periodo && !p.estadoAsociacion.startsWith("DUPLICADO"))
      .forEach((p) => { p.entidadId = entidadId; p.estadoAsociacion = "ASOCIADO"; p.metodoAsociacion = `Manual (par de ${pago.referencia})`; });
    cerrarAlertasNit(pago.nit, `Pagos del NIT ${pago.nit} asociados manualmente.`);
  }

  /* Asocia en bloque todos los pagos pendientes de un NIT mal digitado a una entidad */
  function asociarNit(nit, entidadId, motivo) {
    const pend = st().db.pagos.filter((p) => p.nit === nit && p.estadoAsociacion === "SIN_ASOCIACION");
    pend.forEach((p) => { p.entidadId = entidadId; p.estadoAsociacion = "ASOCIADO"; p.metodoAsociacion = `Manual en bloque: ${motivo}`; });
    st().auditar("Asociación manual en bloque", `NIT ${nit}`, `${pend.length} pagos → ${st().entidad(entidadId).nombre}. ${motivo}`);
    cerrarAlertasNit(nit, `Pagos asociados a ${st().entidad(entidadId).nombre}.`);
    return pend.length;
  }

  /* ---------- Conciliación (módulo 5) ---------- */

  function fechaLimite(nit, per) {
    const ult2 = Number(String(nit).replace(/\D/g, "").slice(-2)) || 0;
    return U.diaHabilMesSiguiente(per, 2 + Math.floor(ult2 / 7)); // R05 simplificada
  }

  function conciliar(exp) {
    const ent = st().entidad(exp.entidadId);
    const resumen = exp.nomina?.resumen;
    if (!resumen) throw new Error("El expediente no tiene nómina validada.");
    const tol = st().param("R03");
    const anteriores = exp.conciliacion?.filas || [];
    const pagos = st().pagosDeEntidad(exp.entidadId, exp.periodos).filter((p) => p.estadoAsociacion === "ASOCIADO");

    const filas = exp.periodos.map((per) => {
      const base = baseSalarial(resumen, per);
      const esperado = aporteEsperado(base);
      const delPer = pagos.filter((p) => p.periodo === per);
      const reportado = U.sumar(delPer.filter((p) => p.fuente === "PILA_A" || p.fuente === "PILA_I"), (p) => p.valor);
      const recaudoPagos = delPer.filter((p) => p.fuente === "LOG_FIN" || p.fuente === "CARGA_MANUAL");
      const recaudado = U.sumar(recaudoPagos, (p) => p.valor);
      const fechaPago = recaudoPagos.map((p) => p.fecha).sort()[0] || null;
      const limite = fechaLimite(ent.nit, per);
      const diferencia = esperado - recaudado;
      let clas = "CONCILIADO";
      if (esperado > 0 && recaudado === 0) clas = "SIN_PAGO";
      else if (diferencia > tol) clas = "MENOR_VALOR";
      else if (diferencia < -tol) clas = "MAYOR_VALOR";
      else if (fechaPago && fechaPago > limite) clas = "PAGO_EXTEMPORANEO";
      const previa = anteriores.find((f) => f.periodo === per && f.clasificacion === clas && Math.abs(f.diferencia - diferencia) <= tol);
      return {
        periodo: per, empleados: resumen.periodos[per]?.empleados || 0, devengado: resumen.periodos[per]?.devengado || 0,
        base, esperado, reportado, recaudado, diferencia, fechaPago, limite,
        diasMora: fechaPago && fechaPago > limite ? U.diasEntre(limite, fechaPago) : clas === "SIN_PAGO" ? U.diasEntre(limite, U.ahora()) : 0,
        clasificacion: clas, pagos: delPer.map((p) => p.referencia),
        revision: previa?.revision || (clas === "CONCILIADO" ? { estado: "NO_REQUIERE" } : { estado: "PENDIENTE" }),
      };
    });

    const totales = {
      base: U.sumar(filas, (f) => f.base), esperado: U.sumar(filas, (f) => f.esperado),
      reportado: U.sumar(filas, (f) => f.reportado), recaudado: U.sumar(filas, (f) => f.recaudado),
      diferencia: U.sumar(filas, (f) => f.diferencia),
      aFavorEsap: U.sumar(filas.filter((f) => f.diferencia > tol), (f) => f.diferencia),
    };
    totales.material = totales.aFavorEsap >= st().param("R04");

    exp.conciliacion = {
      fecha: U.ahora(), por: S21.auth.actor().nombre,
      reglas: ["R01", "R02", "R03", "R04", "R05"].map(version), filas, totales,
    };
    const conDif = filas.filter((f) => f.clasificacion !== "CONCILIADO");
    exp.estado = conDif.length ? "CON_DIFERENCIA" : "CONCILIADO";

    conDif.forEach((f) => {
      st().crearAlerta({
        tipo: "DIFERENCIA_VALORES", expedienteId: exp.id, periodo: f.periodo,
        prioridad: Math.abs(f.diferencia) >= st().param("R04") || f.clasificacion === "SIN_PAGO" ? "Alta" : "Media",
        detalle: `${U.periodo(f.periodo)}: ${CLASIFICACION[f.clasificacion].txt}. Esperado ${U.pesos(f.esperado)}, recaudado ${U.pesos(f.recaudado)}, diferencia ${U.pesos(f.diferencia)}.`,
      });
    });
    if (conDif.length && !exp.responsableId) {
      st().crearAlerta({ tipo: "SIN_RESPONSABLE", expedienteId: exp.id, detalle: `El expediente ${exp.id} tiene diferencias y no tiene responsable asignado.` });
    }
    st().bitacora(exp.id, "Conciliación ejecutada",
      `${filas.length} periodos conciliados con ${exp.conciliacion.reglas.join(", ")}. ${conDif.length} periodo(s) con indicio de diferencia; total a favor de la ESAP ${U.pesos(totales.aFavorEsap)}.`);
    st().auditar("Conciliación", exp.id, `Resultado: ${S21.cat.ESTADOS_EXPEDIENTE[exp.estado].txt}`);
    return exp.conciliacion;
  }

  /* ---------- Indicadores de trazabilidad (sección 14.2) ---------- */

  function trazabilidad(exp) {
    const c = {
      fuente: !!exp.nomina && st().pagosDeEntidad(exp.entidadId, exp.periodos).some((p) => p.estadoAsociacion === "ASOCIADO"),
      responsable: !!exp.responsableId,
      soporte: st().lotesDe(exp.id).length > 0,
      regla: !!exp.conciliacion,
      decision: exp.estado === "CERRADO" || (exp.conciliacion?.filas || []).every((f) => f.revision.estado !== "PENDIENTE"),
    };
    c.completa = Object.values(c).every(Boolean);
    return c;
  }

  return { CLASIFICACION, resumirNomina, baseSalarial, aporteEsperado, validarNomina, asociarPagos, asociarManual, asociarNit, fechaLimite, conciliar, trazabilidad, version };
})();
