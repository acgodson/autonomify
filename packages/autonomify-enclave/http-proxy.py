#!/usr/bin/env python3
"""
HTTP Proxy for Autonomify Enclave
Routes HTTP requests to Nitro Enclave via vsock
Port 8001 - Production endpoint
"""
import socket
import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuration
ENCLAVE_CID = 16  # updated after enclave starts
ENCLAVE_PORT = 5000
HTTP_PORT = 8001

class EnclaveProxy(BaseHTTPRequestHandler):
    def do_POST(self):
        print("\n[AUTONOMIFY-PROXY] ===== NEW REQUEST =====", flush=True)
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self._send_error(400, "Empty request body")
                return

            body_bytes = self.rfile.read(content_length)

            try:
                message = json.loads(body_bytes.decode("utf-8"))
                print(f"[AUTONOMIFY-PROXY] Request type: {message.get('type')}", flush=True)
            except json.JSONDecodeError:
                print(f"[AUTONOMIFY-PROXY] Invalid JSON", flush=True)
                self._send_error(400, "Invalid JSON")
                return

            # Route to enclave
            response = self._call_enclave(body_bytes)

            if response is None:
                self._send_error(502, "Enclave returned empty response")
                return

            print(f"[AUTONOMIFY-PROXY] Received {len(response)} bytes from enclave", flush=True)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            self.wfile.flush()
            print("[AUTONOMIFY-PROXY] Response sent to client", flush=True)

        except Exception as e:
            import traceback
            print("[AUTONOMIFY-PROXY] Error:", flush=True)
            traceback.print_exc()
            self._send_error(500, str(e))

    def do_GET(self):
        """Health check endpoint"""
        if self.path == "/health":
            is_running = self._is_enclave_running()
            status = {"status": "healthy" if is_running else "enclave_down", "enclave_cid": ENCLAVE_CID}
            body = json.dumps(status).encode("utf-8")
            self.send_response(200 if is_running else 503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self._send_error(404, "Not found")

    def _is_enclave_running(self):
        """Quick check if enclave is accessible"""
        try:
            s = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
            s.settimeout(2)
            s.connect((ENCLAVE_CID, ENCLAVE_PORT))
            s.close()
            return True
        except:
            return False

    def _call_enclave(self, body_bytes):
        """Call Nitro Enclave via vsock"""
        try:
            print(f"[AUTONOMIFY-PROXY] Connecting to enclave (CID {ENCLAVE_CID}, port {ENCLAVE_PORT})...", flush=True)

            s = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
            s.settimeout(60)  # 60s timeout for proof generation
            s.connect((ENCLAVE_CID, ENCLAVE_PORT))

            # Send request
            s.sendall(body_bytes + b'\n')

            # Receive response
            response = b''
            while True:
                try:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    response += chunk
                    try:
                        json.loads(response.decode("utf-8"))
                        break
                    except json.JSONDecodeError:
                        continue
                except socket.timeout:
                    break

            s.close()

            if response:
                print(f"[AUTONOMIFY-PROXY] Enclave responded successfully", flush=True)
                return response
            else:
                print(f"[AUTONOMIFY-PROXY] Enclave returned empty response", flush=True)
                return None

        except Exception as e:
            print(f"[AUTONOMIFY-PROXY] Enclave error: {e}", flush=True)
            error_response = json.dumps({"error": f"Enclave error: {str(e)}"}).encode("utf-8")
            return error_response

    def _send_error(self, status_code: int, message: str):
        print(f"[AUTONOMIFY-PROXY] ERROR {status_code}: {message}", flush=True)
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        self.wfile.flush()

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    # Allow CID override via command line
    if len(sys.argv) > 1:
        ENCLAVE_CID = int(sys.argv[1])

    server = HTTPServer(("0.0.0.0", HTTP_PORT), EnclaveProxy)
    print(f"[AUTONOMIFY-PROXY] HTTP proxy listening on :{HTTP_PORT}", flush=True)
    print(f"[AUTONOMIFY-PROXY] Routing to enclave CID {ENCLAVE_CID}, port {ENCLAVE_PORT}", flush=True)
    sys.stdout.flush()
    server.serve_forever()
