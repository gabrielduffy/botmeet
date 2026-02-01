#!/usr/bin/env python3
import json
import time
import uuid
import threading
import sys
import os
import websocket
import numpy as np

try:
    import soundfile as sf
except ImportError:
    print("Missing dependency: soundfile. Install with: pip install soundfile")
    sys.exit(1)

# Default production settings for Vexa
DEFAULT_URL = "ws://botmeet-whisperlive-cpu-1:9090/ws" 
DEFAULT_TOKEN = "benemax_bot_secure_token_2026"

class TranscriptionTester:
    def __init__(self, url, token, audio_path, language="pt"):
        self.url = url
        self.token = token
        self.audio_path = audio_path
        self.language = language
        self.uid = str(uuid.uuid4())
        self.ready = False
        self.transcript_received = []

    def on_message(self, ws, message):
        data = json.loads(message)
        if data.get("message") == "SERVER_READY" or data.get("status") == "CONNECTED":
            print("✅ [SERVER] Connection established and model loaded!")
            self.ready = True
        elif "segments" in data:
            for seg in data["segments"]:
                text = seg.get("text", "").strip()
                if text:
                    print(f"📝 [Transcribed]: {text}")
                    self.transcript_received.append(text)

    def on_open(self, ws):
        print(f"🌐 [WS] Connected to {self.url}")
        handshake = {
            "uid": self.uid,
            "language": self.language,
            "task": "transcribe",
            "model": "small",
            "use_vad": False,
            "platform": "debug_tool",
            "token": self.token,
            "meeting_id": "debug_test_session",
            "meeting_url": "http://debug.vps"
        }
        ws.send(json.dumps(handshake))

    def run(self):
        if not os.path.exists(self.audio_path):
            print(f"❌ Audio file {self.audio_path} not found!")
            return

        print(f"⏳ Loading audio: {self.audio_path}...")
        data, sr = sf.read(self.audio_path)
        if len(data.shape) > 1:
            data = np.mean(data, axis=1)
        audio_data = data.astype(np.float32)

        ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
        )

        wst = threading.Thread(target=ws.run_forever)
        wst.daemon = True
        wst.start()

        print("⏳ Waiting for server readiness (up to 60s)...")
        for _ in range(120):
            if self.ready: break
            time.sleep(0.5)

        if not self.ready:
            print("❌ Timeout: Server did not respond with READY.")
            ws.close()
            return

        print(f"🚀 Streaming {len(audio_data)} samples @ {sr}Hz...")
        chunk_size = 4096
        for i in range(0, len(audio_data), chunk_size):
            chunk = audio_data[i:i + chunk_size]
            ws.send(chunk.tobytes(), opcode=websocket.ABNF.OPCODE_BINARY)
            time.sleep(chunk_size / sr)

        time.sleep(3)
        ws.close()
        print("\n🎯 TEST COMPLETED")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="WhisperLive Production Tester")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"WebSocket URL (default: {DEFAULT_URL})")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="Internal security token")
    parser.add_argument("--file", required=True, help="Path to audio file (WAV/FLAC)")
    parser.add_argument("--lang", default="pt", help="Language code (default: pt)")
    
    args = parser.parse_args()
    
    tester = TranscriptionTester(args.url, args.token, args.file, args.lang)
    tester.run()
