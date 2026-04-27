$diagrams = @(
    @{ name = "01_architecture"; title = "01 - System Architecture Overview" },
    @{ name = "02_auth_flow"; title = "02 - Authentication Flow" },
    @{ name = "03_excel_upload_flow"; title = "03 - Excel Upload and QR Generation Flow" },
    @{ name = "04_qr_scan_flow"; title = "04 - Volunteer QR Scan Flow" },
    @{ name = "05_otp_flow"; title = "05 - OTP Manual Entry Flow" },
    @{ name = "06_public_scan_flow"; title = "06 - Public Self-Scan Flow" },
    @{ name = "07_entry_decision_tree"; title = "07 - Entry Decision Tree" }
)

$outputDir = "C:\Users\SAMEER LOHANI\qrb\flow_diagrams"
$configFile = "$outputDir\mermaid.config.json"

foreach ($d in $diagrams) {
    $input = "$outputDir\$($d.name).mmd"
    $output = "$outputDir\$($d.name).jpg"
    Write-Host "Generating: $($d.title)..."
    npx --yes @mermaid-js/mermaid-cli mmdc -i $input -o $output -c $configFile --width 1400 --height 900 --backgroundColor white
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Done: $output" -ForegroundColor Green
    } else {
        Write-Host "  Failed: $($d.name)" -ForegroundColor Red
    }
}

Write-Host "`nAll diagrams generated!" -ForegroundColor Cyan
