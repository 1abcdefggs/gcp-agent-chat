"""
Google Cloud Agent Platform - JSON-RPC Daemon & Backend Bridge
Handles IPC between the VS Code Extension (Node.js) and Google Cloud Vertex AI (Python SDK),
providing autonomous tool execution and multi-modal chat support.
"""
import sys
import json
import os
import re
import subprocess

def check_gcp_status(params=None):
    if params is None:
        params = {}
    project_id = params.get("projectId") or os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = params.get("location") or os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    token = params.get("token")
    auth_mode = params.get("authMode", "auto")

    account = "Google Cloud Authenticated"
    authenticated = False

    if token:
        account = params.get("account") or "Antigravity IDE User"
        authenticated = True
    else:
        try:
            import google.auth
            credentials, default_project = google.auth.default()
            if not project_id and default_project:
                project_id = default_project
            account = getattr(credentials, "service_account_email", None) or getattr(credentials, "_account", None) or "gcloud ADC Account"
            authenticated = True
        except Exception:
            account = "Not Authenticated"
            authenticated = False

    if not project_id:
        try:
            res = subprocess.run(["gcloud", "config", "get-value", "project"], capture_output=True, text=True, encoding="utf-8", timeout=5)
            p = res.stdout.strip()
            if p and p != "(unset)" and not p.startswith("ERROR"):
                project_id = p
        except Exception:
            pass

    if not project_id:
        return {
            "success": False,
            "authenticated": authenticated,
            "project_id": None,
            "location": location,
            "account": account,
            "error": "Google Cloud Project ID is not configured. Click Settings to set agentPlatform.projectId."
        }

    os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
    os.environ["GOOGLE_CLOUD_LOCATION"] = location

    return {
        "success": True,
        "authenticated": authenticated,
        "project_id": project_id,
        "location": location,
        "account": account,
        "auth_mode": auth_mode
    }

def read_file(filepath: str) -> str:
    """Read the text content of a file in the workspace or project repository.

    Args:
        filepath: Relative or absolute path to the file to read (e.g. 'package.json', 'src/extension.js').
    """
    if re.search(r'\.env(\.local|\.development|\.production|\.test)?', filepath, re.IGNORECASE):
        return "[Security Guardrail Error] Access to .env files is blocked by security policy."

    try:
        clean_path = filepath.strip("'\"")
        full_path = os.path.abspath(clean_path)
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        if len(content) > 12000:
            return content[:12000] + "\n\n...[Truncated remainder of file]..."
        return content or "(File is empty)"
    except Exception as e:
        return f"Error reading file '{filepath}': {str(e)}"

def list_files(dirpath: str = ".") -> str:
    """List files and subdirectories in a workspace directory.

    Args:
        dirpath: The path of the directory to list relative to workspace root. Defaults to '.' (root).
    """
    try:
        clean_dir = dirpath.strip("'\"") if dirpath else "."
        full_path = os.path.abspath(clean_dir)
        entries = os.listdir(full_path)
        formatted = []
        for name in entries:
            p = os.path.join(full_path, name)
            prefix = "[DIR] " if os.path.isdir(p) else "[FILE]"
            formatted.append(f"{prefix} {name}")
        return "\n".join(formatted) if formatted else "(Empty directory)"
    except Exception as e:
        return f"Error listing directory '{dirpath}': {str(e)}"

def run_command(command: str) -> str:
    """Execute a non-destructive shell command (e.g., git status, git log, dir) in the workspace directory.

    Args:
        command: The command line string to run.
    """
    if re.search(r'\.env', command, re.IGNORECASE):
        return "[Security Guardrail Error] Commands accessing .env files are blocked."
    if re.search(r'rm\s+-rf\s+(\/|~|\.\.|\/\*)', command, re.IGNORECASE):
        return "[Security Guardrail Error] Destructive deletion commands are blocked."
    if re.search(r'git\s+push\s+.*(--force|-f)', command, re.IGNORECASE):
        return "[Security Guardrail Error] Forced git push is blocked."

    try:
        res = subprocess.run(command, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15, cwd=os.getcwd())
        out = (res.stdout or "") + (f"\n[stderr]: {res.stderr}" if res.stderr else "")
        return out.strip() or "(Command completed with no output)"
    except Exception as e:
        return f"Command execution error: {str(e)}"

