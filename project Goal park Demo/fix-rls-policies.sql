-- ===================================
-- แก้ไข RLS POLICIES สำหรับการตรวจสอบ BOOKING CONFLICTS
-- ===================================

-- เพิ่ม Policy ใหม่สำหรับการดูข้อมูลการจองเพื่อตรวจสอบ conflict
-- Policy นี้จะอนุญาตให้ทุกคนดูข้อมูลพื้นฐานของการจองเพื่อป้องกันการจองซ้ำ

CREATE POLICY "Public can view booking conflicts" ON bookings
    FOR SELECT USING (
        -- อนุญาตให้ดูข้อมูลพื้นฐานสำหรับตรวจสอบ conflict เท่านั้น
        true
    );

-- หรือถ้าต้องการจำกัดให้เฉพาะข้อมูลที่จำเป็น สามารถสร้าง VIEW แทน
CREATE OR REPLACE VIEW public_booking_conflicts AS
SELECT 
    stadium_name,
    booking_date,
    start_time,
    end_time,
    status,
    booker_name
FROM bookings
WHERE status IN ('pending', 'approved', 'confirmed', 'pending_payment');

-- Grant permissions ให้ทุกคนสามารถอ่าน view นี้ได้
GRANT SELECT ON public_booking_conflicts TO anon, authenticated;

-- สร้าง Function สำหรับตรวจสอบ conflict แบบ public
CREATE OR REPLACE FUNCTION check_public_booking_conflicts(
    p_stadium_name TEXT,
    p_booking_date DATE
)
RETURNS TABLE(
    stadium_name TEXT,
    booking_date DATE,
    start_time TIME,
    end_time TIME,
    status TEXT,
    booker_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.stadium_name,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.status,
        b.booker_name
    FROM bookings b
    WHERE b.stadium_name = p_stadium_name
      AND b.booking_date = p_booking_date
      AND b.status IN ('pending', 'approved', 'confirmed', 'pending_payment');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_public_booking_conflicts(TEXT, DATE) TO anon, authenticated;

-- ===================================
-- วิธีใช้งาน:
-- ===================================
-- 1. รันไฟล์นี้ใน Supabase SQL Editor
-- 2. ใน JavaScript ใช้:
--    - client.from('public_booking_conflicts') หรือ
--    - client.rpc('check_public_booking_conflicts', {...})
-- ===================================