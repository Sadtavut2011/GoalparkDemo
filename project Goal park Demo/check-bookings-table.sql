-- ตรวจสอบโครงสร้าง Table bookings เพื่อให้แน่ใจว่ามี fields ที่จำเป็น
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;

-- ตรวจสอบข้อมูลตัวอย่างใน Table bookings
SELECT 
    id,
    user_id,
    stadium_name,
    booker_name,
    booker_phone,
    booker_email,
    booking_date,
    start_time,
    end_time,
    total_price,
    created_at
FROM bookings 
LIMIT 5;

-- ตรวจสอบว่ามี records ที่ booker_email เป็น null หรือไม่
SELECT 
    COUNT(*) as total_bookings,
    COUNT(booker_email) as bookings_with_email,
    COUNT(*) - COUNT(booker_email) as bookings_without_email
FROM bookings;

-- ตรวจสอบ RLS policies ของ Table bookings
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'bookings';