def handle_chat_message(params):
    prompt = params.get("prompt", "")
    model_name = params.get("model", "gemini-3.7-flash")
    language = params.get("language", "auto")
    
    project_id = params.get("projectId") or os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = params.get("location") or os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

    if not project_id:
        st = check_gcp_status(params)
        project_id = st.get("project_id")

    if not project_id:
        raise ValueError("Google Cloud Project ID is not set. Please configure 'agentPlatform.projectId' in VS Code Settings.")

    from google import genai
    from google.genai.types import HttpOptions, GenerateContentConfig

    token = params.get("token")
    credentials = None
    if token:
        try:
            from google.oauth2.credentials import Credentials
            credentials = Credentials(token=token)
        except Exception:
            pass

    client = genai.Client(
        project=project_id,
        location=location,
        credentials=credentials,
        http_options=HttpOptions(api_version="v1")
    )

    language_name = params.get("languageName", "Auto")

    if language == "auto" or language_name == "Auto":
        base_lang = "Respond in the same language as the user's input."
    else:
        base_lang = f"You MUST respond in {language_name}."

    sys_prompt = (
        f"You are a helpful and autonomous AI Agent on Google Cloud Agent Platform. {base_lang} "
        "You have full access to workspace inspection tools: `read_file`, `list_files`, and `run_command`. "
        "When the user asks about the workspace, repository, files, status, or code, ALWAYS use these tools to inspect the real files before answering. "
        "CRITICAL RULE: If the user explicitly asks in natural language to switch language, "
        "you MUST immediately switch your response language to that requested language."
    )

    tools = [read_file, list_files, run_command]

    contents = [prompt]
    images = params.get("images", [])
    if images and len(images) > 0:
        import base64
        from google.genai import types
        for img in images:
            b64_data = img.get("data", "")
            mime = img.get("mimeType", "image/png")
            if b64_data:
                raw_bytes = base64.b64decode(b64_data)
                contents.append(types.Part.from_bytes(data=raw_bytes, mime_type=mime))

    tool_map = {
        "read_file": read_file,
        "list_files": list_files,
        "run_command": run_command
    }

    accumulated_usage = {"prompt_tokens": 0, "candidates_tokens": 0}
    final_text = ""
    max_turns = 5

    for turn in range(max_turns):
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=GenerateContentConfig(
                system_instruction=sys_prompt,
                tools=tools
            )
        )

        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            accumulated_usage["prompt_tokens"] += getattr(response.usage_metadata, 'prompt_token_count', 0)
            accumulated_usage["candidates_tokens"] += getattr(response.usage_metadata, 'candidates_token_count', 0)

        # Check for function calls in response
        function_calls = getattr(response, 'function_calls', None)
        if not function_calls and hasattr(response, 'candidates') and response.candidates:
            for cand in response.candidates:
                if getattr(cand, 'content', None) and getattr(cand.content, 'parts', None):
                    for part in cand.content.parts:
                        if getattr(part, 'function_call', None):
                            if function_calls is None:
                                function_calls = []
                            function_calls.append(part.function_call)

        if function_calls:
            # Model requested tool calls
            if hasattr(response, 'candidates') and response.candidates and response.candidates[0].content:
                contents.append(response.candidates[0].content)

            response_parts = []
            for fc in function_calls:
                fn_name = getattr(fc, 'name', '')
                fn_args = getattr(fc, 'args', {}) or {}
                if isinstance(fn_args, dict):
                    fn_result = tool_map[fn_name](**fn_args) if fn_name in tool_map else f"Unknown tool: {fn_name}"
                else:
                    fn_result = f"Invalid arguments for {fn_name}"

                response_parts.append(
                    types.Part.from_function_response(
                        name=fn_name,
                        response={"result": str(fn_result)}
                    )
                )

            contents.append(types.Content(role="tool", parts=response_parts))
        else:
            # No tool calls: extract text
            if hasattr(response, 'text') and response.text:
                final_text = response.text
            elif hasattr(response, 'candidates') and response.candidates:
                for cand in response.candidates:
                    if getattr(cand, 'content', None) and getattr(cand.content, 'parts', None):
                        for part in cand.content.parts:
                            if getattr(part, 'text', None):
                                final_text += part.text
            break

    return {
        "success": True,
        "type": "text",
        "text": final_text or "(No text returned)",
        "usage": accumulated_usage
    }

def main():
    # Persistent stdio JSON-RPC 2.0 daemon mode
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stdin, 'reconfigure'):
            sys.stdin.reconfigure(encoding='utf-8')

        for line in sys.stdin:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                req = json.loads(line_str)
                req_id = req.get("id")
                method = req.get("method")
                params = req.get("params", {})

                if method == "gcp/checkStatus":
                    res = check_gcp_status(params)
                    print(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": res}), flush=True)
                elif method == "chat/sendMessage":
                    res = handle_chat_message(params)
                    print(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": res}), flush=True)
                else:
                    print(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"message": f"Method {method} not found"}}), flush=True)
            except Exception as e:
                req_id = req.get("id") if 'req' in locals() and isinstance(req, dict) else None
                print(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"message": str(e)}}), flush=True)
        return

    # One-shot backward compatibility execution
    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        print(json.dumps(check_gcp_status()))
        return

    if len(sys.argv) > 1:
        prompt = sys.argv[1]
        model_name = sys.argv[2] if len(sys.argv) > 2 else "gemini-3.7-flash"
        language = sys.argv[3] if len(sys.argv) > 3 else "auto"
        try:
            res = handle_chat_message({"prompt": prompt, "model": model_name, "language": language})
            print(json.dumps(res))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
    else:
        print(json.dumps({"error": "No prompt or mode provided"}))

if __name__ == "__main__":
    main()
