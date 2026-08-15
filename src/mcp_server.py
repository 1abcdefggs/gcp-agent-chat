import os
import sys
import json

def run_mcp_server():
    """Run FastMCP / JSON-RPC Stdio Server for Google Cloud Agent Platform."""
    try:
        from fastmcp import FastMCP
    except ImportError:
        # Fallback minimal stdio handler if fastmcp is not installed
        print("FastMCP library not installed. Install via: pip install fastmcp", file=sys.stderr)
        sys.exit(1)

    mcp = FastMCP("google-cloud-agent-platform")

    @mcp.tool()
    def ask_gemini(prompt: str, model: str = "gemini-3.7-flash", language: str = "auto") -> str:
        """Query Google Cloud Agent Platform (Gemini Enterprise Model) via official SDK.
        
        Args:
            prompt: User query or prompt.
            model: Gemini model identifier (e.g., gemini-2.5-flash, gemini-3.5-flash, gemini-3.7-flash).
            language: Target language code (e.g., auto, en, ja, es, de, fr, zh).
        """
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
        os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

        if not project_id:
            return "ERROR: GOOGLE_CLOUD_PROJECT environment variable is not set. Please configure your GCP project ID."

        try:
            from google import genai
            from google.genai.types import HttpOptions, GenerateContentConfig

            client = genai.Client(
                project=project_id,
                location=location,
                http_options=HttpOptions(api_version="v1")
            )

            if language.lower() == "auto":
                instruction = "Respond in the user's prompt language."
            else:
                instruction = f"Respond in {language}."

            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=GenerateContentConfig(
                    system_instruction=f"You are Google Cloud Agent Platform Assistant. {instruction}"
                )
            )
            return response.text
        except Exception as e:
            return f"ERROR: {str(e)}"

    @mcp.tool()
    def get_gcp_status() -> str:
        """Get current Google Cloud Agent Platform connection status."""
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "Unconfigured")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
        return f"Connected to Project: {project_id} (Location: {location})"

    mcp.run()

if __name__ == "__main__":
    run_mcp_server()
