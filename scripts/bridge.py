import json
import serial
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from read_id_card import read_card_data

import sys
import serial.tools.list_ports

# ฟังก์ชันค้นหาพอร์ต USB Trigger อัตโนมัติ (รองรับทั้ง Mac และ Windows)
def find_drawer_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        # ตรวจสอบจากชื่อ Manufacturer หรือ VID/PID ของ Prolific
        if (port.manufacturer and "Prolific" in port.manufacturer) or (port.hwid and "067B" in port.hwid):
            return port.device
    
    # ค่า Default หากหาไม่เจอ (สำหรับ Mac และ Windows)
    if sys.platform == "darwin":
        return '/dev/cu.PL2303G-USBtoUART2120'
    else:
        return 'COM3' # ค่าตัวอย่างสำหรับ Windows

DRAWER_PORT = find_drawer_port()
DRAWER_BAUD = 115200

def open_cash_drawer():
    try:
        # เปิด Port และส่งสัญญาณเพื่อเปิดลิ้นชัก
        # ส่วนใหญ่ USB Trigger จะเด้งเมื่อมีการเปิด Port หรือส่งข้อมูลบางอย่าง
        # ถอยกลับมาใช้การส่ง 1 byte ที่ความเร็วสูง เพราะการแค่เปิดพอร์ตเฉยๆ แรงไม่พอให้ลิ้นชักทำงาน
        ser = serial.Serial(DRAWER_PORT, 115200, timeout=1)
        ser.write(b'\x00')
        ser.close()
        return {"status": "success", "message": "Drawer opened"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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

def run(server_class=HTTPServer, handler_class=BridgeHandler, port=8080):
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
