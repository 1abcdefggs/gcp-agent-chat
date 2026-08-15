import sys
import json
import os

def check_gcp_status():
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    if not project_id:
        return {
            "success": False,
            "authenticated": False,
            "project_id": None,
            "location": location,
            "error": "GOOGLE_CLOUD_PROJECT is not set"
        }
    
    account = "ADC Credentials"
    try:
        import google.auth
        credentials, _ = google.auth.default()
        account = getattr(credentials, "service_account_email", None) or getattr(credentials, "_account", None) or "Google Cloud Authenticated"
    except Exception:
        account = "ADC Initialized"

    return {
        "success": True,
        "authenticated": True,
        "project_id": project_id,
        "location": location,
        "account": account
    }

def handle_chat_message(params):
    prompt = params.get("prompt", "")
    model_name = params.get("model", "gemini-3.7-flash")
    language = params.get("language", "auto")
    
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT is not set. Please configure it in Settings or environment variables.")

    from google import genai
    from google.genai.types import HttpOptions, GenerateContentConfig

    client = genai.Client(
        project=project_id,
        location=location,
        http_options=HttpOptions(api_version="v1")
    )

    lang_instructions = {
        "auto": "Respond in the same language as the user's input.",
        "ja": "You MUST respond in Japanese.",
        "en": "You MUST respond in English.",
        "es": "You MUST respond in Spanish.",
        "de": "You MUST respond in German.",
        "fr": "You MUST respond in French.",
        "zh": "You MUST respond in Chinese."
    }

    base_lang = lang_instructions.get(language, lang_instructions["auto"])
    sys_prompt = (
        f"You are a helpful AI Agent on Google Cloud Agent Platform. {base_lang} "
        "CRITICAL RULE: If the user explicitly asks in natural language to switch language, "
        "you MUST immediately switch your response language to that requested language."
    )

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=GenerateContentConfig(system_instruction=sys_prompt)
    )

    usage = {}
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        usage = {
            "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0),
            "candidates_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0)
        }

    return {
        "success": True,
        "text": response.text,
        "usage": usage
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
                    res = check_gcp_status()
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
