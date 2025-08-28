import os, json
key = json.load(open(os.environ["GOOGLE_APPLICATION_CREDENTIALS"], "r", encoding="utf-8"))
print("project_id:", key.get("project_id"))
print("client_email:", key.get("client_email"))
