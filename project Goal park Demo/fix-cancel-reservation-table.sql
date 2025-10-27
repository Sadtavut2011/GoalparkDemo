-- แก้ไข Table cancel_reservation ที่มีอยู่แล้ว
-- ถ้า Table ยังไม่ได้สร้าง ให้รันไฟล์ create-cancel-reservation-table.sql แทน

-- ลบ NOT NULL constraint จาก booker_email column (ถ้ามี)
ALTER TABLE cancel_reservation 
ALTER COLUMN booker_email DROP NOT NULL;

-- เพิ่ม comment เพื่ออธิบาย
COMMENT ON COLUMN cancel_reservation.booker_email IS 'อีเมลผู้จอง (อาจเป็น null หากไม่มีข้อมูลในระบบเดิม)';

-- ตรวจสอบโครงสร้างของ Table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cancel_reservation' 
ORDER BY ordinal_position;