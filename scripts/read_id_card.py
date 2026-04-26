import json
import base64
from smartcard.System import readers

# --- Config สำหรับบัตรของคุณ ---
CORRECT_AID = [0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01]
SELECT_APP  = [0x00, 0xA4, 0x04, 0x00, 0x08] + CORRECT_AID

# คำสั่งอ่านข้อมูล (อ้างอิงจากผลการ Scan ล่าสุด)
CMD_CID      = [0x80, 0xb0, 0x00, 0x04, 0x02, 0x00, 0x0d]
CMD_NAME     = [0x80, 0xb0, 0x00, 0x11, 0x02, 0x00, 0x64]
CMD_ADDR     = [0x80, 0xb0, 0x15, 0x79, 0x02, 0x00, 0x64]
CMD_ISSUE    = [0x80, 0xb0, 0x01, 0x67, 0x02, 0x00, 0x08] # จาก Scan: 25650407
CMD_EXPIRE   = [0x80, 0xb0, 0x01, 0x6f, 0x02, 0x00, 0x08] # จาก Scan: 25731221

def get_data(connection, command):
    try:
        resp, sw1, sw2 = connection.transmit(command)
        if sw1 == 0x61:
            resp, sw1, sw2 = connection.transmit([0x00, 0xC0, 0x00, 0x00, sw2])
        return resp if sw1 == 0x90 else None
    except: return None

def clean_text(byte_data):
    if not byte_data: return ""
    return bytes(byte_data).decode('tis-620', errors='ignore').strip().replace('#', ' ').replace('  ', ' ')

def format_date_to_ad(raw_date):
    """ แปลง พ.ศ. (YYYYMMDD) เป็น ค.ศ. (YYYY-MM-DD) """
    if not raw_date: return ""
    date_str = "".join(map(chr, raw_date)).strip()
    if len(date_str) == 8 and date_str.isdigit():
        year_be = int(date_str[:4])
        year_ad = year_be - 543  # แปลง พ.ศ. -> ค.ศ.
        return f"{year_ad}-{date_str[4:6]}-{date_str[6:]}"
    return date_str

def read_card_data():
    result = {"status": "error", "message": "", "data": None}
    all_readers = readers()
    if not all_readers:
        result["message"] = "No reader found"
        return result

    reader = all_readers[0]
    connection = reader.createConnection()
    
    try:
        connection.connect()
        get_data(connection, SELECT_APP)

        # ดึงข้อมูล Text
        cid = "".join(map(chr, get_data(connection, CMD_CID) or [])).strip()
        name = clean_text(get_data(connection, CMD_NAME))
        address = clean_text(get_data(connection, CMD_ADDR))
        issue_date = format_date_to_ad(get_data(connection, CMD_ISSUE))
        expire_date = format_date_to_ad(get_data(connection, CMD_EXPIRE))

        # ดึงรูปภาพ (20 รอบ)
        all_photo_bytes = []
        for i in range(20):
            offset = 0x017B + (i * 252)
            cmd = [0x80, 0xb0, (offset >> 8) & 0xFF, offset & 0xFF, 0x02, 0x00, 0xfc]
            part = get_data(connection, cmd)
            if part: all_photo_bytes.extend(part)
            else: break
        
        photo_base64 = ""
        if all_photo_bytes:
            data = bytes(all_photo_bytes)
            start, end = data.find(b'\xff\xd8'), data.rfind(b'\xff\xd9')
            if start != -1 and end != -1:
                photo_base64 = base64.b64encode(data[start:end+2]).decode('utf-8')

        result["status"] = "success"
        result["data"] = {
            "cid": cid,
            "full_name": name,
            "address": address,
            "issue_date": issue_date,
            "expire_date": expire_date,
            "photo_base64": f"data:image/jpeg;base64,{photo_base64}" if photo_base64 else ""
        }

    except Exception as e:
        err_msg = str(e)
        if "0x80100066" in err_msg or "Card is unresponsive" in err_msg:
            result["message"] = "ถอดบัตรเสียบใหม่น่ะจ้ะ"
        else:
            result["message"] = err_msg
    finally:
        try: connection.disconnect()
        except: pass

    return result

if __name__ == "__main__":
    # แสดงผลเป็น JSON สวยงามเมื่อรันตรงๆ
    print(json.dumps(read_card_data(), ensure_ascii=False, indent=2))