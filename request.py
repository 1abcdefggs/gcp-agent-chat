from google import genai
from google.genai.types import HttpOptions
import os

# Initialize the Gemini client.
# Note: This automatically reads the GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, 
# and GOOGLE_GENAI_USE_ENTERPRISE environment variables set in Step 1.
client = genai.Client(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
    http_options=HttpOptions(api_version="v1")
)

# Send a prompt request to the Google Cloud Agent Platform.
response = client.models.generate_content(
    # Specify the model. 
    # Available Serverless Google Models on Agent Platform:
    # - "gemini-3.7-flash"
    # - "gemini-3.6-flash"      (NEW: Latest GA model, near-Pro performance)
    # - "gemini-3.5-flash-lite" (NEW: Ultra-fast & cost-effective lightweight model)
    # - "gemini-3.5-flash"      (Standard Flash model)
    model="gemini-3.7-flash",
    
    # The actual text prompt (question) you want to ask the AI.
    
    contents="Hello, how are you?",
)

print("--- Response from Cloud ---")
# Display the response from the AI.
print(response.text)
print("--------------------------")
