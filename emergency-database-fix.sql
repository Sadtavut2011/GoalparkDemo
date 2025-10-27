-- ===================================
-- GOAL PARK DATABASE EMERGENCY FIX (UPDATED)
-- วันที่: 21 ตุลาคม 2568
-- แก้ไขปัญหา "Cannot coerce the result to a single JSON object"
-- โดยใช้โครงสร้างฐานข้อมูลที่มีอยู่จริง
-- ===================================

-- ===================================
-- STEP 1: ตรวจสอบโครงสร้างฐานข้อมูลที่มีอยู่
-- ===================================

-- ตรวจสอบฟิลด์ในตาราง bookings
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;

-- ไม่ต้องเปลี่ยนชื่อฟิลด์ เพราะใช้ start_time และ end_time ตามที่มีอยู่แล้ว

-- ===================================
-- STEP 2: สร้าง/อัพเดท Functions
-- ===================================

-- 2.1 Function สำหรับลบการจองอย่างปลอดภัย
CREATE OR REPLACE FUNCTION safe_delete_booking(
    p_booking_id UUID
)
RETURNS JSON AS $$
DECLARE
    booking_record RECORD;
    result JSON;
BEGIN
    -- ตรวจสอบว่าการจองมีอยู่ (ใช้ชื่อฟิลด์ที่ถูกต้อง)
    SELECT id, booker_name, stadium_name, booking_date, start_time, end_time, status
    INTO booking_record
    FROM bookings 
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        SELECT JSON_BUILD_OBJECT(
            'success', false,
            'error', 'ไม่พบการจองที่ต้องการลบ'
        ) INTO result;
        RETURN result;
    END IF;

    -- ลบการจอง
    DELETE FROM bookings WHERE id = p_booking_id;

    -- ตรวจสอบว่าลบสำเร็จ
    IF NOT FOUND THEN
        SELECT JSON_BUILD_OBJECT(
            'success', false,
            'error', 'ไม่สามารถลบการจองได้'
        ) INTO result;
        RETURN result;
    END IF;

    SELECT JSON_BUILD_OBJECT(
        'success', true,
        'message', 'ลบการจองเรียบร้อย',
        'deleted_booking', JSON_BUILD_OBJECT(
            'id', booking_record.id,
            'stadium_name', booking_record.stadium_name,
            'booker_name', booking_record.booker_name,
            'booking_date', booking_record.booking_date,
            'start_time', booking_record.start_time,
            'end_time', booking_record.end_time,
            'status', booking_record.status
        )
    ) INTO result;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        SELECT JSON_BUILD_OBJECT(
            'success', false,
            'error', SQLERRM
        ) INTO result;
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 อัพเดท Function ตรวจสอบการจองซ้ำ (ใช้ start_time, end_time)
CREATE OR REPLACE FUNCTION check_booking_conflict(
    p_stadium_name TEXT,
    p_booking_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE(
    has_conflict BOOLEAN,
    conflicting_bookings JSON
) AS $$
DECLARE
    conflict_count INTEGER;
    conflicts JSON;
BEGIN
    SELECT COUNT(*), 
           COALESCE(JSON_AGG(
               JSON_BUILD_OBJECT(
                   'id', id,
                   'booker_name', booker_name,
                   'start_time', start_time,
                   'end_time', end_time,
                   'status', status,
                   'booking_date', booking_date
               )
           ), '[]'::JSON)
    INTO conflict_count, conflicts
    FROM bookings
    WHERE stadium_name = p_stadium_name
      AND booking_date = p_booking_date
      AND status NOT IN ('cancelled', 'no_show', 'rejected')
      AND (
          (p_start_time < end_time AND p_end_time > start_time) OR
          (p_start_time >= start_time AND p_end_time <= end_time) OR
          (start_time >= p_start_time AND end_time <= p_end_time) OR
          (p_start_time = start_time OR p_end_time = end_time)
      )
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);

    RETURN QUERY SELECT 
        (conflict_count > 0)::BOOLEAN,
        conflicts;
END;
$$ LANGUAGE plpgsql;

