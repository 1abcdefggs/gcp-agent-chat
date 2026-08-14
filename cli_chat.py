import os
import sys

# Environment configuration
project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

if not project_id:
    print("[Error] GOOGLE_CLOUD_PROJECT environment variable is not set.")
    print("Please set your project ID (e.g. export GOOGLE_CLOUD_PROJECT='your-project-id' or $env:GOOGLE_CLOUD_PROJECT='your-project-id').")
    sys.exit(1)

from google import genai
from google.genai.types import HttpOptions

def start_interactive_chat():
    print("=" * 60)
    print(" ☁️  Google Cloud Agent Platform - Terminal Chat")
    print(" (Type 'exit' or 'quit' to terminate)")
    print("=" * 60)

    try:
        client = genai.Client(
            project=project_id,
            location=location,
            http_options=HttpOptions(api_version="v1")
        )
    except Exception as e:
        print(f"\n[Error] Failed to initialize Gemini Client: {e}")
        return

    model_name = "gemini-2.5-flash"
    print(f"\nActive Model: {model_name}\n")

    while True:
        try:
            user_input = input("You > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit"]:
                print("\nSession ended. Goodbye!")
                break

            print("\nAgent thinking...", end="\r", flush=True)

            response = client.models.generate_content(
                model=model_name,
                contents=user_input,
            )

            print(" " * 30, end="\r") # Clear loading text
            print(f"Agent > {response.text}\n")
            print("-" * 60)

        except KeyboardInterrupt:
            print("\nSession interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\n[Error]: {e}\n")

if __name__ == "__main__":
    start_interactive_chat()
