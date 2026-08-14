import os
import sys
from google import genai
from google.genai.types import HttpOptions

project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

if not project_id:
    print("Error: GOOGLE_CLOUD_PROJECT environment variable is required.")
    sys.exit(1)

client = genai.Client(
    project=project_id,
    location=location,
    http_options=HttpOptions(api_version="v1")
)

prompt = sys.argv[1] if len(sys.argv) > 1 else "Hello from Google Cloud Agent Platform SDK!"

response = client.models.generate_content(
    model="gemini-3.7-flash",
    contents=prompt,
)

print(response.text)
