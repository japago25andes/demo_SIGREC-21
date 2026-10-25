/* Página de inicio y selección de usuario institucional (acceso simulado) */
(function () {
  const U = S21.util, ui = S21.ui, esc = U.esc;

  S21.vistas.inicio = {
    titulo: "Inicio",
    render(el) {
      const demo = S21.seed.DEMO;
      const expDemo = S21.store.expediente(demo.expediente);
      el.innerHTML = `
        <section class="hero">
          <h1>SIGREC-21</h1>
          <p><b>Sistema Integrado de Gestión de la Información del Recaudo asociado a las contribuciones de la Ley 21 de 1982.</b>
          Componente institucional que se ubica <b>después de las alertas</b> de SIGIP, Python y Power BI: organiza el requerimiento,
          la recepción de nóminas y soportes, la validación, el cruce, la conciliación y la trazabilidad de cada caso hasta su resultado.</p>
        </section>

        <div class="grid grid-2 mb-3">
          <div class="tarjeta entrada">
            <div class="icono" aria-hidden="true">🏛</div>
            <h2 class="mb-0">Entidad requerida</h2>
            <p class="muted mb-0">Para alcaldías, gobernaciones y entidades aportantes que recibieron un requerimiento de la ESAP.
            Ingrese con el <b>usuario y la clave temporal</b> indicados en el requerimiento.</p>
            <div class="credencial">Credencial de demostración (expediente ${esc(demo.expediente)}):<br>
              usuario <code>${esc(demo.usuario)}</code> · clave <code>${esc(demo.clave)}</code>
              ${expDemo && expDemo.estado !== "REQUERIDO" ? `<div class="small mt-1">Estado actual: ${esc(S21.cat.ESTADOS_EXPEDIENTE[expDemo.estado].txt)}</div>` : ""}
            </div>
            <div class="acciones"><a class="btn" href="#/entidad">Ingresar como entidad</a></div>
          </div>
          <div class="tarjeta entrada">
            <div class="icono" aria-hidden="true">🗂</div>
            <h2 class="mb-0">Consola ESAP</h2>
            <p class="muted mb-0">Para la Sede Central y las Direcciones Territoriales: Grupo de Recaudo y Cartera, Dirección Financiera,
            OTIC, Control Interno. Incluye los <b>9 módulos</b> de la propuesta técnica y se puede recorrer con cada rol funcional.</p>
            <p class="small muted mb-0">En la demostración se elige el usuario de una lista; no se solicitan contraseñas.</p>
            <div class="acciones"><a class="btn" href="#/esap">Ingresar a la consola</a></div>
          </div>
        </div>

        <div class="tarjeta mb-3">
          <h3>Secuencia funcional</h3>
          <div class="flujo">
            <div><b>Alerta SIGIP</b>SIGIP, Python y Power BI identifican dispersiones u omisiones aparentes.</div>
            <div><b>Requerimiento</b>La ESAP requiere a la entidad y habilita usuario y clave temporal por expediente.</div>
            <div><b>Registro y cargue</b>La entidad registra sus datos y carga nómina editable, factores salariales, PILA y soportes.</div>
            <div><b>Validación y cruce</b>Calidad de datos, asociación con PILA y operador financiero.</div>
            <div><b>Conciliación</b>Aporte esperado frente a lo recaudado; revisión humana de cada diferencia.</div>
            <div><b>Resultado trazable</b>Mesa técnica solo si hay diferencia material; cierre con evidencia.</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="tarjeta">
            <h3>Guion sugerido para la sustentación</h3>
            <ol class="small" style="padding-left:1.1rem;margin:0">
              <li>Entre a la <b>Consola ESAP</b> como <i>Laura Méndez (Gestora)</i> y abra <b>Tablero e informes</b>.</li>
              <li>En <b>Seguimiento y alertas → Insumo SIGIP</b>, genere un requerimiento nuevo y vea la credencial temporal.</li>
              <li>Salga e ingrese como <b>entidad</b> con la credencial de demostración. Descargue el <i>ejemplo diligenciado</i>, cárguelo y radique.</li>
              <li>Vuelva a la consola como <i>Martha Ortega (Validadora)</i>: valide la calidad del expediente ${esc(demo.expediente)}.</li>
              <li>Cambie a <i>Andrés Palacios (Conciliador)</i> y ejecute la conciliación: aparecen las diferencias por prima técnica no liquidada.</li>
              <li>Como <i>Carolina Ruiz (Revisora)</i>, confirme las diferencias y programe la mesa técnica; imprima el informe de verificación.</li>
              <li>Cierre con <b>Seguridad y auditoría</b>: toda la actuación quedó registrada.</li>
            </ol>
          </div>
          <div class="tarjeta">
            <h3>Alcance de este prototipo</h3>
            <ul class="small" style="padding-left:1.1rem;margin:0">
              <li>Todos los datos son <b>ficticios</b> y se guardan solo en este navegador. “Reiniciar demo” los restablece.</li>
              <li>La nómina en Excel se lee <b>de verdad</b> en el navegador y no se envía a ningún servidor.</li>
              <li>No hay integración real con PILA, el operador financiero, SIGIP ni el gestor documental: se simulan como fuentes autorizadas.</li>
              <li>El acceso es simulado. Una implementación real requiere servidor, autenticación y las validaciones jurídicas, documentales y de seguridad descritas en la propuesta.</li>
              <li>Las clasificaciones son <b>indicios</b> sujetos a revisión humana.</li>
            </ul>
          </div>
        </div>`;
    },
  };

  S21.vistas.esapLogin = {
    titulo: "Ingreso a la consola",
    render(el) {
      const db = S21.store.db;
      const tarjetas = db.usuarios.filter((u) => u.activo).map((u) => {
        const r = S21.auth.ROLES[u.rol];
        return `<button type="button" class="tarjeta entrada" style="text-align:left;cursor:pointer;font:inherit" data-accion="entrar" data-id="${u.id}">
          <div class="flex items-center gap-1"><span class="icono" style="width:40px;height:40px;font-size:0.95rem;font-weight:600">${esc(U.iniciales(u.nombre))}</span>
          <div><b>${esc(u.nombre)}</b><div class="small muted">${esc(u.cargo)}</div></div></div>
          <div>${ui.chip(r.nombre, "info")} ${u.dt !== "Sede Central" ? ui.chip("DT " + u.dt, "morado") : ""}</div>
          <div class="small muted">${esc(r.desc)}</div>
        </button>`;
      }).join("");
      el.innerHTML = `${ui.cabecera({ migas: [{ txt: "Inicio", href: "#/" }, { txt: "Consola ESAP" }], titulo: "¿Con qué rol desea ingresar?",
        descripcion: "Acceso simulado para la demostración. Cada rol ve las mismas pantallas, pero solo puede ejecutar las acciones que le corresponden (Propuesta técnica, sección 11.2). Dentro de la consola puede cambiar de usuario desde el encabezado." })}
        <div class="grid grid-3">${tarjetas}</div>`;
      ui.on(el, {
        entrar(b) {
          S21.auth.ingresarEsap(b.dataset.id);
          S21.store.guardar();
          S21.app.ir("#/esap/m8");
        },
      });
    },
  };
})();
