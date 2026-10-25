/* Catálogos funcionales: estados, tipos de alerta (Propuesta técnica, sección 12), documentos y territorios */
S21.cat = {
  ESTADOS_EXPEDIENTE: {
    REQUERIDO:      { txt: "Requerido", chip: "info", orden: 1, desc: "Se envió el requerimiento con credencial temporal." },
    EN_CARGUE:      { txt: "En cargue por la entidad", chip: "morado", orden: 2, desc: "La entidad ingresó y está registrando información." },
    RECIBIDO:       { txt: "Recibido · listo para validación", chip: "alerta", orden: 3, desc: "La entidad radicó la información." },
    EN_ANALISIS:    { txt: "En análisis", chip: "info", orden: 4, desc: "Calidad validada; pendiente cruce y conciliación." },
    CON_DIFERENCIA: { txt: "Con diferencias", chip: "error", orden: 5, desc: "La conciliación encontró indicios de diferencia." },
    CONCILIADO:     { txt: "Conciliado", chip: "ok", orden: 5, desc: "La conciliación no encontró diferencias por encima de la tolerancia." },
    MESA_TECNICA:   { txt: "Mesa técnica", chip: "morado", orden: 6, desc: "Diferencia material persistente en análisis institucional." },
    CERRADO:        { txt: "Cerrado", chip: "", orden: 7, desc: "Resultado registrado." },
  },

  RESULTADOS: {
    SIN_OBLIGACION: "Sin obligación pendiente (se archiva el seguimiento)",
    OBLIGACION_DETERMINADA: "Obligación determinada · se proyecta acto administrativo",
    ACUERDO_PAGO: "Acuerdo de pago suscrito",
    PAGO_VERIFICADO: "Pago verificado tras requerimiento",
    SALDO_A_FAVOR: "Saldo a favor del aportante · trámite de devolución/compensación",
    REMITIDO_COBRO: "Remitido a Oficina Jurídica para cobro persuasivo/coactivo",
  },

  TIPOS_ALERTA: {
    SIN_ENTIDAD:          { txt: "Registro sin entidad identificada", rol: "gestor", accion: "Completar o corregir la identificación.", clase: "operativa" },
    SIN_PERIODO:          { txt: "Registro sin periodo", rol: "gestor", accion: "Verificar la fuente y el periodo.", clase: "operativa" },
    PAGO_SIN_ASOCIACION:  { txt: "Pago sin asociación", rol: "conciliador", accion: "Relacionar el pago o documentar el pendiente.", clase: "diferencia" },
    NIT_COMPARTIDO:       { txt: "Pago sobre NIT compartido", rol: "conciliador", accion: "Distribuir el pago entre las entidades que comparten NIT.", clase: "diferencia" },
    POSIBLE_DUPLICADO:    { txt: "Posible duplicado", rol: "gestor", accion: "Confirmar o descartar la duplicidad.", clase: "operativa" },
    DIFERENCIA_VALORES:   { txt: "Diferencia entre valores", rol: "conciliador", accion: "Revisar fuentes y clasificar la diferencia.", clase: "diferencia" },
    INFO_INCOMPLETA:      { txt: "Información incompleta", rol: "gestor", accion: "Solicitar o completar la información.", clase: "operativa" },
    FUERA_DE_PLAZO:       { txt: "Cargue fuera del plazo del requerimiento", rol: "gestor", accion: "Verificar la fecha límite, notificar el incumplimiento y escalar.", clase: "operativa" },
    SIN_RESPONSABLE:      { txt: "Diferencia sin responsable", rol: "admin_funcional", accion: "Asignar responsable.", clase: "operativa" },
    PROXIMA_FECHA:        { txt: "Actividad próxima a la fecha de seguimiento", rol: "validador", accion: "Registrar la gestión o escalar.", clase: "operativa" },
    SOPORTE_PENDIENTE:    { txt: "Soporte pendiente", rol: "gestor", accion: "Vincular la evidencia institucional.", clase: "operativa" },
    LISTO_VALIDACION:     { txt: "Registro listo para validación funcional", rol: "validador", accion: "Validar o devolver para ajuste.", clase: "operativa" },
  },

  ESTADOS_ALERTA: {
    ABIERTA:    { txt: "Abierta", chip: "error" },
    EN_GESTION: { txt: "En gestión", chip: "alerta" },
    CONFIRMADA: { txt: "Confirmada", chip: "info" },
    DESCARTADA: { txt: "Descartada", chip: "" },
    CERRADA:    { txt: "Cerrada", chip: "ok" },
  },

  TIPOS_DOCUMENTO: {
    NOMINA: { txt: "Nómina editable (Excel/CSV)", obligatorio: true },
    PILA: { txt: "Planilla PILA del periodo", obligatorio: true },
    SOPORTE_PAGO: { txt: "Comprobante o soporte de pago", obligatorio: true },
    CERT_FACTORES: { txt: "Certificación de conceptos y factores salariales", obligatorio: true },
    EJECUCION: { txt: "Ejecución presupuestal de gastos de personal", obligatorio: false },
    OTRO: { txt: "Documento complementario", obligatorio: false },
  },

  FUENTES_PAGO: {
    PILA_A: "PILA · archivo tipo A",
    PILA_I: "PILA · archivo tipo I",
    LOG_FIN: "Operador financiero (log Asobancaria)",
    CARGA_MANUAL: "Carga controlada de fuente autorizada",
  },

  TIPOS_ENTIDAD: ["Municipio", "Departamento", "Distrito", "Entidad del orden nacional", "Fuerza Pública", "Concejo / Contraloría / Personería"],

  DIRECCIONES_TERRITORIALES: [
    "Sede Central", "Antioquia", "Atlántico", "Bolívar", "Boyacá", "Cundinamarca", "Nariño",
    "Santander", "Tolima", "Valle del Cauca", "Meta", "Cauca",
  ],
};
