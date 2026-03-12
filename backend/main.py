# backend/main.py
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import random

app = FastAPI()

# --- CORS設定（React側アクセス許可） ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 入力データ定義 ---
class Zone(BaseModel):
    id: int
    x: float
    y: float
    width: float
    height: float
    label: Optional[str] = None
    itemCount: Optional[int] = None

class LayoutResponse(BaseModel):
    zone_id: int
    items: List[dict]

# --- テストAPI ---
@app.get("/")
def root():
    return {"message": "FastAPI backend is running 🚀"}

# --- 自動レイアウトAPI（MVP）---
@app.post("/generate-layout", response_model=List[LayoutResponse])
async def generate_layout(zones: List[Zone]):
    results = []
    for z in zones:
        count = z.itemCount if (z.itemCount and z.itemCount > 0) else 3
        items = []
        for i in range(count):
            items.append({
                "type": "chair",
                "x": z.x + random.uniform(0, z.width),
                "y": z.y + random.uniform(0, z.height),
            })
        results.append({"zone_id": z.id, "items": items})
    return results
