# SIGREC-21 · Prototipo funcional

**Sistema Integrado de Gestión de la Información del Recaudo asociado a las contribuciones de la Ley 21 de 1982.**
Prototipo académico de la propuesta técnica del Equipo 4 (Convocatoria Mejor Equipo de Trabajo ESAP 2026).

> ⚠️ **Prototipo con datos ficticios.** No es un sistema oficial de la ESAP. Ninguna entidad, NIT, persona ni valor corresponde a la realidad.
> Las alertas y clasificaciones son indicios sujetos a revisión humana y no producen efectos jurídicos, contables ni administrativos.

## Qué demuestra

SIGREC-21 se ubica **después de las alertas** de SIGIP, Python y Power BI:

1. **Alerta SIGIP**: el insumo identifica presuntos omisos o morosos.
2. **Requerimiento**: la ESAP requiere a la entidad y habilita un **usuario y una clave temporal por expediente**.
3. **Registro y cargue**: la entidad registra sus datos y carga la **nómina editable en Excel**, la **clasificación de factores salariales**, la PILA y los soportes.
4. **Validación y cruce**: control de calidad y asociación con los pagos de PILA y del operador financiero.
5. **Conciliación**: aporte esperado (0,5 % de la base salarial) frente a lo recaudado, con revisión humana de cada diferencia.
6. **Resultado trazable**: mesa técnica solo si la diferencia es material; cierre con bitácora y auditoría.

### Los 9 módulos de la propuesta técnica (sección 10)

| # | Módulo | Dónde está |
|---|--------|-----------|
| 1 | Maestro de entidades aportantes | `js/modulos/m1-maestro.js` |
| 2 | Recepción y carga controlada | `js/modulos/m2-recepcion.js` |
| 3 | Calidad y estructuración | `js/modulos/m3-calidad.js` |
| 4 | Asociación y cruce | `js/modulos/m4-cruce.js` |
| 5 | Conciliación y diferencias | `js/modulos/m5-conciliacion.js` |
| 6 | Seguimiento y alertas | `js/modulos/m6-alertas.js` |
| 7 | Expediente de seguimiento | `js/modulos/m7-expediente.js` |
| 8 | Tablero e informes | `js/modulos/m8-tablero.js` |
| 9 | Seguridad y auditoría | `js/modulos/m9-seguridad.js` |

Además están el **portal de la entidad requerida** (`js/portal/portal-entidad.js`) y los **roles funcionales** de la sección 11.2 (`js/core/auth.js`).

### Casos de referencia precargados (diseño del piloto, sección 13)

| Expediente | Caso |
|-----------|------|
| SG21-2026-0001 | Pago correctamente conciliado |
| SG21-2026-0002 | Pago sin asociación clara (NIT mal digitado) |
| SG21-2026-0003 | Diferencia entre valores → mesa técnica |
| SG21-2026-0004 | Registro duplicado |
| SG21-2026-0005 | Información incompleta (faltan periodos) |
| SG21-2026-0006 | Caso con soporte disperso |
| SG21-2026-0007 | Diferencia previamente descartada |
| SG21-2026-0008 | Caso remitido a otra dependencia (Jurídica) |
| **SG21-2026-0009** | **Demostración en vivo** · usuario `SG21-0009` · clave `VsR7q2Kp9m` |
| SG21-2026-0010 | Requerimiento sin respuesta (credencial vencida) |

## Guion de demostración (≈10 minutos)

1. **Consola ESAP** → *Laura Méndez (Gestora)* → **Tablero e informes**.
2. **Seguimiento y alertas → Insumo SIGIP** → *Generar requerimiento*: se crea el expediente con su credencial temporal.
3. **Salir** → **Entidad requerida** → credencial de demostración.
   Datos de la entidad → **Nómina**: *Ejemplo diligenciado* → cargar ese mismo archivo → ver validación y factores salariales → guardar.
   **Soportes**: cargar cualquier PDF como PILA, comprobante y certificación → **Radicar**.
