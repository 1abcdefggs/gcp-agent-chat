# Antigravity PreToolUse Lifecycle Hook - Windows PowerShell Security Guardrail
# Prevents unauthorized inspection/modification of .env files and destructive operations.

$ErrorActionPreference = "Stop"

try {
    $rawInput = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($rawInput)) {
        @{ status = "allow" } | ConvertTo-Json -Compress
        exit 0
    }

    $payload = $rawInput | ConvertFrom-Json
    $argsStr = ($payload.arguments.PSObject.Properties.Value | Out-String)

    # Rule A: Block access to .env files containing credentials
    if ($argsStr -match '\.env(\.local|\.development|\.production|\.test)?') {
        @{
            status  = "deny"
            message = "Security Guardrail: Direct access (read/write/delete) to .env configuration files is strictly prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Rule B: Block direct exporting of sensitive token variables
    if ($argsStr -match 'export\s+(GITHUB_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|AWS_ACCESS_KEY_ID)=') {
        @{
            status  = "deny"
            message = "Security Guardrail: Shell export of sensitive credential variables is prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Rule C: Block destructive recursive deletion commands
    if ($argsStr -match 'Remove-Item.*-Recurse.*-Force|rm\s+-rf\s+(/|~|\.\.)') {
        @{
            status  = "deny"
            message = "Security Guardrail: Destructive recursive directory removal is prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Rule D: Block forced git push
    if ($argsStr -match 'git\s+push\s+.*(--force|-f)') {
        @{
            status  = "deny"
            message = "Security Guardrail: Forced git push to remote repository is prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Allow tool execution if all rules pass
    @{ status = "allow" } | ConvertTo-Json -Compress
    exit 0

} catch {
    # Fail safe: Allow execution on JSON parsing edge cases
    @{ status = "allow" } | ConvertTo-Json -Compress
    exit 0
}
