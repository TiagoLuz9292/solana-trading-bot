from fastapi import FastAPI

app = FastAPI()

@app.post("/webhook/patreon")
async def patreon_webhook(data: dict):
    # Process the webhook payload from Patreon
    print(data)  # Implement your logic here
    return {"message": "Webhook received!"}