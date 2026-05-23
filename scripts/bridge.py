import json
import serial
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from read_id_card import read_card_data

import sys
import serial.tools.list_ports

def find_drawer_ports():
    ports_to_try = []
    # 1. ลองหาจากชื่อ Prolific หรือชิปยอดฮิตก่อน
    for port in serial.tools.list_ports.comports():
        if (port.manufacturer and "Prolific" in port.manufacturer) or (port.hwid and ("067B" in port.hwid or "0403" in port.hwid)):
            ports_to_try.append(port.device)
            
    # 2. เพิ่มพอร์ตอื่นๆ ที่เป็น USB (เพื่อป้องกันไปเปิดพอร์ต Bluetooth แล้วโปรแกรมค้าง)
    for port in serial.tools.list_ports.comports():
        if port.device not in ports_to_try and port.hwid and "USB" in port.hwid:
            ports_to_try.append(port.device)
            
    # 3. ใส่ค่าปริยายเผื่อไว้
    if sys.platform == "darwin" and '/dev/cu.PL2303G-USBtoUART2120' not in ports_to_try:
        ports_to_try.append('/dev/cu.PL2303G-USBtoUART2120')
            
    return ports_to_try

def trigger_port(port):
    try:
        ser = serial.Serial(port, 115200, timeout=0.5, write_timeout=0.5)
        ser.write(b'\x00')
        ser.close()
    except Exception:
        pass

def open_cash_drawer():
    ports = find_drawer_ports()
    for port in ports:
        t = threading.Thread(target=trigger_port, args=(port,))
        t.daemon = True
        t.start()
            
    return {"status": "success", "message": f"Drawer triggers sent to {', '.join(ports)} in background."}

class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # ปิดการเขียน log ทุกรายการ (GET, OPTIONS)
        return

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        
        if self.path == '/read':
            self.end_headers()
            result = read_card_data()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            
        elif self.path == '/open_drawer':
            self.end_headers()
            result = open_cash_drawer()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            
        else:
            self.send_response(404)
            self.end_headers()

from http.server import ThreadingHTTPServer

def run(server_class=ThreadingHTTPServer, handler_class=BridgeHandler, port=8080):
    server_address = ('localhost', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting Thai ID & Drawer Bridge on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Bridge stopped.")

if __name__ == '__main__':
    run()
