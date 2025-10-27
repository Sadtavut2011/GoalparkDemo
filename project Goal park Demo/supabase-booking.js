// Supabase Configuration
// คุณต้องเปลี่ยน URL และ ANON_KEY เป็นค่าจากโปรเจค Supabase ของคุณ

// 🔗 Project URL: ไปหาใน Supabase Dashboard > Settings > API > Project URL
const SUPABASE_URL = 'https://hsradizrvpziqptvfoxs.supabase.co'; // อัปเดต URL ใหม่

// 🔑 Anon Key: ไปหาใน Supabase Dashboard > Settings > API > Project API keys > anon public
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcmFkaXpydnB6aXFwdHZmb3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTkwNTgsImV4cCI6MjA3NTU5NTA1OH0.wwe4cK4CLQAaFv22BOXbQTVETB_E-u9eF1s7iJpoIJs'; // อัปเดต anon key ใหม่

// สร้าง Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ฟังก์ชันสำหรับบันทึกการจอง
async function saveBooking(bookingData) {
    try {
        // ตรวจสอบการจองซ้ำ
        const conflictResult = await checkBookingConflict(
            bookingData.stadium_name,
            bookingData.booking_date,
            bookingData.time_from,
            bookingData.time_to
        );

        if (conflictResult.hasConflict) {
            return {
                success: false,
                error: 'มีการจองในช่วงเวลานี้แล้ว',
                conflictBookings: conflictResult.conflicts,
                message: `พบการจองซ้ำ ${conflictResult.conflicts.length} รายการในช่วงเวลานี้`
            };
        }

        // ถ้าไม่มีการจองซ้ำ ให้บันทึกข้อมูล
        const { data, error } = await supabaseClient
            .from('bookings')
            .insert([{
                stadium_name: bookingData.stadium_name,
                stadium_address: bookingData.stadium_address,
                booker_name: bookingData.booker_name,
                booker_phone: bookingData.booker_phone || null,
                booker_email: bookingData.booker_email || null,
                booking_date: bookingData.booking_date,
                time_from: bookingData.time_from,
                time_to: bookingData.time_to,
                total_hours: calculateHours(bookingData.time_from, bookingData.time_to),
                status: 'pending_payment',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            console.error('Supabase error:', error);
            return {
                success: false,
                error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
                details: error.message
            };
        }

        return {
            success: true,
            data: data[0],
            message: 'บันทึกการจองเรียบร้อย'
        };

    } catch (error) {
        console.error('Error saving booking:', error);
        return {
            success: false,
            error: 'เกิดข้อผิดพลาดในระบบ',
            details: error.message
        };
    }
}

// ฟังก์ชันตรวจสอบการจองซ้ำ
async function checkBookingConflict(stadiumName, date, timeFrom, timeTo) {
    try {
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('stadium_name', stadiumName)
            .eq('booking_date', date)
            .neq('status', 'cancelled')
            .or(`and(time_from.lte.${timeFrom},time_to.gt.${timeFrom}),and(time_from.lt.${timeTo},time_to.gte.${timeTo}),and(time_from.gte.${timeFrom},time_to.lte.${timeTo})`);

        if (error) {
            console.error('Error checking conflicts:', error);
            return { hasConflict: false, conflicts: [], error: error.message };
        }

        return {
            hasConflict: data && data.length > 0,
            conflicts: data || [],
            count: data ? data.length : 0
        };

    } catch (error) {
        console.error('Error in checkBookingConflict:', error);
        return { hasConflict: false, conflicts: [], error: error.message };
    }
}

// ฟังก์ชันอัปเดตสถานะการชำระเงิน
async function updatePaymentStatus(bookingId, status, slipFileName = null) {
    try {
        const updateData = {
            payment_status: status,
            status: status === 'paid' ? 'confirmed' : 'pending_payment',
            updated_at: new Date().toISOString()
        };

        if (slipFileName) {
            updateData.payment_slip = slipFileName;
            updateData.payment_date = new Date().toISOString();
        }

        const { data, error } = await supabaseClient
            .from('bookings')
            .update(updateData)
            .eq('id', bookingId)
            .select();

        if (error) {
            console.error('Error updating payment status:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data: data[0] };

    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        return { success: false, error: error.message };
    }
}

// ฟังก์ชันอัปโหลดสลิปการชำระเงิน
async function uploadPaymentSlip(file, bookingId) {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `slip_${bookingId}_${Date.now()}.${fileExt}`;
        const filePath = `payment-slips/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('booking-files')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            return { success: false, error: uploadError.message };
        }

        // อัปเดตสถานะการชำระเงิน
        const updateResult = await updatePaymentStatus(bookingId, 'pending_verification', fileName);
        
        if (!updateResult.success) {
            return updateResult;
        }

        return { 
            success: true, 
            fileName: fileName,
            path: filePath,
            message: 'อัปโหลดสลิปเรียบร้อย รอการตรวจสอบ'
        };

    } catch (error) {
        console.error('Error in uploadPaymentSlip:', error);
        return { success: false, error: error.message };
    }
}

// ฟังก์ชันคำนวณจำนวนชั่วโมง
function calculateHours(timeFrom, timeTo) {
    const from = new Date(`2000-01-01T${timeFrom}:00`);
    const to = new Date(`2000-01-01T${timeTo}:00`);
    const diffMs = to - from;
    return Math.round(diffMs / (1000 * 60 * 60) * 100) / 100; // ปัดเศษ 2 ตำแหน่ง
}

// ฟังก์ชันดึงข้อมูลการจองทั้งหมด (สำหรับแอดมิน)
async function getAllBookings(filters = {}) {
    try {
        let query = supabaseClient
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false });

        // เพิ่มฟิลเตอร์
        if (filters.stadium) {
            query = query.eq('stadium_name', filters.stadium);
        }
        if (filters.date) {
            query = query.eq('booking_date', filters.date);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching bookings:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data: data || [] };

    } catch (error) {
        console.error('Error in getAllBookings:', error);
        return { success: false, error: error.message };
    }
}

// ฟังก์ชันวิเคราะห์ข้อมูลการจอง
async function analyzeBookingData(dateFrom, dateTo) {
    try {
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .gte('booking_date', dateFrom)
            .lte('booking_date', dateTo)
            .neq('status', 'cancelled');

        if (error) {
            console.error('Error analyzing booking data:', error);
            return { success: false, error: error.message };
        }

        // วิเคราะห์ข้อมูล
        const analysis = {
            totalBookings: data.length,
            stadiumStats: {},
            timeSlotStats: {},
            dailyStats: {},
            statusStats: {},
            conflicts: []
        };

        // สถิติตามสนาม
        data.forEach(booking => {
            const stadium = booking.stadium_name;
            if (!analysis.stadiumStats[stadium]) {
                analysis.stadiumStats[stadium] = {
                    count: 0,
                    totalHours: 0,
                    revenue: 0
                };
            }
            analysis.stadiumStats[stadium].count++;
            analysis.stadiumStats[stadium].totalHours += booking.total_hours || 0;
        });

        // สถิติตามช่วงเวลา
        data.forEach(booking => {
            const timeSlot = `${booking.time_from}-${booking.time_to}`;
            analysis.timeSlotStats[timeSlot] = (analysis.timeSlotStats[timeSlot] || 0) + 1;
        });

        // สถิติตามวัน
        data.forEach(booking => {
            const date = booking.booking_date;
            analysis.dailyStats[date] = (analysis.dailyStats[date] || 0) + 1;
        });

        // สถิติตามสถานะ
        data.forEach(booking => {
            const status = booking.status;
            analysis.statusStats[status] = (analysis.statusStats[status] || 0) + 1;
        });

        // ตรวจหาการจองที่อาจซ้ำ
        const potentialConflicts = [];
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                const booking1 = data[i];
                const booking2 = data[j];
                
                if (booking1.stadium_name === booking2.stadium_name &&
                    booking1.booking_date === booking2.booking_date &&
                    booking1.id !== booking2.id) {
                    
                    // ตรวจสอบช่วงเวลาทับซ้อน
                    const time1From = booking1.time_from;
                    const time1To = booking1.time_to;
                    const time2From = booking2.time_from;
                    const time2To = booking2.time_to;
                    
                    if ((time1From < time2To && time1To > time2From)) {
                        potentialConflicts.push({
                            booking1: booking1,
                            booking2: booking2,
                            overlapType: 'time_overlap'
                        });
                    }
                }
            }
        }
        
        analysis.conflicts = potentialConflicts;

        return { success: true, data: analysis };

    } catch (error) {
        console.error('Error in analyzeBookingData:', error);
        return { success: false, error: error.message };
    }
}

// Export functions for global use
window.SupabaseBooking = {
    saveBooking,
    checkBookingConflict,
    updatePaymentStatus,
    uploadPaymentSlip,
    getAllBookings,
    analyzeBookingData,
    calculateHours
};