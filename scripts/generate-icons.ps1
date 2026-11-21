$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public'))
foreach ($iconSize in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap $iconSize, $iconSize
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform(($iconSize / 512.0), ($iconSize / 512.0))
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#315849'))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#f6f3eb')), 25
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $outline = New-Object System.Drawing.Drawing2D.GraphicsPath
    $outline.AddArc(121,143,74,74,180,90)
    $outline.AddArc(317,143,74,74,270,90)
    $outline.AddArc(317,322,74,74,0,90)
    $outline.AddArc(121,322,74,74,90,90)
    $outline.CloseFigure()
    $graphics.DrawPath($pen, $outline)
    $graphics.DrawLine($pen,121,221,391,221)
    $graphics.DrawLine($pen,192,115,192,174)
    $graphics.DrawLine($pen,320,115,320,174)
    $points = [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF 197,287),(New-Object System.Drawing.PointF 239,329),(New-Object System.Drawing.PointF 318,250))
    $graphics.DrawLines($pen, $points)
    $bitmap.Save((Join-Path $iconRoot "icon-$iconSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $outline.Dispose()
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
