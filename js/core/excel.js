/* Lectura y generación de archivos Excel/CSV en el navegador con SheetJS (sin servidor).
   La nómina nunca sale del equipo de quien la carga: se procesa localmente. */
S21.excel = (function () {
  const U = S21.util;
  const disponible = () => typeof window.XLSX !== "undefined";

  const COLS_NOMINA = {
    PERIODO: ["PERIODO", "MES", "PERIODO (AAAA-MM)"],
    TIPO_DOC: ["TIPO_DOC", "TIPO DOC", "TIPO DOCUMENTO", "TIPO_DOCUMENTO"],
    DOCUMENTO: ["DOCUMENTO", "NUMERO DOCUMENTO", "NUMERO_DOCUMENTO", "CEDULA", "IDENTIFICACION"],
    NOMBRE: ["NOMBRE", "NOMBRES", "NOMBRE COMPLETO", "NOMBRES Y APELLIDOS", "SERVIDOR"],
    CARGO: ["CARGO", "EMPLEO"],
    CONCEPTO: ["CONCEPTO", "CONCEPTO DE NOMINA", "CONCEPTO_NOMINA"],
    VALOR: ["VALOR", "VALOR DEVENGADO", "DEVENGADO", "VALOR_PAGADO"],
  };
  const OBLIGATORIAS = ["PERIODO", "DOCUMENTO", "NOMBRE", "CONCEPTO", "VALOR"];

  const COLS_PAGOS = {
    FUENTE: ["FUENTE"], NIT: ["NIT", "NIT APORTANTE"], PERIODO: ["PERIODO"], PLANILLA: ["PLANILLA", "NUMERO PLANILLA"],
    REFERENCIA: ["REFERENCIA"], FECHA: ["FECHA", "FECHA PAGO"], VALOR: ["VALOR", "VALOR PAGADO"],
  };

  /* ---------- Conversión de valores ---------- */

  function aPeriodo(v) {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
    if (typeof v === "number") {
      if (v > 190000 && v < 300000) return `${String(v).slice(0, 4)}-${String(v).slice(4)}`; // 202603
      if (disponible() && v > 20000 && v < 80000) { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, "0")}`; }
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
    if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
    m = s.match(/^(\d{4})(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}`;
    return s;
  }

  function aNumero(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    let s = String(v).replace(/[$\s]/g, "");
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // 1.234.567,50
    else s = s.replace(/[.,](?=\d{3}(\D|$))/g, ""); // 1.234.567 o 1,234,567
    const n = Number(s);
    return isNaN(n) ? NaN : n;
  }

  function aFecha(v) {
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    if (typeof v === "number" && disponible()) { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`; }
    const s = String(v || "").trim();
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return s.slice(0, 10);
  }

  const esSi = (v) => ["SI", "S", "X", "TRUE", "VERDADERO", "1", "YES"].includes(U.normalizar(v));
  const esNo = (v) => ["NO", "N", "FALSE", "FALSO", "0"].includes(U.normalizar(v));

  /* ---------- Lectura ---------- */

  async function leerLibro(file) {
    const buffer = await file.arrayBuffer();
    const huella = await U.huella(buffer);
    if (!disponible()) {
      if (/\.csv$/i.test(file.name)) return { libro: libroDesdeCsv(new TextDecoder("utf-8").decode(buffer)), huella, buffer };
      throw new Error("No se pudo cargar el lector de Excel (sin conexión a internet). Use un archivo CSV o recargue la página.");
    }
    const libro = XLSX.read(buffer, { type: "array", cellDates: true });
    return { libro, huella, buffer };
  }

  /* Respaldo mínimo cuando SheetJS no está disponible */
  function libroDesdeCsv(texto) {
    const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ";" : ",";
    const filas = lineas.map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
    return { SheetNames: ["Nomina"], Sheets: { Nomina: { __filas: filas } } };
  }

  function filasHoja(libro, nombre) {
    const hoja = libro.Sheets[nombre];
    if (hoja.__filas) return hoja.__filas;
    return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: "" });
  }

  function buscarHoja(libro, candidatos) {
    return libro.SheetNames.find((n) => candidatos.some((c) => U.normalizar(n).includes(c)));
  }

  /* Ubica la fila de encabezados y mapea columnas por sinónimos */
  function mapearEncabezados(filas, columnas) {
    for (let i = 0; i < Math.min(filas.length, 15); i++) {
      const norm = filas[i].map((c) => U.normalizar(c).replace(/_/g, " "));
      const mapa = {};
      Object.entries(columnas).forEach(([clave, sinonimos]) => {
        const idx = norm.findIndex((h) => sinonimos.some((s) => h === s.replace(/_/g, " ")));
        if (idx >= 0) mapa[clave] = idx;
      });
      if (Object.keys(mapa).length >= Math.min(3, Object.keys(columnas).length)) return { fila: i, mapa };
    }
    return { fila: -1, mapa: {} };
  }

  async function leerNomina(file) {
    const { libro, huella } = await leerLibro(file);
    const hojaNom = buscarHoja(libro, ["NOMINA"]) || libro.SheetNames[0];
    const crudas = filasHoja(libro, hojaNom);
    const { fila, mapa } = mapearEncabezados(crudas, COLS_NOMINA);
    const encabezadosFaltantes = OBLIGATORIAS.filter((c) => mapa[c] === undefined);
    const filas = [];
    if (fila >= 0 && !encabezadosFaltantes.length) {
      for (let i = fila + 1; i < crudas.length; i++) {
        const r = crudas[i];
        if (!r || r.every((c) => c === "" || c === null)) continue;
        const g = (k) => (mapa[k] === undefined ? "" : r[mapa[k]]);
        filas.push({
          _fila: i + 1,
          periodo: aPeriodo(g("PERIODO")),
          tipoDoc: String(g("TIPO_DOC") || "CC").trim(),
          documento: String(g("DOCUMENTO") ?? "").replace(/\.0$/, "").trim(),
          nombre: String(g("NOMBRE") ?? "").trim(),
          cargo: String(g("CARGO") ?? "").trim(),
          concepto: U.normalizar(g("CONCEPTO")),
          valor: aNumero(g("VALOR")),
        });
      }
    }

    // Hoja de clasificación de conceptos (factor salarial SI/NO)
    const conceptos = [];
    const hojaCon = buscarHoja(libro, ["CONCEPTO", "FACTOR"]);
    if (hojaCon && hojaCon !== hojaNom) {
      const cr = filasHoja(libro, hojaCon);
      const enc = mapearEncabezados(cr, { CONCEPTO: ["CONCEPTO", "CONCEPTO DE NOMINA"], FACTOR: ["ES FACTOR SALARIAL", "FACTOR SALARIAL", "ES_FACTOR_SALARIAL", "SALARIAL"] });
      if (enc.fila >= 0 && enc.mapa.CONCEPTO !== undefined && enc.mapa.FACTOR !== undefined) {
        for (let i = enc.fila + 1; i < cr.length; i++) {
          const nombre = U.normalizar(cr[i][enc.mapa.CONCEPTO]);
          if (!nombre) continue;
          const f = cr[i][enc.mapa.FACTOR];
          conceptos.push({ nombre, salarial: esSi(f) ? true : esNo(f) ? false : null });
        }
      }
    }
    return { archivo: file.name, tamano: file.size, huella, hojas: libro.SheetNames, filas, conceptos, encabezadosFaltantes };
  }

  async function leerPagos(file) {
    const { libro, huella } = await leerLibro(file);
    const crudas = filasHoja(libro, libro.SheetNames[0]);
    const { fila, mapa } = mapearEncabezados(crudas, COLS_PAGOS);
    const faltan = ["NIT", "PERIODO", "VALOR"].filter((c) => mapa[c] === undefined);
    const pagos = [];
    if (fila >= 0 && !faltan.length) {
      for (let i = fila + 1; i < crudas.length; i++) {
        const r = crudas[i];
        if (!r || r.every((c) => c === "" || c === null)) continue;
        const g = (k) => (mapa[k] === undefined ? "" : r[mapa[k]]);
        const fuente = U.normalizar(g("FUENTE")).replace(/\s/g, "_");
        pagos.push({
          _fila: i + 1,
          fuente: ["PILA_A", "PILA_I", "LOG_FIN"].includes(fuente) ? fuente : "CARGA_MANUAL",
          nit: String(g("NIT")).replace(/\D/g, "").slice(0, 9),
          periodo: aPeriodo(g("PERIODO")),
          planilla: String(g("PLANILLA") || "").replace(/\.0$/, ""),
          referencia: String(g("REFERENCIA") || `MAN-${i}`),
          fecha: aFecha(g("FECHA")),
          valor: aNumero(g("VALOR")),
        });
      }
    }
    return { archivo: file.name, tamano: file.size, huella, pagos, faltan };
  }

  /* ---------- Generación ---------- */

  function escribir(nombre, hojas, anchos = {}) {
    if (!disponible()) {
      const [primera] = Object.entries(hojas);
      const filas = primera[1];
      const csv = filas.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
      U.descargar(nombre.replace(/\.xlsx$/, ".csv"), "﻿" + csv, "text/csv;charset=utf-8");
      return;
    }
    const wb = XLSX.utils.book_new();
    Object.entries(hojas).forEach(([n, filas]) => {
      const ws = XLSX.utils.aoa_to_sheet(filas);
      if (anchos[n]) ws["!cols"] = anchos[n].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    XLSX.writeFile(wb, nombre);
  }

  const ENC_NOMINA = ["PERIODO", "TIPO_DOC", "DOCUMENTO", "NOMBRE", "CARGO", "CONCEPTO", "VALOR"];
  const ANCHOS = { Nomina: [10, 9, 14, 32, 30, 38, 14], Conceptos: [40, 20, 50], Instrucciones: [110] };

  function instrucciones(exp) {
    const ent = exp ? S21.store.entidad(exp.entidadId) : null;
    return [
      ["SIGREC-21 · Plantilla de nómina editable (PROTOTIPO · DATOS FICTICIOS)"],
      [ent ? `Entidad: ${ent.nombre} · NIT ${ent.nit} · Expediente ${exp.id}` : "Plantilla general"],
      [exp ? `Periodos requeridos: ${exp.periodos.map(U.periodo).join(", ")}` : ""],
      [""],
      ["1. Hoja Nomina: una fila por servidor, periodo y concepto devengado."],
      ["   PERIODO en formato AAAA-MM (ej. 2026-03). VALOR en pesos, sin decimales."],
      ["2. Hoja Conceptos: liste TODOS los conceptos de la nómina e indique en ES_FACTOR_SALARIAL si constituye factor salarial (SI) o no (NO)."],
      ["   Esta clasificación determina la base de liquidación del aporte (0,5 % · Ley 21 de 1982, art. 12)."],
      ["3. No cambie los nombres de las columnas. Puede agregar filas."],
      ["4. Guarde como .xlsx (o .csv solo con la hoja Nomina) y cárguelo en el aplicativo."],
    ];
  }

  function descargarPlantilla(exp) {
    const per = exp?.periodos?.[0] || "2026-01";
    escribir(`plantilla_nomina_SIGREC21${exp ? "_" + exp.id : ""}.xlsx`, {
      Instrucciones: instrucciones(exp),
      Nomina: [ENC_NOMINA, [per, "CC", "1012345678", "NOMBRE DE EJEMPLO (BORRAR)", "Profesional universitario", "SUELDO BASICO", 3500000]],
      Conceptos: [["CONCEPTO", "ES_FACTOR_SALARIAL", "OBSERVACION"], ...S21.gen.CONCEPTOS.map((c) => [c.nombre, "", ""])],
    }, ANCHOS);
  }

  /* Archivo diligenciado de ejemplo, coherente con los pagos ficticios de la entidad */
  function descargarEjemplo(exp) {
    const demo = exp.id === S21.seed.DEMO.expediente;
    const n = S21.gen.generarNomina({ semilla: demo ? S21.seed.DEMO.semilla : 4000 + Number(exp.id.slice(-4)), empleados: 32, periodos: exp.periodos });
    escribir(`nomina_ejemplo_${exp.id}.xlsx`, {
      Instrucciones: instrucciones(exp),
      Nomina: [ENC_NOMINA, ...n.filas.map((f) => [f.periodo, f.tipoDoc, f.documento, f.nombre, f.cargo, f.concepto, f.valor])],
      Conceptos: [["CONCEPTO", "ES_FACTOR_SALARIAL", "OBSERVACION"], ...n.conceptos.map((c) => [c.nombre, c.salarial ? "SI" : "NO", c.salarial ? "" : "No constituye salario"])],
    }, ANCHOS);
  }

  function descargarPlantillaPagos() {
    escribir("plantilla_pagos_fuente_autorizada.xlsx", {
      Pagos: [["FUENTE", "NIT", "PERIODO", "PLANILLA", "REFERENCIA", "FECHA", "VALOR"],
        ["LOG_FIN", "800111220", "2026-07", "8001234567", "ASO-123456", "2026-08-05", 1250000],
        ["PILA_A", "800111220", "2026-07", "8001234567", "A-8001234567", "2026-08-04", 1250000]],
    }, { Pagos: [10, 12, 10, 14, 16, 12, 14] });
  }

  /* Exportación de tablas (informes, auditoría) */
  function exportar(nombre, encabezados, filas) {
    escribir(nombre, { Datos: [encabezados, ...filas] }, { Datos: encabezados.map((e) => Math.max(12, String(e).length + 4)) });
  }

  return { disponible, leerNomina, leerPagos, descargarPlantilla, descargarEjemplo, descargarPlantillaPagos, exportar };
})();
