/* Almacén del prototipo. Los datos viven en el navegador (localStorage) y se reinician con
   "Reiniciar demo". No hay servidor: cada visitante ve su propia copia de los datos ficticios. */
S21.store = (function () {
  const CLAVE = "sigrec21.estado.v1";
  const CLAVE_SESION = "sigrec21.sesion.v1";
  let memoriaSesion = null; // respaldo si el navegador bloquea el almacenamiento

  const api = {
    db: null,

    cargar() {
      let datos = null;
      try { datos = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { datos = null; }
      if (!datos || datos.version !== S21.seed.VERSION) {
        datos = S21.seed.crear();
        api.db = datos;
        api.guardar();
      } else {
        api.db = datos;
      }
      return api.db;
    },

    guardar() {
      try { localStorage.setItem(CLAVE, JSON.stringify(api.db)); }
      catch (e) { console.warn("No fue posible guardar en el navegador; los cambios se perderán al recargar.", e); }
    },

    reiniciar() {
      api.db = S21.seed.crear();
      api.guardar();
      api.guardarSesion(null);
    },

    sesion() {
      try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null"); } catch (e) { return memoriaSesion; }
    },
    guardarSesion(s) {
      memoriaSesion = s;
      try {
        if (s) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
        else sessionStorage.removeItem(CLAVE_SESION);
      } catch (e) { /* se conserva en memoria */ }
    },

    /* Consultas frecuentes */
    entidad: (id) => api.db.entidades.find((e) => e.id === id),
    expediente: (id) => api.db.expedientes.find((e) => e.id === id),
    usuario: (id) => api.db.usuarios.find((u) => u.id === id),
    regla: (codigo) => api.db.reglas.find((r) => r.codigo === codigo),
    param: (codigo) => api.db.reglas.find((r) => r.codigo === codigo)?.valor,
    expedientesDe: (entidadId) => api.db.expedientes.filter((e) => e.entidadId === entidadId),
    entidadesPorNit: (nit) => api.db.entidades.filter((e) => e.nit === nit),
    lotesDe: (expId) => api.db.lotes.filter((l) => l.expedienteId === expId),
    alertasDe: (expId) => api.db.alertas.filter((a) => a.expedienteId === expId),
    pagosDeEntidad: (entidadId, periodos) =>
      api.db.pagos.filter((p) => p.entidadId === entidadId && (!periodos || periodos.includes(p.periodo))),

    /* Registro de actuaciones del expediente (módulo 7) */
    bitacora(expedienteId, accion, detalle, tipo, evidencia) {
      const a = S21.auth.actor();
      api.db.bitacora.push({
        id: S21.util.uid("bit"), expedienteId, fecha: S21.util.ahora(),
        actor: a.nombre, actorId: a.id, tipo: tipo || a.tipo, accion, detalle: detalle || "", evidencia: evidencia || null,
      });
    },

    /* Auditoría de cambios y consultas (módulo 9) */
    auditar(accion, objeto, detalle) {
      const a = S21.auth.actor();
      api.db.auditoria.push({
        id: S21.util.uid("aud"), fecha: S21.util.ahora(), usuario: a.nombre, usuarioId: a.id, rol: a.rol,
        accion, objeto, detalle: detalle || "",
      });
    },

    /* Notificaciones electrónicas simuladas (bandeja interna) */
    notificar(destino, asunto, cuerpo, expedienteId) {
      api.db.notificaciones.push({
        id: S21.util.uid("not"), fecha: S21.util.ahora(), destino, asunto, cuerpo, expedienteId: expedienteId || null, leida: false,
      });
    },

    /* Alertas: indicios sujetos a revisión humana. Evita duplicar una alerta abierta equivalente. */
    crearAlerta({ tipo, expedienteId = null, entidadId = null, pagoId = null, periodo = null, nit = null, detalle, prioridad = "Media" }) {
      const yaExiste = api.db.alertas.find((x) =>
        x.tipo === tipo && x.expedienteId === expedienteId && x.pagoId === pagoId && x.periodo === periodo && (x.nit || null) === nit &&
        ["ABIERTA", "EN_GESTION"].includes(x.estado));
      if (yaExiste) return yaExiste;
      const def = S21.cat.TIPOS_ALERTA[tipo];
      const exp = expedienteId ? api.expediente(expedienteId) : null;
      const al = {
        id: `AL-${String(api.db.secuencias.alerta++).padStart(4, "0")}`,
        tipo, fecha: S21.util.ahora(), expedienteId, entidadId: entidadId || exp?.entidadId || null, pagoId, periodo, nit,
        detalle, prioridad, estado: "ABIERTA", rolResponsable: def.rol,
        asignadoA: exp?.responsableId && ["DIFERENCIA_VALORES", "INFO_INCOMPLETA", "SOPORTE_PENDIENTE", "FUERA_DE_PLAZO"].includes(tipo) ? exp.responsableId : null,
        justificacion: "", historial: [{ fecha: S21.util.ahora(), estado: "ABIERTA", por: S21.auth.actor().nombre }],
      };
      api.db.alertas.push(al);
      api.notificar(def.rol, `Nueva alerta: ${def.txt}`, detalle, expedienteId);
      return al;
    },

    cambiarEstadoAlerta(alerta, estado, justificacion) {
      alerta.estado = estado;
      if (justificacion) alerta.justificacion = justificacion;
      alerta.historial.push({ fecha: S21.util.ahora(), estado, por: S21.auth.actor().nombre, nota: justificacion || "" });
      api.auditar(`Alerta ${S21.cat.ESTADOS_ALERTA[estado].txt.toLowerCase()}`, alerta.id, justificacion || "");
      if (alerta.expedienteId) {
        api.bitacora(alerta.expedienteId, `Alerta ${alerta.id} → ${S21.cat.ESTADOS_ALERTA[estado].txt}`,
          `${S21.cat.TIPOS_ALERTA[alerta.tipo].txt}. ${justificacion || ""}`.trim());
      }
    },

    siguienteExpedienteId() {
      const n = api.db.secuencias.expediente++;
      return `SG21-2026-${String(n).padStart(4, "0")}`;
    },
  };

  return api;
})();
