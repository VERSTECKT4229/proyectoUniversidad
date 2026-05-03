$u = (Get-Content tunnel_live.txt -Raw).Trim()
Write-Output ("URL=" + $u)

try {
    $r = Invoke-WebRequest -Uri ($u + "/index.html") -UseBasicParsing -TimeoutSec 30
    Write-Output ("INDEX_STATUS=" + $r.StatusCode)
} catch {
    if ($_.Exception.Response) {
        Write-Output ("INDEX_STATUS=" + [int]$_.Exception.Response.StatusCode)
    } else {
        Write-Output "INDEX_STATUS=ERR"
    }
}

try {
    $r = Invoke-WebRequest -Uri ($u + "/") -UseBasicParsing -TimeoutSec 30
    Write-Output ("ROOT_STATUS=" + $r.StatusCode)
} catch {
    if ($_.Exception.Response) {
        Write-Output ("ROOT_STATUS=" + [int]$_.Exception.Response.StatusCode)
    } else {
        Write-Output "ROOT_STATUS=ERR"
    }
}
