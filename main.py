"""
Main FastAPI server for PhantomShield X. Routes API requests for log analysis,
file scanning, and URL scanning through the AI prediction and Threat Intelligence systems.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import time

from fake_logs import generate_log_batch
from virustotal import check_ip
from scanner import scan_file, scan_url
from ai_model import train_model, score_log
from responder import evaluate

app = FastAPI(title="PhantomShield X Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory storage
incidents = []
scan_history = []

# Pydantic models for incoming requests
class LogPayload(BaseModel):
    log: Optional[dict] = None

class UrlPayload(BaseModel):
    url: str

@app.on_event("startup")
async def startup_event():
    print("Initializing PhantomShield X Data Pipelines...")
    # Generate 200 mock logs to train the Isolation Forest model
    training_data = generate_log_batch(200)
    train_model(training_data)
    print("PhantomShield X backend ready — all systems online")

@app.get("/health")
async def health_check():
    """Health check endpoint to verify system status."""
    return {
        "status": "ok",
        "model": "loaded",
        "endpoints": [
            "/analyze", "/scan/file", "/scan/url", 
            "/scan/history", "/incidents", "/simulate"
        ],
        "timestamp": time.time()
    }

async def _process_log_pipeline(log: dict) -> dict:
    """Internal helper to run a single log through the entire analysis pipeline."""
    # Step 1: AI Scoring
    risk_score = score_log(log)
    
    # Step 2: VirusTotal IP Check if an external IP is present
    vt_result = {"malicious": False, "score": 0, "tags": ["unavailable"]}
    ip = log.get("source_ip")
    if ip and not (ip.startswith("192.168.") or ip.startswith("10.")):
        vt_result = await check_ip(ip)
        
    # Step 3: Responder Evaluation
    response_action = evaluate(log, risk_score, vt_result)
    
    # Step 4: Format and Store Incident
    incident_record = {
        "risk_score": risk_score,
        "vt_result": vt_result,
        "severity": response_action["severity"],
        "action": response_action["action"],
        "alert": response_action["alert"],
        "message": response_action["message"],
        "log": log,
        "timestamp": response_action["timestamp"]
    }
    
    incidents.insert(0, incident_record)
    # Keep only last 50
    if len(incidents) > 50:
        incidents.pop()
        
    return incident_record

@app.post("/analyze")
async def analyze_log(payload: LogPayload):
    """Analyze a single log using AI and Threat Intelligence."""
    log = payload.log
    if not log:
        # Generate a random single log for testing if none provided
        log = generate_log_batch(1)[0]
        
    return await _process_log_pipeline(log)

@app.post("/scan/file")
async def scan_file_endpoint(file: UploadFile = File(...)):
    """Upload and scan a file using heuristics and VirusTotal."""
    try:
        # Constraint: Read file bytes, simulate max size handling gracefully
        # FastAPI handles streaming automatically for massive files, but we read to memory here
        file_bytes = await file.read()
        
        # Max size check: 32MB
        if len(file_bytes) > 32 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 32MB.")
            
        result = await scan_file(file_bytes, file.filename)
        
        scan_history.insert(0, result)
        if len(scan_history) > 50:
            scan_history.pop()
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan/url")
async def scan_url_endpoint(payload: UrlPayload):
    """Scan a URL using heuristics and VirusTotal."""
    try:
        result = await scan_url(payload.url)
        
        scan_history.insert(0, result)
        if len(scan_history) > 50:
            scan_history.pop()
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scan/history")
async def get_scan_history():
    """Retrieve the last 50 combined file and URL scan results."""
    return scan_history

@app.get("/incidents")
async def get_incidents():
    """Retrieve the last 50 log analysis incidents."""
    return incidents

@app.get("/simulate")
async def simulate_traffic():
    """Generates 5 random network/system logs and analyzes them instantly."""
    logs = generate_log_batch(5)
    results = []
    for log in logs:
        # Process asynchronously but await sequentially for ease
        result = await _process_log_pipeline(log)
        results.append(result)
    return results
