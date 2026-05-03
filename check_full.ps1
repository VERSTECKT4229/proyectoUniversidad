Start-Sleep -Seconds 4
Write-Output "=== PHP PROCESSES ==="
Get-Process php -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | Format-Table | Out-String | Write-Output

Write-Output "=== LOCAL TEST ==="
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/index.html" -UseBasicParsing -TimeoutSec 10
    Write-Output ("LOCAL_STATUS=" + $r.StatusCode)
} catch {
    Write-Output "LOCAL_STATUS=ERR"
    Write-Output $_.Exception.Message
}

Write-Output "=== PUBLIC TEST ==="
$u = (Get-Content tunnel_live.txt -Raw).Trim()
Write-Output ("URL=" + $u)
try {
    $r = Invoke-WebRequest -Uri ($u + "/index.html") -UseBasicParsing -TimeoutSec 25
    Write-Output ("PUBLIC_INDEX=" + $r.StatusCode)
} catch {
    if ($_.Exception.Response) {
        Write-Output ("PUBLIC_INDEX=" + [int]$_.Exception.Response.StatusCode)
    } else {
        Write-Output "PUBLIC_INDEX=ERR"
    }
}
