# Why is it called `.example`?

## 1. To prevent the leakage of confidential information (API keys and authentication information)
The actual `.env` file contains **confidential information** such as project IDs, private keys, and passwords for the production environment.
Therefore, the `.env` file is normally not shared with Git (GitHub, etc.) and is registered in `.gitignore` so that it is not uploaded to the repository.

## 2. To share as a "template" for settings
However, if the `.env` file itself is not uploaded to Git, other developers and users will not know what environment variables to set.
Therefore, **an "environment variable file template" with empty values or dummies (such as `YOUR_PROJECT_ID`)** is created as [.env.example](file:///c:/google-cloud-agent-platform/.env.example) and registered in Git for sharing.



## Actual Usage

To use and set up this project, follow these steps:

1. Copy [.env.example](file:///c:/google-cloud-agent-platform/.env.example) to the same directory and save it as **`.env`**.
2. Open the created `.env` file and replace `YOUR_PROJECT_ID` with your actual GCP project ID.

```bash
# Example command (copy and create .env)
cp .env.example .env
```