"""
Provides scanning logic for files and URLs. Combines VirusTotal integration
with local heuristic checks to generate a comprehensive risk score and verdict.
"""

import hashlib
import re
import time
from urllib.parse import urlparse
import filetype
from virustotal import check_file_hash, upload_file_to_vt, check_url

def _compute_sha256(file_bytes: bytes) -> str:
    sha256_hash = hashlib.sha256()
    sha256_hash.update(file_bytes)
    return sha256_hash.hexdigest()

def _get_verdict_and_action(score: int) -> tuple:
    if score >= 70:
        return "DANGEROUS", "block"
    elif score >= 35:
        return "SUSPICIOUS", "warn_user"
    return "SAFE", "allow"

async def scan_file(file_bytes: bytes, filename: str) -> dict:
    """Scans a file using hashes, VirusTotal, and local heuristics."""
    timestamp = time.time()
    sha256 = _compute_sha256(file_bytes)
    
    # Step 2: VT Hash Lookup
    vt_result = await check_file_hash(sha256)
    
    # Step 3: VT Upload if unknown
    if vt_result["score"] == 0 and "unavailable" in vt_result.get("tags", []):
        vt_result = await upload_file_to_vt(file_bytes, filename)
        
    heuristic_flags = []
    heuristic_score = 0
    
    # Step 4: Local Heuristics
    filename_lower = filename.lower()
    
    # 4a. Check size (> 50MB)
    if len(file_bytes) > 50 * 1024 * 1024:
        heuristic_flags.append("large_file_size")
        heuristic_score += 15
        
    # 4b. Dangerous extensions
    danger_exts = ['.exe', '.bat', '.ps1', '.sh', '.vbs', '.js', '.jar', '.dll', '.scr', '.cmd']
    if any(filename_lower.endswith(ext) for ext in danger_exts):
        heuristic_flags.append("dangerous_extension")
        heuristic_score += 30
        
    # 4c. Suspicious words
    suspicious_words = ['invoice', 'payment', 'urgent', 'password', 'free', 'winner']
    if any(word in filename_lower for word in suspicious_words):
        heuristic_flags.append("suspicious_filename_keyword")
        heuristic_score += 20
        
    # 4d. Magic bytes vs Extension mismatch
    kind = filetype.guess(file_bytes)
    if kind is not None:
        actual_ext = "." + kind.extension.lower()
        if not filename_lower.endswith(actual_ext) and "." in filename_lower:
            heuristic_flags.append("extension_mismatch")
            heuristic_score += 40
            
    # Combine scores
    final_score = min(vt_result.get("score", 0) + heuristic_score, 100)
    verdict, action = _get_verdict_and_action(final_score)
    
    return {
        "filename": filename,
        "sha256": sha256,
        "risk_score": final_score,
        "verdict": verdict,
        "vt_result": vt_result,
        "heuristic_flags": heuristic_flags,
        "recommended_action": action,
        "timestamp": timestamp
    }

async def scan_url(url: str) -> dict:
    """Scans a URL using VirusTotal and local heuristics."""
    timestamp = time.time()
    
    # Step 1: Parse
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    
    # Step 2: VirusTotal
    vt_result = await check_url(url)
    
    heuristic_flags = []
    heuristic_score = 0
    url_lower = url.lower()
    
    # 3a. IP instead of domain
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$", domain):
        heuristic_flags.append("ip_as_domain")
        heuristic_score += 40
        
    # 3b. URL Shorteners
    shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd']
    if any(short in domain.lower() for short in shorteners):
        heuristic_flags.append("url_shortener")
        heuristic_score += 25
        
    # 3c. Keywords
    suspicious_keywords = ['login', 'verify', 'account', 'secure', 'update', 'confirm', 'bank', 'paypal', 'free', 'prize']
    if any(word in url_lower for word in suspicious_keywords):
        heuristic_flags.append("suspicious_keyword_in_url")
        heuristic_score += 20
        
    # 3d. Excessive subdomains
    if domain.count('.') > 3:
        heuristic_flags.append("excessive_subdomains")
        heuristic_score += 15
        
    # 3e. Misleading domains (numbers replacing letters)
    if re.search(r"[a-z]+[0-9]+[a-z]+", domain.split('.')[0]):
        heuristic_flags.append("misleading_domain_name")
        heuristic_score += 30
        
    # 3f. Long URL
    if len(url) > 100:
        heuristic_flags.append("long_url")
        heuristic_score += 10
        
    # 3g. HTTP instead of HTTPS
    if parsed_url.scheme == "http":
        heuristic_flags.append("unencrypted_http")
        heuristic_score += 15
        
    # Combine scores
    final_score = min(vt_result.get("score", 0) + heuristic_score, 100)
    verdict, action = _get_verdict_and_action(final_score)
    
    return {
        "url": url,
        "domain": domain,
        "risk_score": final_score,
        "verdict": verdict,
        "vt_result": vt_result,
        "heuristic_flags": heuristic_flags,
        "recommended_action": action,
        "timestamp": timestamp
    }
