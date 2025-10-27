-- SQL สำหรับสร้าง Table cancel_reservation
-- ตารางนี้เก็บข้อมูลการจองที่ถูกยกเลิกเพื่อรอการคืนเงิน

CREATE TABLE IF NOT EXISTS cancel_reservation (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- ข้อมูลจากการจองเดิม
    original_booking_id uuid NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    stadium_name text NOT NULL,
    stadium_address text,
    booker_name text NOT NULL,
    booker_phone text NOT NULL,
    booker_email text,
    booking_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    duration int4,
    price_per_hour numeric,
    total_price numeric NOT NULL,
    payment_slip_url text,
    payment_slip_filename text,
    admin_notes text,
    notes text,
    
    -- ข้อมูลการยกเลิก
    cancelled_at timestamptz DEFAULT now() NOT NULL,
    cancelled_by uuid REFERENCES auth.users(id),
    cancellation_reason text,
    refund_status varchar DEFAULT 'pending' CHECK (refund_status IN ('pending', 'processing', 'completed', 'rejected')),
    refund_amount numeric,
    refund_notes text,
    refund_processed_at timestamptz,
    refund_processed_by uuid REFERENCES auth.users(id),
    
    -- ข้อมูลระบบ
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- เพิ่ม indexes เพื่อประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_cancel_reservation_user_id ON cancel_reservation(user_id);
CREATE INDEX IF NOT EXISTS idx_cancel_reservation_original_booking_id ON cancel_reservation(original_booking_id);
CREATE INDEX IF NOT EXISTS idx_cancel_reservation_cancelled_at ON cancel_reservation(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_cancel_reservation_refund_status ON cancel_reservation(refund_status);

-- เพิ่ม trigger สำหรับ updated_at
CREATE OR REPLACE FUNCTION update_cancel_reservation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cancel_reservation_updated_at
    BEFORE UPDATE ON cancel_reservation
    FOR EACH ROW
    EXECUTE FUNCTION update_cancel_reservation_updated_at();

-- เพิ่ม RLS (Row Level Security) policies
ALTER TABLE cancel_reservation ENABLE ROW LEVEL SECURITY;

-- ผู้ใช้สามารถดูข้อมูลการยกเลิกของตัวเองได้
CREATE POLICY "Users can view their own cancelled reservations" ON cancel_reservation
    FOR SELECT USING (auth.uid() = user_id);

-- ผู้ใช้สามารถเพิ่มข้อมูลการยกเลิกของตัวเองได้
CREATE POLICY "Users can insert their own cancelled reservations" ON cancel_reservation
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin สามารถดูและแก้ไขข้อมูลการยกเลิกทั้งหมดได้ (ถ้ามี role admin)
-- CREATE POLICY "Admins can manage all cancelled reservations" ON cancel_reservation
--     FOR ALL USING (
--         EXISTS (
--             SELECT 1 FROM profiles 
--             WHERE id = auth.uid() AND role = 'admin'
--         )
--     );

-- Comments สำหรับอธิบายตาราง
COMMENT ON TABLE cancel_reservation IS 'ตารางเก็บข้อมูลการจองที่ถูกยกเลิกเพื่อรอการคืนเงิน';
COMMENT ON COLUMN cancel_reservation.original_booking_id IS 'ID ของการจองเดิมก่อนยกเลิก';
COMMENT ON COLUMN cancel_reservation.cancelled_at IS 'วันเวลาที่ยกเลิกการจอง';
COMMENT ON COLUMN cancel_reservation.cancelled_by IS 'ผู้ที่ยกเลิกการจอง';
COMMENT ON COLUMN cancel_reservation.cancellation_reason IS 'เหตุผลในการยกเลิก';
COMMENT ON COLUMN cancel_reservation.refund_status IS 'สถานะการคืนเงิน: pending, processing, completed, rejected';
COMMENT ON COLUMN cancel_reservation.refund_amount IS 'จำนวนเงินที่คืน';
COMMENT ON COLUMN cancel_reservation.refund_processed_at IS 'วันเวลาที่ดำเนินการคืนเงิน';
COMMENT ON COLUMN cancel_reservation.refund_processed_by IS 'ผู้ดำเนินการคืนเงิน';