-- ===================================
-- GOAL PARK DATABASE UPDATE - แก้ไขให้ตรงกับโค้ด
-- วันที่: 21 ตุลาคม 2568
-- ===================================

-- 1. เปลี่ยนชื่อฟิลด์ใน bookings table ให้ตรงกับโค้ด
ALTER TABLE bookings 
RENAME COLUMN start_time TO time_from;

ALTER TABLE bookings 
RENAME COLUMN end_time TO time_to;

-- 2. อัพเดท Function prevent_booking_overlap ให้ใช้ชื่อฟิลด์ใหม่
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    -- ตรวจสอบการจองซ้ำก่อนทำการ INSERT หรือ UPDATE
    IF EXISTS (
        SELECT 1 FROM bookings 
        WHERE stadium_name = NEW.stadium_name
          AND booking_date = NEW.booking_date
          AND status NOT IN ('cancelled', 'no_show', 'rejected')
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (
              -- ตรวจสอบการทับซ้อนของเวลา
              (NEW.time_from < time_to AND NEW.time_to > time_from) OR
              (NEW.time_from >= time_from AND NEW.time_to <= time_to) OR
              (time_from >= NEW.time_from AND time_to <= NEW.time_to) OR
              (NEW.time_from = time_from OR NEW.time_to = time_to)
          )
    ) THEN
        RAISE EXCEPTION 'มีการจองซ้ำในช่วงเวลานี้แล้ว สนาม: %, วันที่: %, เวลา: % - %', 
            NEW.stadium_name, NEW.booking_date, NEW.time_from, NEW.time_to;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. อัพเดท Function check_booking_conflict ให้ใช้ชื่อฟิลด์ใหม่
CREATE OR REPLACE FUNCTION check_booking_conflict(
    p_stadium_name TEXT,
    p_booking_date DATE,
    p_time_from TIME,
    p_time_to TIME,
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
    -- ตรวจสอบการจองซ้ำที่เข้มงวดขึ้น
    SELECT COUNT(*), 
           COALESCE(JSON_AGG(
               JSON_BUILD_OBJECT(
                   'id', id,
                   'booker_name', booker_name,
                   'time_from', time_from,
                   'time_to', time_to,
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
          -- กรณีที่ 1: เวลาใหม่เริ่มก่อนเวลาเดิมสิ้นสุด และ สิ้นสุดหลังเวลาเดิมเริ่ม
          (p_time_from < time_to AND p_time_to > time_from) OR
          -- กรณีที่ 2: เวลาใหม่อยู่ภายในเวลาเดิม
          (p_time_from >= time_from AND p_time_to <= time_to) OR
          -- กรณีที่ 3: เวลาเดิมอยู่ภายในเวลาใหม่
          (time_from >= p_time_from AND time_to <= p_time_to) OR
          -- กรณีที่ 4: เวลาเริ่มเท่ากัน หรือ เวลาสิ้นสุดเท่ากัน
          (p_time_from = time_from OR p_time_to = time_to)
      )
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);

    RETURN QUERY SELECT 
        (conflict_count > 0)::BOOLEAN,
        conflicts;
END;
$$ LANGUAGE plpgsql;

-- 4. อัพเดท Indexes ให้ใช้ชื่อฟิลด์ใหม่
DROP INDEX IF EXISTS idx_bookings_datetime;
CREATE INDEX idx_bookings_datetime ON bookings(booking_date, time_from, time_to);

-- 5. เพิ่ม RLS Policy สำหรับการลบการจอง
CREATE POLICY "Users can delete their own bookings" ON bookings
    FOR DELETE USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'staff')
        )
    );

-- 6. สร้าง Function สำหรับลบการจองอย่างปลอดภัย
CREATE OR REPLACE FUNCTION safe_delete_booking(
    p_booking_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    booking_record RECORD;
    result JSON;
BEGIN
    -- ตรวจสอบว่าการจองมีอยู่และผู้ใช้มีสิทธิ์ลบ
    SELECT * INTO booking_record
    FROM bookings 
    WHERE id = p_booking_id
      AND (
          user_id = COALESCE(p_user_id, auth.uid()) OR
          EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = COALESCE(p_user_id, auth.uid())
              AND profiles.role IN ('admin', 'staff')
          )
      );

    IF NOT FOUND THEN
        SELECT JSON_BUILD_OBJECT(
            'success', false,
            'error', 'ไม่พบการจองหรือไม่มีสิทธิ์ลบ'
        ) INTO result;
        RETURN result;
    END IF;

    -- ลบการจอง
    DELETE FROM bookings WHERE id = p_booking_id;

    SELECT JSON_BUILD_OBJECT(
        'success', true,
        'message', 'ลบการจองเรียบร้อย',
        'deleted_booking', JSON_BUILD_OBJECT(
            'id', booking_record.id,
            'stadium_name', booking_record.stadium_name,
            'booker_name', booking_record.booker_name,
            'booking_date', booking_record.booking_date,
            'time_from', booking_record.time_from,
            'time_to', booking_record.time_to
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION safe_delete_booking(UUID, UUID) TO authenticated, anon;

-- 7. เพิ่ม Constraint ใหม่สำหรับความปลอดภัย
ALTER TABLE bookings 
ADD CONSTRAINT valid_time_format 
CHECK (time_from < time_to);

-- 8. อัพเดท booking status enum (ถ้าต้องการ)
-- ไม่จำเป็นเพราะใช้ VARCHAR แล้ว

-- ===================================
-- ตรวจสอบการเปลี่ยนแปลง
-- ===================================

-- ตรวจสอบ columns ใหม่
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name IN ('time_from', 'time_to', 'start_time', 'end_time')
ORDER BY column_name;

-- ตรวจสอบ Functions
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('prevent_booking_overlap', 'check_booking_conflict', 'safe_delete_booking');

-- ตรวจสอบ Indexes
SELECT indexname, tablename
FROM pg_indexes 
WHERE tablename = 'bookings' 
  AND indexname LIKE '%datetime%';

-- ===================================
-- สิ้นสุดการอัพเดท
-- ===================================