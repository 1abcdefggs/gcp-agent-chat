"""
Google Cloud Agent Platform -GCP Authentication & Setup Wizard
This script includes gcloud CLI discovery, ADC browser authentication,
A wizard tool that saves project settings to .env files.
"""
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
        print(f"\n[ERROR] Authentication failed: {e}", file=sys.stderr)
        return False

def list_projects():
    """Fetch accessible Google Cloud projects."""
    try:
        result = subprocess.run(
            ["gcloud", "projects", "list", "--format=json"],
            capture_output=True, text=True, encoding="utf-8", check=True
        )
        projects = json.loads(result.stdout)
        return projects
    except Exception as e:
        print(f"[ERROR] Failed to list projects: {e}", file=sys.stderr)
        return []

def save_env_config(project_id, location="global"):
    """Save selected configuration to .env file while preserving existing comments/format."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    
    target_vars = {
        "GOOGLE_CLOUD_PROJECT": project_id,
        "GOOGLE_CLOUD_LOCATION": location,
        "GOOGLE_GENAI_USE_ENTERPRISE": "True"
    }

    updated_keys = set()
    new_lines = []

    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if "=" in line and not stripped.startswith("#"):
                    k, _ = stripped.split("=", 1)
                    k = k.strip()
                    if k in target_vars:
                        new_lines.append(f"{k}={target_vars[k]}\n")
                        updated_keys.add(k)
                        continue
                new_lines.append(line)

    for k, v in target_vars.items():
        if k not in updated_keys:
            new_lines.append(f"{k}={v}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"\n[CONFIG SAVED] Project ID: {project_id} | Location: {location}")
    print(f"Updated configuration in: {env_path}")

def interactive_setup():
    """Interactive CLI setup wizard."""
    if not check_gcloud():
        print("[ERROR] gcloud CLI is not installed or not in PATH.", file=sys.stderr)
        print("Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install", file=sys.stderr)
        return

    auth_success = authenticate_adc()
    if not auth_success:
        return

    print("\nFetching accessible Google Cloud Projects...")
    projects = list_projects()

    if not projects:
        print("[WARNING] No active Google Cloud projects found for this account.")
        project_id = ""
        while not project_id:
            project_id = input("Enter your Google Cloud Project ID manually: ").strip()
            if not project_id:
                print("Project ID cannot be empty. Please enter a valid Project ID.")
    else:
        print("\nAvailable Google Cloud Projects:")
        print("--------------------------------------------------")
        for idx, p in enumerate(projects, 1):
            name = p.get("name", p.get("projectId"))
            pid = p.get("projectId")
            print(f" [{idx}] {name} (ID: {pid})")
        print("--------------------------------------------------")

        while True:
            selection = input(f"Select a project number [1-{len(projects)}]: ").strip()
            try:
                selected_idx = int(selection) - 1
                if 0 <= selected_idx < len(projects):
                    project_id = projects[selected_idx].get("projectId")
                    break
                else:
                    print(f"Please select a number between 1 and {len(projects)}.")
            except ValueError:
                print("Please enter a valid number.")

    print(f"\nSelected Project: {project_id}")
    location = input("Enter target location/region [default: global]: ").strip() or "global"

    save_env_config(project_id, location)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--json-projects":
        print(json.dumps(list_projects()))
    else:
        interactive_setup()