4. Consola como *Martha Ortega (Validadora)* → expediente **SG21-2026-0009** → *Validación funcional* → aprobar.
5. Como *Andrés Palacios (Conciliador)* → *Ejecutar conciliación*: aparecen las diferencias. La entidad no liquidó la **prima técnica**, aunque la certificó como factor salarial, y no pagó mayo.
6. Como *Carolina Ruiz (Revisora)* → confirmar las diferencias → *Programar mesa técnica* → *Informe de verificación* (imprimible).
7. Como *Martha Ortega* → registrar el acta y el resultado.
8. Como *Sandra Vélez (Auditora)* → **Seguridad y auditoría**: todo quedó registrado.

Use **Reiniciar demo** (barra superior) antes de presentar.

## Tecnología

- HTML, CSS y JavaScript sin compilación ni dependencias de instalación. Funciona en **GitHub Pages** tal cual.
- [SheetJS](https://sheetjs.com/) (desde cdnjs) lee y genera archivos Excel **en el navegador**: la nómina no se envía a ningún servidor.
- Los datos se guardan en el `localStorage` del navegador de cada visitante; cada persona ve su propia copia.
- Línea gráfica tomada de esap.edu.co: fuente Montserrat, azul institucional `#144A8A` / `#0C4DA2`.

```
sigrec21-prototipo/
├── index.html
├── assets/css/        tokens · base · layout · components · print
├── assets/img/        logo y favicon
├── js/core/           util · catalogos · store · auth · generador · reglas · seed · excel · ui · app
├── js/portal/         portal de la entidad requerida
├── js/modulos/        acciones compartidas + módulos 1 a 9
└── servidor-local.ps1 servidor de prueba para Windows
```

## Probar localmente

En muchos navegadores basta con hacer doble clic sobre `index.html`. Para una prueba igual a GitHub Pages se recomienda un servidor local:

**Windows (sin instalar nada):**

```bash
powershell -ExecutionPolicy Bypass -File servidor-local.ps1
```

Luego abra <http://localhost:8021/>.

**Con Python:** `python -m http.server 8021` · **Con Node:** `npx serve .`

## Publicar en GitHub Pages (gratis)

1. Cree un repositorio **público** en GitHub; Pages es gratis para repositorios públicos.
2. Suba el **contenido de esta carpeta** a la raíz del repositorio (rama `main`).
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)`** → Save.
4. En 1 o 2 minutos el sitio queda en `https://<usuario>.github.io/<repositorio>/`.

El archivo `.nojekyll` evita el procesamiento de Jekyll. `robots.txt` y la etiqueta `noindex` le piden a los buscadores no indexar el prototipo.

> No suba al repositorio público los documentos del proyecto (PDF, DOCX, correos): contienen información interna y datos personales.

## Reglas de negocio implementadas (versionadas en el módulo 9)

| Código | Regla | Valor inicial |
|--------|-------|---------------|
| R01 | Tarifa del aporte ESAP (Ley 21/1982, art. 12) | 0,5 % de la base salarial |
| R02 | Aproximación del aporte | Centena superior |
| R03 | Tolerancia de conciliación | $ 1.000 |
| R04 | Umbral de diferencia material (procede mesa técnica) | $ 500.000 |
| R05 | Fecha límite de pago según los dos últimos dígitos del NIT | Regla simplificada, sin festivos |
| R06 | Plazo del requerimiento / vigencia de la credencial | 15 días |
| R07 | Meses de nómina requeridos | 6 |
| R08 | Asociación automática por NIT único | — |

Las validaciones de calidad de la nómina (R-V01 a R-V08) cubren campos obligatorios, formato de periodo, periodos requeridos, duplicados, conceptos sin clasificar, valores y documentos.

## Límites del prototipo

- El acceso es **simulado**: en un sitio estático no hay servidor que proteja datos. No cargue información real.
- No hay integración real con SIGIP, PILA, el operador financiero ni el gestor documental; se simulan como fuentes autorizadas.
- Los soportes (PDF) solo registran nombre, tamaño y huella; no se almacenan.
- Una implementación real requiere las validaciones jurídica, documental, tecnológica y de seguridad descritas en la propuesta técnica.
