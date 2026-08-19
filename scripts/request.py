from google import genai
from google.genai.types import HttpOptions
import os

client = genai.Client(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
    http_options=HttpOptions(api_version="v1")
)

response = client.models.generate_content(
    model="gemini-3.7-flash",
    contents="Hello! Please reply in one short friendly sentence to confirm the connection.",
)

print("--- Response from Cloud ---")
print(response.text.strip())
print("--------------------------")
