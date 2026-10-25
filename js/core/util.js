/* Utilidades generales. Todo el prototipo vive en el espacio de nombres global S21
   para funcionar sin servidor (GitHub Pages o doble clic en index.html). */
window.S21 = window.S21 || {};

S21.util = (function () {
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const fmtPesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const fmtNum = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  const pesos = (n) => fmtPesos.format(Math.round(Number(n) || 0));
  const num = (n) => fmtNum.format(Number(n) || 0);
  const pct = (n, dec = 1) => (n == null || !isFinite(n) ? "No aplica" : `${(n * 100).toFixed(dec).replace(".", ",")} %`);

  function fecha(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function fechaHora(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return `${fecha(iso)} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
  }
  /* "2026-03" -> "Mar 2026" */
  function periodo(p) {
    if (!p || !/^\d{4}-\d{2}$/.test(p)) return p || "—";
    const [a, m] = p.split("-");
    return `${MESES[Number(m) - 1]} ${a}`;
  }
  const ahora = () => new Date().toISOString();

  function sumarDias(iso, dias) {
    const d = new Date(iso);
    d.setDate(d.getDate() + dias);
    return d.toISOString();
  }
  function diasEntre(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  /* n-ésimo día hábil (lunes a viernes) del mes siguiente al periodo. Sin festivos: regla simplificada. */
  function diaHabilMesSiguiente(per, n) {
    const [a, m] = per.split("-").map(Number);
    const d = new Date(Date.UTC(a, m, 1)); // mes siguiente (m es 1-based)
    let habiles = 0;
    while (true) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) habiles++;
      if (habiles === n) return d.toISOString().slice(0, 10);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  let contador = 0;
  function uid(prefijo = "id") {
    contador = (contador + 1) % 1000;
    return `${prefijo}-${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  }

  /* Huella del archivo para detectar cargas duplicadas. SHA-256 si el navegador lo permite. */
  async function huella(buffer) {
    try {
      if (window.crypto && crypto.subtle) {
        const h = await crypto.subtle.digest("SHA-256", buffer);
        return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch (e) { /* contexto no seguro: se usa FNV-1a */ }
    let h = 0x811c9dc5;
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return "fnv1a-" + h.toString(16).padStart(8, "0");
  }

  function tamano(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
    return `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;
  }

  function descargar(nombre, contenido, tipo = "text/plain;charset=utf-8") {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* Contraseña temporal legible (sin caracteres ambiguos) */
  function claveTemporal(rnd = Math.random) {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < 10; i++) s += c[Math.floor(rnd() * c.length)];
    return s;
  }

  /* PRNG determinista para datos de ejemplo reproducibles */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
  const sumar = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const agruparPor = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return {
    esc, pesos, num, pct, fecha, fechaHora, periodo, ahora, sumarDias, diasEntre, diaHabilMesSiguiente,
    uid, huella, tamano, descargar, claveTemporal, mulberry32, normalizar, sumar, agruparPor, iniciales, MESES,
  };
})();
