import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No prompt provided"}))
        return

    if sys.argv[1] == "--status":
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
        if not project_id:
            print(json.dumps({
                "success": False,
                "authenticated": False,
                "project_id": None,
                "error": "GOOGLE_CLOUD_PROJECT is not set"
            }))
            return
        
        account = "ADC Credentials"
        try:
            import google.auth
            credentials, default_project = google.auth.default()
            account = getattr(credentials, "service_account_email", None) or getattr(credentials, "_account", None) or "Google Cloud Authenticated"
        except Exception:
            pass

        print(json.dumps({
            "success": True,
            "authenticated": True,
            "project_id": project_id,
            "location": location,
            "account": account
        }))
        return

    prompt = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "gemini-2.5-flash"
    language = sys.argv[3] if len(sys.argv) > 3 else "auto"

    # Validate environment variables
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

    if not project_id:
        print(json.dumps({
            "success": False,
            "error": "GOOGLE_CLOUD_PROJECT is not set. Please configure your Google Cloud Project ID in VS Code Settings (agentPlatform.projectId) or set the GOOGLE_CLOUD_PROJECT environment variable."
        }))
        return

    try:
        from google import genai
        from google.genai.types import HttpOptions, GenerateContentConfig

        client = genai.Client(
            project=project_id,
            location=location,
            http_options=HttpOptions(api_version="v1")
        )

        # Construct System Instruction based on selected language & natural language switching rules
        lang_instructions = {
            "auto": "Respond in the same language as the user's input.",
            "en": "You MUST respond in English.",
            "ar": "You MUST respond in Arabic (العربية).",
            "de": "You MUST respond in German (Deutsch).",
            "es": "You MUST respond in Spanish (Español).",
            "fr": "You MUST respond in French (Français).",
            "hi": "You MUST respond in Hindi (हिन्दी).",
            "it": "You MUST respond in Italian (Italiano).",
            "ja": "You MUST respond in Japanese (日本語).",
            "ko": "You MUST respond in Korean (한국어).",
            "nl": "You MUST respond in Dutch (Nederlands).",
            "pt": "You MUST respond in Portuguese (Português).",
            "ru": "You MUST respond in Russian (Русский).",
            "zh": "You MUST respond in Chinese (中文)."
        }

        base_sys_prompt = lang_instructions.get(language, lang_instructions["auto"])
        full_sys_prompt = (
            f"You are a helpful AI Agent on Google Cloud Agent Platform. {base_sys_prompt} "
            "CRITICAL RULE: If the user explicitly asks in natural language to switch language or speak in a specific language "
            "(e.g., '英語で答えて', 'Respond in Spanish', '日本語に変更して', 'speak in German'), "
            "you MUST immediately switch your response language to that requested language for all current and future turns."
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=full_sys_prompt
            )
        )

        print(json.dumps({"success": True, "text": response.text}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
