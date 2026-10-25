# Servidor estático mínimo para probar el prototipo en Windows sin instalar nada.
# Uso:  powershell -ExecutionPolicy Bypass -File servidor-local.ps1 [-Puerto 8021]
# Luego abra http://localhost:8021/
param([int]$Puerto = 8021)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$tipos = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".png" = "image/png"; ".svg" = "image/svg+xml"; ".json" = "application/json"; ".txt" = "text/plain; charset=utf-8"; ".ico" = "image/x-icon"
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Puerto/")
$listener.Start()
Write-Host "SIGREC-21 disponible en http://localhost:$Puerto/  (Ctrl+C para detener)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $ruta = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($ruta)) { $ruta = "index.html" }
      $archivo = [IO.Path]::GetFullPath((Join-Path $raiz $ruta))
      if ($archivo.StartsWith($raiz) -and (Test-Path $archivo -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($archivo)
        $ext = [IO.Path]::GetExtension($archivo).ToLower()
        $ctx.Response.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { "application/octet-stream" }
        $ctx.Response.Headers.Add("Cache-Control", "no-store")
        $ctx.Response.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne "HEAD") { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else {
        $ctx.Response.StatusCode = 404
      }
    } catch {
      Write-Host "Error atendiendo $($ctx.Request.Url): $($_.Exception.Message)"
    } finally {
      $ctx.Response.Close()
    }
  }
} finally { $listener.Stop() }
