from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from db import get_connection

class MyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/companies":
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT id, name, location FROM companies;")
            rows = cur.fetchall()
            cur.close()
            conn.close()
            companies = [{"id": r[0], "name": r[1], "location": r[2]} for r in rows]
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(companies, default=str).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

if __name__ == "__main__":
    httpd = HTTPServer(('localhost', 8000), MyHandler)
    print("Serving on port 8000")
    httpd.serve_forever()