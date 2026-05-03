Start-Sleep -Seconds 10
$u = (Get-Content tunnel_live.txt -Raw).Trim()
Write-Output ("URL=" + $u)
try {
    $r = Invoke-WebRequest -Uri ($u + "/index.html") -UseBasicParsing -TimeoutSec 30
    Write-Output ("STATUS=" + $r.StatusCode)
} catch {
    if ($_.Exception.Response) {
        Write-Output ("STATUS=" + [int]$_.Exception.Response.StatusCode)
    } else {
        Write-Output "STATUS=ERR"
        Write-Output $_.Exception.Message
    }
}
