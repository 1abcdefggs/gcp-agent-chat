import subprocess
import json
import os
import sys

def check_gcloud():
    """Verify that gcloud CLI is available."""
    try:
        subprocess.run(["gcloud", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def authenticate_adc():
    """Trigger browser-based Application Default Credentials (ADC) login."""
    print("==================================================")
    print(" Google Cloud Authentication Setup Wizard")
    print("==================================================")
    print("Launching browser for Google Cloud ADC Login...")
    print("OAuth Success URL: https://docs.cloud.google.com/sdk/auth_success\n")
    try:
        subprocess.run(["gcloud", "auth", "application-default", "login"], check=True)
        print("\n[SUCCESS] Authentication completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Authentication failed: {e}")
        return False

def list_projects():
    """Fetch accessible Google Cloud projects."""
    try:
        result = subprocess.run(
            ["gcloud", "projects", "list", "--format=json"],
            capture_output=True, text=True, check=True
        )
        projects = json.loads(result.stdout)
        return projects
    except Exception as e:
        print(f"[ERROR] Failed to list projects: {e}")
        return []

def save_env_config(project_id, location="global"):
    """Save selected configuration to .env file."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    
    existing = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    existing[k] = v

    existing["GOOGLE_CLOUD_PROJECT"] = project_id
    existing["GOOGLE_CLOUD_LOCATION"] = location
    existing["GOOGLE_GENAI_USE_ENTERPRISE"] = "True"

    with open(env_path, "w", encoding="utf-8") as f:
        for k, v in existing.items():
            f.write(f"{k}={v}\n")

    print(f"\n[CONFIG SAVED] Project ID: {project_id} | Location: {location}")
    print(f"Updated configuration in: {env_path}")

def interactive_setup():
    """Interactive CLI setup wizard."""
    if not check_gcloud():
        print("[ERROR] gcloud CLI is not installed or not in PATH.")
        print("Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install")
        return

    auth_success = authenticate_adc()
    if not auth_success:
        return

    print("\nFetching accessible Google Cloud Projects...")
    projects = list_projects()

    if not projects:
        print("[WARNING] No active Google Cloud projects found for this account.")
        project_id = input("Enter your Google Cloud Project ID manually: ").strip()
    else:
        print("\nAvailable Google Cloud Projects:")
        print("--------------------------------------------------")
        for idx, p in enumerate(projects, 1):
            name = p.get("name", p.get("projectId"))
            pid = p.get("projectId")
            print(f" [{idx}] {name} (ID: {pid})")
        print("--------------------------------------------------")

        selection = input(f"Select a project number [1-{len(projects)}]: ").strip()
        try:
            selected_idx = int(selection) - 1
            if 0 <= selected_idx < len(projects):
                project_id = projects[selected_idx].get("projectId")
            else:
                project_id = projects[0].get("projectId")
        except ValueError:
            project_id = projects[0].get("projectId")

    print(f"\nSelected Project: {project_id}")
    location = input("Enter target location/region [default: global]: ").strip() or "global"

    save_env_config(project_id, location)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--json-projects":
        print(json.dumps(list_projects()))
    else:
        interactive_setup()
