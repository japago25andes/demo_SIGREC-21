/* Roles funcionales conceptuales (Propuesta técnica, sección 11.2) y permisos del prototipo.
   El acceso es SIMULADO: en GitHub Pages no existe servidor que pueda proteger datos. */
S21.auth = (function () {
  const ROLES = {
    admin_funcional: {
      nombre: "Administrador funcional",
      desc: "Gestiona catálogos, estados, parámetros y responsables autorizados.",
      permisos: ["ver", "entidades.editar", "requerimiento.crear", "reglas.editar", "alerta.gestionar", "alerta.asignar", "usuarios.ver"],
    },
    gestor: {
      nombre: "Gestor de recaudo",
      desc: "Consulta, revisa y documenta registros de seguimiento.",
      permisos: ["ver", "entidades.editar", "requerimiento.crear", "recepcion.cargar", "calidad.validar", "alerta.gestionar", "expediente.gestionar"],
    },
    conciliador: {
      nombre: "Conciliador de información",
      desc: "Relaciona fuentes, pagos, periodos y diferencias.",
      permisos: ["ver", "recepcion.cargar", "cruce.asociar", "conciliacion.ejecutar", "alerta.gestionar", "expediente.gestionar"],
    },
    revisor: {
      nombre: "Revisor",
      desc: "Confirma, devuelve, descarta o escala resultados dentro del flujo de recaudo.",
      permisos: ["ver", "diferencia.revisar", "mesa.programar", "alerta.gestionar", "expediente.gestionar"],
    },
    validador: {
      nombre: "Validador funcional",
      desc: "Valida resultados funcionales sin sustituir aprobaciones institucionales.",
      permisos: ["ver", "calidad.validar", "diferencia.revisar", "mesa.programar", "expediente.cerrar", "alerta.gestionar", "alerta.asignar", "expediente.gestionar"],
    },
    apoyo: {
      nombre: "Usuario de apoyo (Dirección Territorial)",
      desc: "Atiende tareas asignadas por el área competente o la dirección territorial.",
      permisos: ["ver", "alerta.gestionar", "expediente.gestionar"],
    },
    consulta: {
      nombre: "Usuario de consulta",
      desc: "Consulta tableros e informes según permisos.",
      permisos: ["ver"],
    },
    auditor: {
      nombre: "Auditor",
      desc: "Consulta la trazabilidad sin modificar información.",
      permisos: ["ver", "auditoria.ver", "usuarios.ver"],
    },
    admin_tecnico: {
      nombre: "Administrador técnico (OTIC)",
      desc: "Gestiona seguridad, disponibilidad, respaldo e integración.",
      permisos: ["ver", "usuarios.ver", "usuarios.editar", "credenciales.gestionar", "auditoria.ver", "sistema.reiniciar"],
    },
  };

  const PERMISOS = {
    "ver": "Consultar información",
    "entidades.editar": "Editar maestro de entidades",
    "requerimiento.crear": "Generar requerimientos y credenciales temporales",
    "recepcion.cargar": "Cargar lotes de fuentes autorizadas",
    "calidad.validar": "Validar calidad y estructura",
    "cruce.asociar": "Asociar pagos y ejecutar cruces",
    "conciliacion.ejecutar": "Ejecutar conciliación",
    "diferencia.revisar": "Confirmar o descartar diferencias",
    "mesa.programar": "Programar mesa técnica",
    "expediente.gestionar": "Registrar actuaciones en el expediente",
    "expediente.cerrar": "Registrar resultado y cerrar expediente",
    "alerta.gestionar": "Gestionar alertas",
    "alerta.asignar": "Asignar responsables",
    "reglas.editar": "Versionar reglas y parámetros",
    "usuarios.ver": "Ver usuarios y roles",
    "usuarios.editar": "Administrar usuarios",
    "credenciales.gestionar": "Revocar o extender credenciales temporales",
    "auditoria.ver": "Consultar auditoría",
    "sistema.reiniciar": "Reiniciar datos de demostración",
  };

  function sesion() { return S21.store.sesion(); }

  function usuarioActual() {
    const s = sesion();
    if (!s || s.tipo !== "esap") return null;
    return S21.store.db.usuarios.find((u) => u.id === s.usuarioId) || null;
  }

  function puede(permiso) {
    const u = usuarioActual();
    if (!u) return false;
    return (ROLES[u.rol]?.permisos || []).includes(permiso);
  }

  /* Nombre del actor para bitácora y auditoría */
  function actor() {
    const s = sesion();
    if (s?.tipo === "entidad") {
      const exp = S21.store.expediente(s.expedienteId);
      const ent = exp && S21.store.entidad(exp.entidadId);
      return { id: s.usuario, nombre: `${ent?.nombre || "Entidad"} (usuario temporal)`, rol: "entidad", tipo: "entidad" };
    }
    const u = usuarioActual();
    if (u) return { id: u.id, nombre: u.nombre, rol: u.rol, tipo: "esap" };
    return { id: "sistema", nombre: "SIGREC-21 (automático)", rol: "sistema", tipo: "sistema" };
  }

  function ingresarEsap(usuarioId) {
    S21.store.guardarSesion({ tipo: "esap", usuarioId, desde: S21.util.ahora() });
    const u = usuarioActual();
    S21.store.auditar("Inicio de sesión", "Sesión", `${u.nombre} ingresó con rol ${ROLES[u.rol].nombre}`);
  }

  /* Acceso de la entidad: usuario y clave temporal vinculados al expediente, con vigencia limitada */
  function ingresarEntidad(usuario, clave) {
    const db = S21.store.db;
    const exp = db.expedientes.find((e) => e.credencial && e.credencial.usuario.toUpperCase() === String(usuario).trim().toUpperCase());
    if (!exp || exp.credencial.clave !== String(clave).trim()) return { ok: false, msg: "Usuario o clave temporal incorrectos." };
    if (!exp.credencial.activa) return { ok: false, msg: "La credencial fue revocada. Comuníquese con el Grupo de Recaudo y Cartera." };
    if (new Date(exp.credencial.vence) < new Date()) return { ok: false, msg: `La credencial venció el ${S21.util.fecha(exp.credencial.vence)}. Solicite una nueva al Grupo de Recaudo y Cartera.` };
    S21.store.guardarSesion({ tipo: "entidad", expedienteId: exp.id, usuario: exp.credencial.usuario, desde: S21.util.ahora() });
    exp.credencial.ultimoAcceso = S21.util.ahora();
    if (exp.estado === "REQUERIDO") {
      exp.estado = "EN_CARGUE";
      S21.store.bitacora(exp.id, "Primer ingreso de la entidad", "La entidad accedió con la credencial temporal e inició el registro de información.", "entidad");
    }
    S21.store.auditar("Inicio de sesión (entidad)", `Expediente ${exp.id}`, `Acceso con credencial temporal ${exp.credencial.usuario}`);
    S21.store.guardar();
    return { ok: true, expediente: exp };
  }

  function salir() {
    const a = actor();
    if (a.tipo !== "sistema") S21.store.auditar("Cierre de sesión", "Sesión", a.nombre);
    S21.store.guardarSesion(null);
  }

  return { ROLES, PERMISOS, usuarioActual, puede, actor, ingresarEsap, ingresarEntidad, salir, sesion };
})();
