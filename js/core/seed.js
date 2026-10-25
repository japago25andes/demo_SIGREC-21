/* Datos de demostración FICTICIOS. Reproducen los 8 casos de referencia del diseño del piloto
   (Propuesta técnica, sección 13) más un caso en vivo para recorrer el flujo completo. */
S21.seed = (function () {
  const VERSION = "2026.10.4";
  const U = S21.util;
  const PERIODOS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

  /* Credencial de la demostración en vivo (también se muestra en la página de inicio) */
  const DEMO = { expediente: "SG21-2026-0009", usuario: "SG21-0009", clave: "VsR7q2Kp9m", semilla: 909 };

  function reglasIniciales(desde) {
    return [
      { codigo: "R01", nombre: "Tarifa del aporte a la ESAP", valor: 0.005, unidad: "proporción", version: "1.0", desde,
        descripcion: "0,5 % de la nómina mensual de salarios (Ley 21 de 1982, art. 12) para la Nación, departamentos, distritos y municipios." },
      { codigo: "R02", nombre: "Aproximación del aporte", valor: 100, unidad: "pesos", version: "1.0", desde,
        descripcion: "El aporte esperado se aproxima a la centena superior, como en la planilla PILA (Decreto 1990 de 2016)." },
      { codigo: "R03", nombre: "Tolerancia de conciliación", valor: 1000, unidad: "pesos", version: "1.0", desde,
        descripcion: "Diferencias absolutas iguales o menores a este valor se consideran conciliadas." },
      { codigo: "R04", nombre: "Umbral de diferencia material", valor: 500000, unidad: "pesos", version: "1.0", desde,
        descripcion: "Total de diferencias a favor de la ESAP a partir del cual procede la mesa técnica." },
      { codigo: "R05", nombre: "Fecha límite de pago", valor: 2, unidad: "día hábil base", version: "1.0", desde,
        descripcion: "Día hábil del mes siguiente según los dos últimos dígitos del NIT (regla simplificada del prototipo, sin festivos)." },
      { codigo: "R06", nombre: "Plazo de respuesta al requerimiento", valor: 15, unidad: "días calendario", version: "1.0", desde,
        descripcion: "Vigencia de la credencial temporal y plazo para radicar la información." },
      { codigo: "R07", nombre: "Meses de nómina requeridos", valor: 6, unidad: "meses", version: "1.0", desde,
        descripcion: "Número de periodos de nómina que se solicitan por requerimiento." },
      { codigo: "R08", nombre: "Asociación automática", valor: 1, unidad: "coincidencia", version: "1.0", desde,
        descripcion: "Un pago se asocia automáticamente cuando su NIT coincide con una única entidad del maestro." },
    ].map((r) => ({ ...r, historial: [{ version: r.version, valor: r.valor, desde: r.desde, por: "Configuración inicial", motivo: "Parámetros del prototipo" }] }));
  }

  const USUARIOS = [
    { id: "u1", nombre: "Laura Méndez Ríos", rol: "gestor", dt: "Sede Central", cargo: "Profesional · Grupo de Recaudo y Cartera" },
    { id: "u2", nombre: "Andrés Palacios Gil", rol: "conciliador", dt: "Sede Central", cargo: "Profesional · Grupo de Recaudo y Cartera" },
    { id: "u3", nombre: "Carolina Ruiz Duarte", rol: "revisor", dt: "Sede Central", cargo: "Profesional especializada · Recaudo y Cartera" },
    { id: "u4", nombre: "Martha Lucía Ortega", rol: "validador", dt: "Sede Central", cargo: "Coordinación · Grupo de Recaudo y Cartera" },
    { id: "u5", nombre: "Felipe Rangel Soto", rol: "admin_funcional", dt: "Sede Central", cargo: "Dirección Financiera" },
    { id: "u6", nombre: "Diana Quiroga Pardo", rol: "apoyo", dt: "Nariño", cargo: "Profesional · Dirección Territorial Nariño" },
    { id: "u7", nombre: "Jorge Iván Castro", rol: "consulta", dt: "Sede Central", cargo: "Dirección Financiera" },
    { id: "u8", nombre: "Sandra Milena Vélez", rol: "auditor", dt: "Sede Central", cargo: "Oficina de Control Interno" },
    { id: "u9", nombre: "Óscar Beltrán Niño", rol: "admin_tecnico", dt: "Sede Central", cargo: "Oficina de Tecnologías de la Información (OTIC)" },
  ].map((u) => ({ ...u, activo: true, correo: `${U.normalizar(u.nombre).split(" ")[0].toLowerCase()}.demo@ejemplo.edu.co` }));

  function entidad(id, nombre, nit, tipo, dt, depto, extra = {}) {
    return {
      id, nombre, nit, dv: String((Number(nit.slice(-3)) * 7) % 10), tipo, dt, departamento: depto, estado: "Activa",
      representante: { nombre: "", documento: "", cargo: "" },
      responsable: { nombre: "", cargo: "", correo: "", telefono: "" },
      fuenteDatos: "Base de aportantes SISPRO-PISIS (ficticia)", actualizado: null, ...extra,
    };
  }

  const ENTIDADES = [
    entidad("E01", "Municipio de Villa Esperanza", "800111201", "Municipio", "Nariño", "Nariño"),
    entidad("E02", "Municipio de San Rafael del Monte", "800111202", "Municipio", "Antioquia", "Antioquia"),
    entidad("E03", "Departamento de Nueva Andina", "800111203", "Departamento", "Sede Central", "Nueva Andina"),
    entidad("E04", "Municipio de Puerto Laurel", "800111204", "Municipio", "Bolívar", "Bolívar"),
    entidad("E05", "Municipio de El Encanto Alto", "800111205", "Municipio", "Boyacá", "Boyacá"),
    entidad("E06", "Municipio de Santa Clara de los Llanos", "800111206", "Municipio", "Meta", "Meta"),
    entidad("E07", "Municipio de La Ensenada", "800111207", "Municipio", "Atlántico", "Atlántico"),
    entidad("E08", "Ministerio de Asuntos Rurales (ficticio)", "800111208", "Entidad del orden nacional", "Sede Central", "Bogotá D. C."),
    entidad("E09", "Municipio de Valle Sereno", "800111209", "Municipio", "Valle del Cauca", "Valle del Cauca"),
    entidad("E10", "Batallón de Ingenieros N.º 9 (ficticio)", "800111210", "Fuerza Pública", "Sede Central", "Cundinamarca"),
    entidad("E11", "Distrito de Ficticia · Secretaría de Hacienda", "899999001", "Distrito", "Cundinamarca", "Distrito de Ficticia", { nitCompartido: true }),
    entidad("E12", "Distrito de Ficticia · Secretaría de Movilidad", "899999001", "Distrito", "Cundinamarca", "Distrito de Ficticia", { nitCompartido: true }),
    entidad("E13", "Distrito de Ficticia · Concejo Distrital", "899999001", "Concejo / Contraloría / Personería", "Cundinamarca", "Distrito de Ficticia", { nitCompartido: true }),
    entidad("E14", "Municipio de Altamira del Sur", "800111214", "Municipio", "Cauca", "Cauca"),
    entidad("E15", "Contraloría Municipal de Puerto Laurel", "800111215", "Concejo / Contraloría / Personería", "Bolívar", "Bolívar"),
    entidad("E16", "Municipio de Río Claro", "800111216", "Municipio", "Tolima", "Tolima"),
    entidad("E17", "Municipio de Las Palmas", "800111217", "Municipio", "Santander", "Santander"),
    entidad("E18", "Departamento del Alto Cauce", "800111218", "Departamento", "Sede Central", "Alto Cauce"),
  ];

  /* Ejecuta fn como si ocurriera en la fecha indicada (para historia verosímil de los casos) */
  function enFecha(iso, fn) {
    const original = U.ahora;
    U.ahora = () => iso;
    try { return fn(); } finally { U.ahora = original; }
  }
  const hace = (dias, horas = 9) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(horas, 15 + (dias % 40), 0, 0); return d.toISOString(); };

  function crear() {
    const ahora = new Date().toISOString();
    const db = {
      version: VERSION, creado: ahora,
      secuencias: { expediente: 11, alerta: 1 },
      usuarios: USUARIOS.map((u) => ({ ...u })),
      entidades: ENTIDADES.map((e) => JSON.parse(JSON.stringify(e))),
      reglas: reglasIniciales(hace(120).slice(0, 10)),
      expedientes: [], lotes: [], pagos: [], alertas: [], bitacora: [], auditoria: [], notificaciones: [], insumoSigip: [],
    };
    S21.store.db = db; // las funciones del motor operan sobre esta instancia
    const st = S21.store;
    const R = S21.reglas;
    const gen = S21.gen;

    /* --- Nóminas y pagos de fuentes autorizadas --- */
    const nominas = {};
    const perfil = {
      E01: { semilla: 101, empleados: 26, escenario: {} },
      E02: { semilla: 202, empleados: 34, escenario: { nitPago: "800111220" } },
      E03: { semilla: 303, empleados: 60, escenario: { parcial: { "2026-05": 0.55, "2026-06": 0.55 } } },
      E04: { semilla: 404, empleados: 41, escenario: { excluir: ["PRIMA TECNICA", "GASTOS DE REPRESENTACION"] } },
      E05: { semilla: 505, empleados: 22, escenario: { duplicar: ["2026-03"] } },
      E06: { semilla: 606, empleados: 18, escenario: {} },
      E07: { semilla: 707, empleados: 29, escenario: {} },
      E08: { semilla: 808, empleados: 70, escenario: {} },
      E09: { semilla: DEMO.semilla, empleados: 32, escenario: { excluir: ["PRIMA TECNICA"], faltantes: ["2026-05"], tarde: ["2026-06"] } },
      E10: { semilla: 1010, empleados: 55, escenario: { faltantes: ["2026-06"] } },
      E11: { semilla: 1111, empleados: 48, escenario: { parcial: { "2026-04": 0.2, "2026-05": 0.2, "2026-06": 0.2 } } },
      E14: { semilla: 1414, empleados: 24, escenario: { parcial: { "2026-02": 0.96 } } },
      E15: { semilla: 1515, empleados: 12, escenario: {} },
      E16: { semilla: 1616, empleados: 30, escenario: { faltantes: ["2026-04", "2026-05", "2026-06"] } },
      E17: { semilla: 1717, empleados: 21, escenario: { tarde: ["2026-02"] } },
      E18: { semilla: 1818, empleados: 52, escenario: {} },
    };
    Object.entries(perfil).forEach(([eid, p]) => {
      const ent = db.entidades.find((e) => e.id === eid);
      const n = gen.generarNomina({ semilla: p.semilla, empleados: p.empleados, periodos: PERIODOS });
      const resumen = R.resumirNomina(n.filas, n.conceptos);
      nominas[eid] = { ...n, resumen };
      db.pagos.push(...gen.generarPagos({ entidad: ent, periodos: PERIODOS, resumen, escenario: p.escenario, semilla: p.semilla + 1 }));
    });
    // Pago con NIT inexistente sin periodo claro: insumo para "registro sin entidad"
    db.pagos.push({ id: U.uid("pag"), fuente: "LOG_FIN", nit: "800999999", periodo: "2026-03", planilla: "8000000999", referencia: "ASO-000999",
      fecha: "2026-04-08", valor: 412300, entidadId: null, estadoAsociacion: "PENDIENTE", metodoAsociacion: null, loteId: "LOTE-LOG-2026" });

    db.lotes.push(
      { id: "LOTE-PILA-2026", expedienteId: null, origen: "ESAP", tipo: "PILA_A", nombre: "pila_tipoA_2026-01_a_2026-06.txt", tamano: 1843200,
        huella: "a91f3c0d2e7b4c55", fecha: hace(70), cargadoPor: "Laura Méndez Ríos", version: 1, estado: "VALIDADO", corte: "2026-07-31",
        filas: db.pagos.filter((p) => p.fuente === "PILA_A").length, nota: "Descarga del operador de información (insumo institucional)" },
      { id: "LOTE-LOG-2026", expedienteId: null, origen: "ESAP", tipo: "LOG_FIN", nombre: "log_asobancaria_2026-01_a_2026-07.txt", tamano: 924100,
        huella: "5be04d77a1c2f9e0", fecha: hace(70), cargadoPor: "Andrés Palacios Gil", version: 1, estado: "VALIDADO", corte: "2026-07-31",
        filas: db.pagos.filter((p) => p.fuente === "LOG_FIN").length, nota: "Recaudo reportado por el operador financiero" },
    );

    enFecha(hace(68), () => R.asociarPagos());

    /* --- Insumo SIGIP / Power BI: presuntos omisos o morosos (entrada de SIGREC-21) --- */
    const insumos = [
      ["E01", "Dispersión", "Variación del aporte superior al 30 % entre periodos consecutivos.", 75, "REQUERIDO"],
      ["E02", "Omisión aparente", "No se observan pagos asociados al NIT en el semestre.", 70, "REQUERIDO"],
      ["E04", "Disminución", "El aporte es inferior al de entidades de tamaño similar.", 60, "REQUERIDO"],
      ["E05", "Dispersión", "Registros repetidos en marzo de 2026.", 50, "REQUERIDO"],
      ["E06", "Dispersión", "Variación atípica en el número de cotizantes.", 40, "REQUERIDO"],
      ["E07", "Disminución", "Disminución sostenida del aporte desde marzo.", 38, "REQUERIDO"],
      ["E14", "Disminución", "Aporte de febrero menor que el promedio del semestre.", 66, "REQUERIDO"],
      ["E16", "Omisión aparente", "Sin pagos visibles desde abril de 2026.", 72, "REQUERIDO"],
      ["E09", "Omisión aparente", "Sin pago visible en mayo de 2026 y variación en el valor del aporte.", 12, "REQUERIDO"],
      ["E17", "Dispersión", "Pago de febrero registrado fuera de la fecha habitual.", 35, "REQUERIDO"],
      ["E03", "Disminución", "El aporte de mayo y junio bajó cerca de 45 % frente a abril.", 6, "PENDIENTE"],
      ["E11", "Disminución", "Sobre el NIT 899999001 el pago pasó de $100 a $20 por cada $100 desde abril (NIT compartido por varias entidades).", 5, "PENDIENTE"],
      ["E10", "Omisión aparente", "Sin pago visible en junio de 2026.", 4, "PENDIENTE"],
      ["E18", "Dispersión", "Cambio en la composición de cotizantes en el segundo trimestre.", 3, "PENDIENTE"],
    ];
    insumos.forEach(([eid, tipo, desc, dias, estado], i) => {
      db.insumoSigip.push({ id: `SIGIP-${String(i + 1).padStart(3, "0")}`, entidadId: eid, tipo, descripcion: desc, periodos: PERIODOS.slice(),
        fecha: hace(dias + 3), estado, fuente: "SIGIP v2 · tablero Power BI (simulado)" });
    });

    /* --- Expedientes: casos de referencia del piloto --- */
    function nuevoExpediente(id, eid, { dias, responsableId, caso, plazo = 15 }) {
      const ent = db.entidades.find((e) => e.id === eid);
      const ins = db.insumoSigip.find((x) => x.entidadId === eid);
      const r = U.mulberry32(Number(id.slice(-4)) * 31);
      const exp = {
        id, entidadId: eid, dt: ent.dt, casoReferencia: caso,
        origen: { insumoId: ins?.id || null, tipo: ins?.tipo || "Requerimiento directo", descripcion: ins?.descripcion || "" },
        motivo: `Validación y verificación de los aportes de la Ley 21 de 1982 · ${ins?.tipo || "verificación"}`,
        periodos: PERIODOS.slice(), creado: hace(dias), fechaRequerimiento: hace(dias),
        fechaLimite: U.sumarDias(hace(dias), plazo),
        credencial: { usuario: `SG21-${id.slice(-4)}`, clave: U.claveTemporal(r), emitida: hace(dias), vence: U.sumarDias(hace(dias), plazo), activa: true, ultimoAcceso: null },
        estado: "REQUERIDO", responsableId: responsableId || null, prioridad: "Media",
        registroEntidad: null, nomina: null, conciliacion: null, mesa: null, resultado: null, radicado: null, reprocesos: 0, cerrado: null,
        revisionCalidad: null,
      };
      db.expedientes.push(exp);
      enFecha(hace(dias), () => {
        st.bitacora(id, "Insumo recibido de SIGIP", `${exp.origen.tipo}: ${exp.origen.descripcion}`, "sistema");
        st.bitacora(id, "Requerimiento emitido", `Se solicitó a la entidad la información de ${PERIODOS.length} periodos y se habilitó la credencial temporal ${exp.credencial.usuario} con vigencia hasta ${U.fecha(exp.credencial.vence)}.`, "esap");
        st.auditar("Creación de expediente", id, `Requerimiento a ${ent.nombre}`);
      });
      return exp;
    }

    function registroEntidad(exp, dias) {
      const ent = st.entidad(exp.entidadId);
      const r = U.mulberry32(Number(exp.id.slice(-4)) * 7);
      exp.registroEntidad = {
        representante: { nombre: `${["Rodrigo", "Elena", "Mario", "Sofía", "Hugo"][Math.floor(r() * 5)]} ${["Pardo", "Lince", "Gaitán", "Rueda", "Mora"][Math.floor(r() * 5)]} ${["Ávila", "Cortés", "Peña"][Math.floor(r() * 3)]}`,
          documento: String(10000000 + Math.floor(r() * 80000000)), cargo: ent.tipo === "Municipio" ? "Alcalde(sa) municipal" : "Representante legal" },
        responsable: { nombre: `${["Gloria", "Iván", "Tatiana", "Rubén"][Math.floor(r() * 4)]} ${["Lara", "Pinto", "Vega", "Quintana"][Math.floor(r() * 4)]}`,
          cargo: "Profesional de talento humano", correo: `nomina.${ent.id.toLowerCase()}@entidad-ficticia.gov.co`, telefono: `60${Math.floor(1000000 + r() * 8999999)}` },
        fecha: hace(dias),
      };
      ent.representante = { ...exp.registroEntidad.representante };
      ent.responsable = { ...exp.registroEntidad.responsable };
      ent.actualizado = hace(dias);
      exp.estado = "EN_CARGUE";
      exp.credencial.ultimoAcceso = hace(dias);
      enFecha(hace(dias), () => st.bitacora(exp.id, "Registro de información de la entidad", `Representante: ${exp.registroEntidad.representante.nombre}. Responsable de la información: ${exp.registroEntidad.responsable.nombre}.`, "entidad"));
    }

    function cargarNomina(exp, dias, { periodos = PERIODOS, version = 1 } = {}) {
      const n = nominas[exp.entidadId];
      const filas = n.filas.filter((f) => periodos.includes(f.periodo)).map((f, i) => ({ ...f, _fila: i + 2 }));
      const resumen = R.resumirNomina(filas, n.conceptos);
      const validacion = enFecha(hace(dias), () => R.validarNomina({ filas, conceptos: n.conceptos }, exp));
      exp.nomina = { archivo: `nomina_${exp.entidadId.toLowerCase()}_2026.xlsx`, cargado: hace(dias), version, filas: filas.length, resumen, validacion: { ...validacion, fecha: hace(dias) } };
      const loteId = `LOT-${exp.id.slice(-4)}-NOM-${version}`;
      db.lotes.push({ id: loteId, expedienteId: exp.id, origen: "ENTIDAD", tipo: "NOMINA", nombre: exp.nomina.archivo, tamano: 40000 + filas.length * 62,
        huella: `seed-${exp.id}-${version}`, fecha: hace(dias), cargadoPor: "Entidad (usuario temporal)", version, estado: validacion.ok ? "VALIDADO" : "CON_ERRORES", filas: filas.length, corte: periodos[periodos.length - 1] });
      enFecha(hace(dias), () => st.bitacora(exp.id, `Nómina cargada (versión ${version})`, `${filas.length} registros, ${periodos.length} periodos. Resultado de calidad: ${validacion.ok ? "sin errores" : "con errores"}.`, "entidad", loteId));
    }

    function cargarSoportes(exp, dias, tipos) {
      tipos.forEach((t, i) => {
        const id = `LOT-${exp.id.slice(-4)}-${t}`;
        db.lotes.push({ id, expedienteId: exp.id, origen: "ENTIDAD", tipo: t, nombre: `${t.toLowerCase()}_${exp.entidadId.toLowerCase()}.pdf`,
          tamano: 180000 + i * 53000, huella: `seed-${id}`, fecha: hace(dias), cargadoPor: "Entidad (usuario temporal)", version: 1, estado: "RECIBIDO", filas: null });
      });
      enFecha(hace(dias), () => st.bitacora(exp.id, "Soportes cargados", tipos.map((t) => S21.cat.TIPOS_DOCUMENTO[t].txt).join(" · "), "entidad"));
    }

    function radicar(exp, dias) {
      exp.radicado = { fecha: hace(dias), numero: `RAD-E-2026-${exp.id.slice(-4)}` };
      exp.estado = "RECIBIDO";
      enFecha(hace(dias), () => {
        st.bitacora(exp.id, "Información radicada por la entidad", `Radicado ${exp.radicado.numero}.`, "entidad");
        st.crearAlerta({ tipo: "LISTO_VALIDACION", expedienteId: exp.id, detalle: `${st.entidad(exp.entidadId).nombre} radicó la información del expediente ${exp.id}.` });
      });
    }

    function validarCalidad(exp, dias, porId) {
      enFecha(hace(dias), () => {
        S21.store.guardarSesion({ tipo: "esap", usuarioId: porId });
        exp.revisionCalidad = { fecha: hace(dias), por: st.usuario(porId).nombre, resultado: "APROBADA" };
        exp.estado = "EN_ANALISIS";
        st.bitacora(exp.id, "Calidad y estructura validadas", "Se verificó integridad, completitud, formato y clasificación de conceptos.");
        st.alertasDe(exp.id).filter((a) => a.tipo === "LISTO_VALIDACION").forEach((a) => st.cambiarEstadoAlerta(a, "CERRADA", "Validación funcional realizada."));
        S21.store.guardarSesion(null);
      });
    }

    function conciliarComo(exp, dias, porId) {
      enFecha(hace(dias), () => {
        S21.store.guardarSesion({ tipo: "esap", usuarioId: porId });
        R.conciliar(exp);
        S21.store.guardarSesion(null);
      });
    }

    function revisar(exp, dias, porId, estado, nota) {
      enFecha(hace(dias), () => {
        S21.store.guardarSesion({ tipo: "esap", usuarioId: porId });
        exp.conciliacion.filas.filter((f) => f.revision.estado === "PENDIENTE").forEach((f) => {
          f.revision = { estado, por: st.usuario(porId).nombre, fecha: hace(dias), nota };
          st.alertasDe(exp.id).filter((a) => a.tipo === "DIFERENCIA_VALORES" && a.periodo === f.periodo && a.estado === "ABIERTA")
            .forEach((a) => st.cambiarEstadoAlerta(a, estado === "CONFIRMADA" ? "CONFIRMADA" : "DESCARTADA", nota));
        });
        st.bitacora(exp.id, `Diferencias ${estado === "CONFIRMADA" ? "confirmadas" : "descartadas"} por revisión humana`, nota);
        S21.store.guardarSesion(null);
      });
    }

    function cerrar(exp, dias, porId, tipo, extra = {}) {
      enFecha(hace(dias), () => {
        S21.store.guardarSesion({ tipo: "esap", usuarioId: porId });
        exp.resultado = { tipo, fecha: hace(dias), por: st.usuario(porId).nombre, valor: exp.conciliacion?.totales.aFavorEsap || 0, ...extra };
        exp.estado = "CERRADO";
        exp.cerrado = hace(dias);
        exp.credencial.activa = false;
        st.bitacora(exp.id, "Resultado registrado y expediente cerrado", `${S21.cat.RESULTADOS[tipo]}. ${extra.observacion || ""}`);
        st.auditar("Cierre de expediente", exp.id, S21.cat.RESULTADOS[tipo]);
        S21.store.guardarSesion(null);
      });
    }

    // Caso 1 · Pago correctamente conciliado
    let x = nuevoExpediente("SG21-2026-0001", "E01", { dias: 72, responsableId: "u6", caso: "Pago correctamente conciliado" });
    registroEntidad(x, 66); cargarNomina(x, 65); cargarSoportes(x, 65, ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"]); radicar(x, 64);
    validarCalidad(x, 62, "u4"); conciliarComo(x, 61, "u2");
    cerrar(x, 58, "u4", "SIN_OBLIGACION", { observacion: "Los aportes del semestre coinciden con la nómina reportada." });

    // Caso 2 · Pago sin asociación clara (los pagos llegaron con un NIT mal digitado)
    x = nuevoExpediente("SG21-2026-0002", "E02", { dias: 68, responsableId: "u2", caso: "Pago sin asociación clara" });
    registroEntidad(x, 60); cargarNomina(x, 59); cargarSoportes(x, 59, ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"]); radicar(x, 58);
    validarCalidad(x, 20, "u4");

    // Caso 3 · Diferencia entre valores (conceptos salariales excluidos de la base) → mesa técnica
    x = nuevoExpediente("SG21-2026-0003", "E04", { dias: 58, responsableId: "u3", caso: "Diferencia entre valores" });
    registroEntidad(x, 52); cargarNomina(x, 51); cargarSoportes(x, 51, ["PILA", "SOPORTE_PAGO", "CERT_FACTORES", "EJECUCION"]); radicar(x, 50);
    validarCalidad(x, 45, "u4"); conciliarComo(x, 44, "u2");
    revisar(x, 40, "u3", "CONFIRMADA", "La entidad excluyó la prima técnica y los gastos de representación de la base, aunque los certificó como factor salarial.");
    enFecha(hace(38), () => {
      x.mesa = { fecha: U.sumarDias(new Date().toISOString(), 4).slice(0, 10), hora: "10:00", modalidad: "Virtual (Teams)",
        participantes: "ESAP: Recaudo y Cartera, Dirección Territorial Bolívar. Entidad: Secretaría de Hacienda y Talento Humano.",
        agenda: "Presentar el informe de verificación y la diferencia material por exclusión de factores salariales.", acta: null };
      x.estado = "MESA_TECNICA";
      S21.store.guardarSesion({ tipo: "esap", usuarioId: "u3" });
      st.bitacora(x.id, "Mesa técnica programada", `Fecha ${U.fecha(x.mesa.fecha)} ${x.mesa.hora} · ${x.mesa.modalidad}. Diferencia material ${U.pesos(x.conciliacion.totales.aFavorEsap)}.`);
      S21.store.guardarSesion(null);
    });

    // Caso 4 · Registro duplicado
    x = nuevoExpediente("SG21-2026-0004", "E05", { dias: 48, responsableId: "u1", caso: "Registro duplicado" });
    registroEntidad(x, 42); cargarNomina(x, 41); cargarSoportes(x, 41, ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"]);
    db.lotes.push({ id: "LOT-0004-NOM-1B", expedienteId: x.id, origen: "ENTIDAD", tipo: "NOMINA", nombre: "nomina_e05_2026 (copia).xlsx", tamano: 40000 + x.nomina.filas * 62,
      huella: `seed-${x.id}-1`, fecha: hace(41, 11), cargadoPor: "Entidad (usuario temporal)", version: 1, estado: "DUPLICADO", filas: x.nomina.filas });
    enFecha(hace(41, 11), () => st.crearAlerta({ tipo: "POSIBLE_DUPLICADO", expedienteId: x.id, detalle: "La entidad cargó dos veces el mismo archivo de nómina (huella idéntica)." }));
    radicar(x, 40); validarCalidad(x, 30, "u4");

    // Caso 5 · Información incompleta (faltan mayo y junio) y plazo próximo a vencer
    x = nuevoExpediente("SG21-2026-0005", "E06", { dias: 12, responsableId: "u1", caso: "Información incompleta" });
    registroEntidad(x, 9); cargarNomina(x, 8, { periodos: PERIODOS.slice(0, 4) });
    enFecha(hace(8), () => st.crearAlerta({ tipo: "INFO_INCOMPLETA", expedienteId: x.id, prioridad: "Alta", detalle: "La nómina cargada no incluye mayo ni junio de 2026." }));
    enFecha(hace(1), () => st.crearAlerta({ tipo: "PROXIMA_FECHA", expedienteId: x.id, detalle: `El plazo del requerimiento vence el ${U.fecha(x.fechaLimite)} y la entidad no ha radicado.` }));

    // Caso 6 · Soporte disperso: radicó sin comprobantes ni certificación de factores
    x = nuevoExpediente("SG21-2026-0006", "E07", { dias: 30, responsableId: "u6", caso: "Caso con soporte disperso" });
    registroEntidad(x, 25); cargarNomina(x, 24); cargarSoportes(x, 24, ["PILA"]); radicar(x, 23);
    enFecha(hace(22), () => st.crearAlerta({ tipo: "SOPORTE_PENDIENTE", expedienteId: x.id, detalle: "Faltan el comprobante de pago y la certificación de factores salariales; la entidad indicó que reposan en la Tesorería municipal." }));

    // Caso 7 · Diferencia previamente descartada con justificación
    x = nuevoExpediente("SG21-2026-0007", "E14", { dias: 64, responsableId: "u3", caso: "Diferencia previamente descartada" });
    registroEntidad(x, 58); cargarNomina(x, 57); cargarSoportes(x, 57, ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"]); radicar(x, 56);
    validarCalidad(x, 50, "u4"); conciliarComo(x, 49, "u2");
    revisar(x, 46, "u3", "DESCARTADA", "La diferencia de febrero corresponde a una incapacidad reconocida por la EPS que no constituye base; se verificó el soporte en el expediente.");
    cerrar(x, 45, "u4", "SIN_OBLIGACION", { observacion: "Diferencia descartada con soporte; sin obligación pendiente." });

    // Caso 8 · Remitido a otra dependencia (Oficina Jurídica) tras determinar la obligación
    x = nuevoExpediente("SG21-2026-0008", "E16", { dias: 75, responsableId: "u4", caso: "Caso remitido a otra dependencia" });
    registroEntidad(x, 70); cargarNomina(x, 69); cargarSoportes(x, 69, ["PILA", "SOPORTE_PAGO", "CERT_FACTORES"]); radicar(x, 68);
    validarCalidad(x, 64, "u4"); conciliarComo(x, 63, "u2");
    revisar(x, 60, "u3", "CONFIRMADA", "No hay pagos de abril a junio; la entidad no presentó soportes de pago.");
    enFecha(hace(50), () => {
      x.mesa = { fecha: hace(50).slice(0, 10), hora: "09:00", modalidad: "Presencial · DT Tolima", participantes: "ESAP y Secretaría de Hacienda municipal",
        agenda: "Revisar periodos sin pago.", acta: "La entidad reconoce la omisión de abril a junio y no propone acuerdo de pago en el plazo otorgado." };
    });
    cerrar(x, 35, "u4", "REMITIDO_COBRO", { acto: "Resolución (ficticia) 0457 de 2026", observacion: "Se remitió el expediente a la Oficina Jurídica para cobro persuasivo." });
    x.reprocesos = 1;

    // Caso 9 · DEMOSTRACIÓN EN VIVO: requerimiento recién emitido
    x = nuevoExpediente(DEMO.expediente, "E09", { dias: 2, responsableId: "u1", caso: "Demostración en vivo" });
    x.credencial.clave = DEMO.clave;
    x.credencial.vence = U.sumarDias(new Date().toISOString(), 13);
    x.fechaLimite = x.credencial.vence;
    x.prioridad = "Alta";

    // Caso 10 · Credencial vencida sin respuesta
    x = nuevoExpediente("SG21-2026-0010", "E17", { dias: 26, responsableId: "u6", caso: "Requerimiento sin respuesta" });
    enFecha(hace(10), () => st.crearAlerta({ tipo: "FUERA_DE_PLAZO", expedienteId: x.id, prioridad: "Alta", detalle: `El plazo venció el ${U.fecha(x.fechaLimite)} sin que la entidad cargara información.` }));

    // Notificaciones históricas como leídas, para que la bandeja muestre solo lo reciente
    db.notificaciones.forEach((n) => { if (new Date(n.fecha) < new Date(hace(15))) n.leida = true; });
    db.auditoria.push({ id: U.uid("aud"), fecha: ahora, usuario: "SIGREC-21 (automático)", usuarioId: "sistema", rol: "sistema", accion: "Carga de datos de demostración", objeto: "Sistema", detalle: `Versión ${VERSION}` });
    return db;
  }

  return { VERSION, PERIODOS, DEMO, crear };
})();
