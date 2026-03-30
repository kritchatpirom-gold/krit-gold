import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from read_id_card import read_card_data

class BridgeHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With')
        self.end_headers()

    def do_GET(self):
        if self.path == '/read':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # เรียกใช้ฟังก์ชันอ่านบัตร
            result = read_card_data()
            print(f"Read Result: {result.get('status')} - {result.get('message')}")
            if result.get('data'):
                print(f"Data: Name={result['data'].get('full_name')}, Expire={result['data'].get('expire_date')}")
            
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run(server_class=HTTPServer, handler_class=BridgeHandler, port=8080):
    server_address = ('localhost', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting Thai ID Bridge on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Bridge stopped.")

if __name__ == '__main__':
    run()
