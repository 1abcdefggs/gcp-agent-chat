# Antigravity PreToolUse Lifecycle Hook - Windows PowerShell Security Guardrail
# Prevents unauthorized inspection/modification of .env files and destructive operations.

$ErrorActionPreference = "Stop"

try {
    $rawInput = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($rawInput)) {
        @{ decision = "allow" } | ConvertTo-Json -Compress
        exit 0
    }

    $payload = $rawInput | ConvertFrom-Json
    $argsObj = if ($payload.toolCall -and $payload.toolCall.args) { $payload.toolCall.args } else { $payload.arguments }
    $argsStr = if ($argsObj) { ($argsObj.PSObject.Properties.Value | Out-String) } else { $rawInput }

    # Rule A: Block access to .env files containing credentials
    if ($argsStr -match '\.env(\.local|\.development|\.production|\.test)?') {
        @{
            decision = "deny"
            reason   = "Security Guardrail: Direct access (read/write/delete) to .env configuration files is strictly prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Rule B: Block direct exporting of sensitive token variables
    if ($argsStr -match 'export\s+(GITHUB_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|AWS_ACCESS_KEY_ID)=') {
        @{
            decision = "deny"
            reason   = "Security Guardrail: Shell export of sensitive credential variables is prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Rule C: Block destructive recursive deletion commands
    if ($argsStr -match 'Remove-Item.*-Recurse.*-Force|rm\s+-rf\s+(/|~|\.\.)') {
        @{
            decision = "deny"
            reason   = "Security Guardrail: Destructive recursive directory removal is prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Rule D: Block forced git push
    if ($argsStr -match 'git\s+push\s+.*(--force|-f)') {
        @{
            decision = "deny"
            reason   = "Security Guardrail: Forced git push to remote repository is prohibited."
        } | ConvertTo-Json -Compress
        exit 0
    }

    # Allow tool execution if all rules pass
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0

} catch {
    # Fail safe: Allow execution on JSON parsing edge cases
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}
