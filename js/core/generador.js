/* Generador de datos FICTICIOS y reproducibles: nóminas de ejemplo y pagos de fuentes autorizadas.
   Ningún nombre, documento ni NIT corresponde a personas o entidades reales. */
S21.gen = (function () {
  const U = S21.util;

  const NOMBRES = ["Ana", "Luis", "María", "Carlos", "Paola", "Jorge", "Diana", "Andrés", "Lucía", "Mauricio", "Sandra", "Felipe",
    "Natalia", "Ricardo", "Claudia", "Hernán", "Juliana", "Óscar", "Liliana", "Camilo", "Adriana", "Fabio", "Mónica", "Germán",
    "Viviana", "Julián", "Patricia", "Edwin", "Yolanda", "Sergio", "Marcela", "Wilson", "Gloria", "Iván", "Rocío", "Nelson"];
  const APELLIDOS = ["Gómez", "Rodríguez", "Martínez", "López", "Hernández", "Díaz", "Moreno", "Rojas", "Vargas", "Castro",
    "Ortiz", "Rubio", "Jiménez", "Torres", "Ramírez", "Suárez", "Cárdenas", "Mejía", "Salazar", "Pineda", "Arias", "Bravo",
    "Cifuentes", "Delgado", "Escobar", "Fajardo", "Guerrero", "Ibarra", "Lozano", "Montoya", "Navarro", "Ospina"];
  const CARGOS = [
    { cargo: "Alcalde / Representante legal", nivel: "directivo", min: 9200000, max: 12500000 },
    { cargo: "Secretario de despacho", nivel: "directivo", min: 6800000, max: 8900000 },
    { cargo: "Jefe de oficina", nivel: "directivo", min: 5600000, max: 7200000 },
    { cargo: "Profesional especializado", nivel: "profesional", min: 4200000, max: 5800000 },
    { cargo: "Profesional universitario", nivel: "profesional", min: 3200000, max: 4300000 },
    { cargo: "Técnico operativo", nivel: "tecnico", min: 2300000, max: 3100000 },
    { cargo: "Auxiliar administrativo", nivel: "asistencial", min: 1750000, max: 2300000 },
    { cargo: "Conductor", nivel: "asistencial", min: 1750000, max: 2100000 },
  ];

  /* Catálogo de conceptos de nómina con su clasificación esperada (factor salarial: SI/NO).
     La clasificación la DECLARA la entidad en la plantilla; aquí solo se usa para generar ejemplos. */
  const CONCEPTOS = [
    { nombre: "SUELDO BASICO", salarial: true },
    { nombre: "PRIMA TECNICA", salarial: true },
    { nombre: "GASTOS DE REPRESENTACION", salarial: true },
    { nombre: "HORAS EXTRAS Y RECARGOS", salarial: true },
    { nombre: "BONIFICACION POR SERVICIOS PRESTADOS", salarial: true },
    { nombre: "AUXILIO DE TRANSPORTE", salarial: false },
    { nombre: "VIATICOS", salarial: false },
  ];

  const redondear = (v, m = 1000) => Math.round(v / m) * m;

  function nombrePersona(r) {
    const n = NOMBRES[Math.floor(r() * NOMBRES.length)];
    const a1 = APELLIDOS[Math.floor(r() * APELLIDOS.length)];
    const a2 = APELLIDOS[Math.floor(r() * APELLIDOS.length)];
    return `${n} ${a1} ${a2}`;
  }

  /* Planta de personal dinámica: ingresa personal en el cuarto mes y sale una persona en el quinto */
  function generarNomina({ semilla = 7, empleados = 32, periodos }) {
    const r = U.mulberry32(semilla);
    const planta = [];
    for (let i = 0; i < empleados + 2; i++) {
      const c = i === 0 ? CARGOS[0] : i < 4 ? CARGOS[1 + Math.floor(r() * 2)] : CARGOS[3 + Math.floor(r() * 5)];
      planta.push({
        tipoDoc: "CC",
        documento: String(1000000000 + Math.floor(r() * 89999999) * 10 + i).slice(0, 10),
        nombre: nombrePersona(r),
        cargo: c.cargo, nivel: c.nivel,
        sueldo: redondear(c.min + r() * (c.max - c.min)),
        primaTecnica: c.nivel === "directivo" || (c.nivel === "profesional" && r() < 0.35),
        ingresaEn: i >= empleados ? 3 : 0, // índice de periodo
        saleEn: i === empleados - 1 ? 4 : 99,
      });
    }
    const filas = [];
    periodos.forEach((per, idx) => {
      planta.filter((p) => idx >= p.ingresaEn && idx < p.saleEn).forEach((p) => {
        const add = (concepto, valor) => { if (valor > 0) filas.push({ periodo: per, tipoDoc: p.tipoDoc, documento: p.documento, nombre: p.nombre, cargo: p.cargo, concepto, valor: Math.round(valor) }); };
        add("SUELDO BASICO", p.sueldo);
        if (p.primaTecnica) add("PRIMA TECNICA", redondear(p.sueldo * (p.nivel === "directivo" ? 0.5 : 0.25)));
        if (p.nivel === "directivo") add("GASTOS DE REPRESENTACION", redondear(p.sueldo * 0.3));
        if ((p.nivel === "tecnico" || p.nivel === "asistencial") && r() < 0.45) add("HORAS EXTRAS Y RECARGOS", redondear(p.sueldo * (0.04 + r() * 0.12)));
        if (per.endsWith("-06") || per.endsWith("-12")) add("BONIFICACION POR SERVICIOS PRESTADOS", redondear(p.sueldo * 0.35));
        if (p.sueldo <= 2600000) add("AUXILIO DE TRANSPORTE", 200000);
        if (r() < 0.12) add("VIATICOS", redondear(180000 + r() * 520000));
      });
    });
    return { conceptos: CONCEPTOS.map((c) => ({ ...c })), filas };
  }

  /* Pagos de fuentes autorizadas coherentes con una nómina y un escenario de comportamiento:
     escenario.excluir: conceptos que la entidad NO incluyó en la base al liquidar en PILA
     escenario.faltantes: periodos sin pago · escenario.parcial: {periodo: factor} · escenario.tarde: [periodos]
     escenario.nitPago: NIT con el que se reportó (para simular pagos sin asociación) · escenario.duplicar: [periodos] */
  function generarPagos({ entidad, periodos, resumen, escenario = {}, semilla = 11, tasa = 0.005 }) {
    const r = U.mulberry32(semilla);
    const pagos = [];
    const ult2 = Number(String(entidad.nit).replace(/\D/g, "").slice(-2)) || 0;
    const diaLimite = 2 + Math.floor(ult2 / 7);
    periodos.forEach((per) => {
      if ((escenario.faltantes || []).includes(per)) return;
      const pc = resumen.periodos[per]?.porConcepto || {};
      const base = Object.entries(pc).filter(([c]) => {
        const def = resumen.conceptos.find((x) => x.nombre === c);
        return def?.salarial && !(escenario.excluir || []).includes(c);
      }).reduce((s, [, v]) => s + v, 0);
      let valor = Math.ceil((base * tasa) / 100) * 100;
      if (escenario.parcial && escenario.parcial[per]) valor = Math.ceil((valor * escenario.parcial[per]) / 100) * 100;
      const tarde = (escenario.tarde || []).includes(per);
      const limite = U.diaHabilMesSiguiente(per, diaLimite);
      const fecha = tarde ? U.sumarDias(limite, 18 + Math.floor(r() * 10)).slice(0, 10) : U.sumarDias(limite, -1 - Math.floor(r() * 3)).slice(0, 10);
      const planilla = String(8000000000 + Math.floor(r() * 999999999));
      const nit = escenario.nitPago || entidad.nit;
      const comun = { nit, periodo: per, planilla, valor, entidadId: null, estadoAsociacion: "PENDIENTE", metodoAsociacion: null, loteId: "LOTE-PILA-2026" };
      pagos.push({ ...comun, id: U.uid("pag"), fuente: "PILA_A", referencia: `A-${planilla}`, fecha });
      pagos.push({ ...comun, id: U.uid("pag"), fuente: "LOG_FIN", referencia: `ASO-${planilla.slice(-6)}`, fecha: U.sumarDias(fecha, 1).slice(0, 10), loteId: "LOTE-LOG-2026" });
      if ((escenario.duplicar || []).includes(per)) {
        pagos.push({ ...comun, id: U.uid("pag"), fuente: "PILA_A", referencia: `A-${planilla}`, fecha });
      }
    });
    return pagos;
  }

  return { generarNomina, generarPagos, CONCEPTOS };
})();