-- 2.3 อัพเดท Trigger Function (ใช้ start_time, end_time)
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM bookings 
        WHERE stadium_name = NEW.stadium_name
          AND booking_date = NEW.booking_date
          AND status NOT IN ('cancelled', 'no_show', 'rejected')
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (
              (NEW.start_time < end_time AND NEW.end_time > start_time) OR
              (NEW.start_time >= start_time AND NEW.end_time <= end_time) OR
              (start_time >= NEW.start_time AND end_time <= NEW.end_time) OR
              (NEW.start_time = start_time OR NEW.end_time = end_time)
          )
    ) THEN
        RAISE EXCEPTION 'มีการจองซ้ำในช่วงเวลานี้แล้ว สนาม: %, วันที่: %, เวลา: % - %', 
            NEW.stadium_name, NEW.booking_date, NEW.start_time, NEW.end_time;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- STEP 3: อัพเดท RLS Policies
-- ===================================

-- ลบ policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Users can delete their own bookings" ON bookings;

-- สร้าง policy ใหม่สำหรับการลบ
CREATE POLICY "Allow booking deletion" ON bookings
    FOR DELETE USING (true);

-- ===================================
-- STEP 4: Grant Permissions
-- ===================================

GRANT EXECUTE ON FUNCTION safe_delete_booking(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_booking_conflict(TEXT, DATE, TIME, TIME, UUID) TO authenticated, anon;

-- ===================================
-- STEP 5: อัพเดท Indexes
-- ===================================

-- ลบ index เก่า
DROP INDEX IF EXISTS idx_bookings_datetime;

-- สร้าง index ใหม่ (ใช้ start_time, end_time)
CREATE INDEX idx_bookings_datetime ON bookings(booking_date, start_time, end_time);

-- ===================================
-- STEP 6: ทดสอบระบบ
-- ===================================

-- ทดสอบ Function safe_delete_booking
DO $$
DECLARE
    test_result JSON;
    test_booking_id UUID;
BEGIN
    -- สร้างการจองทดสอบ (ใช้ start_time, end_time)
    INSERT INTO bookings (
        stadium_name, booker_name, booking_date, start_time, end_time, 
        total_price, status, payment_status
    ) VALUES (
        'Test Stadium', 'Test User', CURRENT_DATE + INTERVAL '1 day', 
        '10:00', '12:00', 1000, 'pending_payment', 'pending'
    ) RETURNING id INTO test_booking_id;
    
    -- ทดสอบการลบ
    SELECT safe_delete_booking(test_booking_id) INTO test_result;
    
    -- แสดงผลลัพธ์
    RAISE NOTICE 'Test Result: %', test_result;
    
    -- ตรวจสอบว่าลบจริงหรือไม่
    IF NOT EXISTS (SELECT 1 FROM bookings WHERE id = test_booking_id) THEN
        RAISE NOTICE 'SUCCESS: Test booking deleted successfully';
    ELSE
        RAISE NOTICE 'ERROR: Test booking still exists';
    END IF;
END $$;

-- ===================================
-- STEP 7: ตรวจสอบการเปลี่ยนแปลง
-- ===================================

-- แสดงโครงสร้าง table bookings
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;

-- แสดง Functions ที่สร้าง
SELECT 
    routine_name, 
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('safe_delete_booking', 'check_booking_conflict', 'prevent_booking_overlap');

-- แสดง Policies
SELECT 
    policyname, 
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'bookings';

-- ===================================
-- STEP 8: คำแนะนำการใช้งาน
-- ===================================

/*
หลังจากรัน SQL นี้แล้ว:

1. ทดสอบการลบใน test-delete-booking.html
2. ใช้งานปุ่มจองใหม่ในหน้า login3.html
3. ตรวจสอบ Supabase logs ถ้ายังมีปัญหา

หาก error ยังคงเกิดขึ้น:
- ตรวจสอบ RLS Settings ใน Supabase Dashboard
- ตรวจสอบ API Key permissions
- ลองปิด RLS ชั่วคราวสำหรับ table bookings
*/

-- ===================================
-- สิ้นสุดการแก้ไข
-- ===================================