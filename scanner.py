import os
import re
import json

PATTERNS = {
    'CWE-798: Hardcoded Credentials': re.compile(r'(?i)(api[_-]?key|secret|password|bearer|auth[_-]?token)\s*=\s*[\'"][a-zA-Z0-9_\-\.]{16,}[\'"]'),
    'CWE-95: Unsafe eval/exec Code Execution': re.compile(r'\b(eval|exec)\s*\('),
    'CWE-78: OS Command Injection (shell=True)': re.compile(r'subprocess\.\w+\(.*shell\s*=\s*True'),
    'CWE-89: SQL Injection / Destructive SQL': re.compile(r'(?i)\b(DROP\s+TABLE|TRUNCATE\s+TABLE)\b'),
    'CWE-295: Disabled TLS/SSL Verification': re.compile(r'verify\s*=\s*False'),
    'CWE-22: Unchecked Relative Path Traversal': re.compile(r'\.\./\.\./')
}

IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', 'vscode-1.107.0', 'scratch', 'docs'}

results = []

for root, dirs, files in os.walk('.'):
    # filter directories
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
    for f in files:
        if f.endswith(('.js', '.py', '.ps1', '.json')) and not f.endswith('package-lock.json'):
            file_path = os.path.join(root, f)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as fp:
                    lines = fp.readlines()
                    for idx, line in enumerate(lines, 1):
                        for vuln_name, regex in PATTERNS.items():
                            if regex.search(line):
                                # exclude placeholders and rule definitions
                                if 'YOUR_PROJECT_ID' in line or 'Rule ' in line or 'example' in file_path.lower():
                                    continue
                                results.append({
                                    'file': file_path,
                                    'line': idx,
                                    'vulnerability': vuln_name,
                                    'code': line.strip()
                                })
            except Exception:
                pass

print(json.dumps({'total_issues': len(results), 'findings': results}, indent=2))
