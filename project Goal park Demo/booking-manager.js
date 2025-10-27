// Enhanced Booking System with Payment Integration
// ระบบจองสนามพร้อมการชำระเงินและตรวจสอบการจองซ้ำ

class BookingManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentBooking = null;
        this.paymentSlipFile = null;
    }

    // ฟังก์ชันสำหรับสร้างการจองใหม่
    async createBooking(bookingData) {
        try {
            // 1. ตรวจสอบการจองซ้ำ
            const conflictCheck = await this.checkBookingConflicts(
                bookingData.stadium_name,
                bookingData.booking_date,
                bookingData.time_from,
                bookingData.time_to
            );

            if (conflictCheck.hasConflict) {
                return {
                    success: false,
                    error: 'พบการจองซ้ำในช่วงเวลานี้',
                    conflicts: conflictCheck.conflicts,
                    message: `มีการจองในช่วงเวลา ${bookingData.time_from} - ${bookingData.time_to} แล้ว ${conflictCheck.conflicts.length} รายการ`
                };
            }

            // 2. หาข้อมูลสนามและราคา
            const stadiumInfo = await this.getStadiumInfo(bookingData.stadium_name);
            if (!stadiumInfo.success) {
                return {
                    success: false,
                    error: 'ไม่พบข้อมูลสนาม',
                    message: 'กรุณาตรวจสอบชื่อสนามที่เลือก'
                };
            }

            // 3. คำนวณเวลาและราคา
            const totalHours = this.calculateHours(bookingData.time_from, bookingData.time_to);
            const totalPrice = stadiumInfo.data.price_per_hour * totalHours;

        // 4. สร้างข้อมูลการจอง
        const bookingPayload = {
            user_id: bookingData.user_id || null,
            stadium_name: bookingData.stadium_name,
            stadium_address: stadiumInfo.data.address,
            booker_name: bookingData.booker_name,
            booker_phone: bookingData.booker_phone || null,
            booker_email: bookingData.booker_email || null,
            booking_date: bookingData.booking_date,
            start_time: bookingData.time_from, // แปลงจาก time_from เป็น start_time
            end_time: bookingData.time_to,     // แปลงจาก time_to เป็น end_time
            total_hours: totalHours,
            price_per_hour: stadiumInfo.data.price_per_hour,
            total_price: totalPrice,
            payment_method: bookingData.payment_method || 'bank_transfer',
            special_requirements: bookingData.special_requirements || null,
            notes: bookingData.notes || null,
            status: 'pending_payment',
            payment_status: 'pending'
        };            // 5. บันทึกลงฐานข้อมูล
            const { data, error } = await this.supabase
                .from('bookings')
                .insert([bookingPayload])
                .select('*')
                .single();

            if (error) {
                console.error('Supabase error:', error);
                return {
                    success: false,
                    error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
                    details: error.message
                };
            }

            this.currentBooking = data;

            return {
                success: true,
                data: data,
                message: 'สร้างการจองเรียบร้อย กรุณาชำระเงินและแนบสลิป',
                totalPrice: totalPrice,
                bookingId: data.id
            };

        } catch (error) {
            console.error('Error creating booking:', error);
            return {
                success: false,
                error: 'เกิดข้อผิดพลาดในระบบ',
                details: error.message
            };
        }
    }

    // ตรวจสอบการจองซ้ำ
    async checkBookingConflicts(stadiumName, date, timeFrom, timeTo) {
        try {
            const { data, error } = await this.supabase
                .rpc('check_booking_conflict', {
                    p_stadium_name: stadiumName,
                    p_booking_date: date,
                    p_start_time: timeFrom,  // แปลงจาก p_time_from เป็น p_start_time
                    p_end_time: timeTo       // แปลงจาก p_time_to เป็น p_end_time
                });

            if (error) {
                console.error('Error checking conflicts:', error);
                return { hasConflict: false, conflicts: [], error: error.message };
            }

            // ปรับให้ตรงกับ return format ของ function
            const result = data && data.length > 0 ? data[0] : { has_conflict: false, conflicting_bookings: [] };
            
            return {
                hasConflict: result.has_conflict || false,
                conflicts: Array.isArray(result.conflicting_bookings) ? result.conflicting_bookings : [],
                count: Array.isArray(result.conflicting_bookings) ? result.conflicting_bookings.length : 0
            };

        } catch (error) {
            console.error('Error in checkBookingConflicts:', error);
            return { hasConflict: false, conflicts: [], error: error.message };
        }
    }

    // หาข้อมูลสนาม
    async getStadiumInfo(stadiumName) {
        try {
            const { data, error } = await this.supabase
                .from('stadiums')
                .select('*')
                .eq('name', stadiumName)
                .eq('status', 'active')
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, data: data };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // อัปโหลดสลิปการชำระเงิน
    async uploadPaymentSlip(bookingId, file) {
        try {
            if (!file) {
                return { success: false, error: 'กรุณาเลือกไฟล์สลิป' };
            }

            if (!bookingId) {
                return { success: false, error: 'ไม่พบ Booking ID' };
            }

            // ตรวจสอบประเภทไฟล์
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                return { 
                    success: false, 
                    error: 'ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, GIF)' 
                };
            }

            // ตรวจสอบขนาดไฟล์ (สูงสุด 5MB)
            if (file.size > 5 * 1024 * 1024) {
                return { 
                    success: false, 
                    error: 'ขนาดไฟล์เกิน 5MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า' 
                };
            }

            console.log('Starting payment slip upload for booking:', bookingId);

            const fileExt = file.name.split('.').pop();
            const fileName = `slip_${bookingId}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // อัปโหลดไฟล์ไป Supabase Storage
            const { data: uploadData, error: uploadError } = await this.supabase.storage
                .from('payment-slips')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Storage upload error:', uploadError);
                return { 
                    success: false, 
                    error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์',
                    details: uploadError.message 
                };
            }

            console.log('File uploaded successfully:', uploadData);

            // บันทึกข้อมูลสลิปลงตาราง payment_slips (ยืนยันเลย)
            const { data: slipData, error: slipError } = await this.supabase
                .from('payment_slips')
                .insert({
                    booking_id: bookingId,
                    file_name: fileName,
                    file_path: filePath,
                    file_size: file.size,
                    file_type: file.type,
                    verification_status: 'verified', // เปลี่ยนจาก pending เป็น verified
                    verified_at: new Date().toISOString(), // เพิ่มเวลาที่ยืนยัน
                    verified_by: 'auto_system' // ระบุว่ายืนยันโดยระบบอัตโนมัติ
                })
                .select()
                .single();

            if (slipError) {
                console.error('Error saving slip data:', slipError);
                return { 
                    success: false, 
                    error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสลิป',
                    details: slipError.message 
                };
            }

            console.log('Payment slip data saved and verified:', slipData);

            // อัปเดตสถานะการชำระเงินในตาราง bookings (เป็น confirmed เลย)
            const { data: bookingData, error: updateError } = await this.supabase
                .from('bookings')
                .update({ 
                    status: 'confirmed', // เปลี่ยนจาก pending_payment เป็น confirmed
                    payment_status: 'paid', // เปลี่ยนจาก pending_verification เป็น paid
                    payment_slip_url: filePath,
                    payment_slip_filename: fileName,
                    confirmed_at: new Date().toISOString(), // เพิ่มเวลาที่ยืนยัน
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating booking status:', updateError);
                return { 
                    success: false, 
                    error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะการจอง',
                    details: updateError.message 
                };
            }

            console.log('Booking updated successfully:', bookingData);

            return {
                success: true,
                data: {
                    slip: slipData,
                    booking: bookingData,
                    filePath: filePath
                },
                message: 'การจองสำเร็จ! ข้อมูลถูกบันทึกแล้ว' // เปลี่ยนข้อความ
            };

        } catch (error) {
            console.error('Error in uploadPaymentSlip:', error);
            return {
                success: false,
                error: 'เกิดข้อผิดพลาดในระบบ',
                details: error.message
            };
        }
    }

    // อัปเดตสถานะการชำระเงิน
    async updateBookingPaymentStatus(bookingId, paymentStatus, slipUrl = null, slipFilename = null) {
        try {
            const updateData = {
                payment_status: paymentStatus,
                updated_at: new Date().toISOString()
            };

            // ถ้าเป็นการชำระเงินสำเร็จ ให้เปลี่ยนสถานะเป็น confirmed
            if (paymentStatus === 'paid') {
                updateData.status = 'confirmed';
                updateData.payment_slip_url = slipUrl;
                updateData.payment_slip_filename = slipFilename;
            }

            const { data, error } = await this.supabase
                .from('bookings')
                .update(updateData)
                .eq('id', bookingId)
                .select()
                .single();

            if (error) {
                console.error('Error updating payment status:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data };

        } catch (error) {
            console.error('Error in updateBookingPaymentStatus:', error);
            return { success: false, error: error.message };
        }
    }

    // ยืนยันการชำระเงิน (สำหรับแอดมิน)
    async verifyPayment(bookingId, verifiedBy, isApproved, notes = '') {
        try {
            const verificationStatus = isApproved ? 'verified' : 'rejected';
            const bookingStatus = isApproved ? 'confirmed' : 'pending_payment';

            // อัปเดตสถานะการยืนยันในตาราง payment_slips
            const { error: slipError } = await this.supabase
                .from('payment_slips')
                .update({
                    verification_status: verificationStatus,
                    verified_by: verifiedBy,
                    verified_at: new Date().toISOString(),
                    notes: notes
                })
                .eq('booking_id', bookingId);

            if (slipError) {
                return { success: false, error: slipError.message };
            }

            // อัปเดตสถานะการจองในตาราง bookings
            const { data, error } = await this.supabase
                .from('bookings')
                .update({
                    status: bookingStatus,
                    payment_verified_at: isApproved ? new Date().toISOString() : null,
                    payment_verified_by: verifiedBy,
                    payment_notes: notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId)
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            return {
                success: true,
                data: data,
                message: isApproved ? 'ยืนยันการชำระเงินเรียบร้อย' : 'ปฏิเสธการชำระเงิน'
            };

        } catch (error) {
            console.error('Error in verifyPayment:', error);
            return { success: false, error: error.message };
        }
    }

    // ดูข้อมูลการจองทั้งหมด
    async getBookings(filters = {}) {
        try {
            let query = this.supabase
                .from('booking_details')
                .select('*');

            // ใส่ filter
            if (filters.stadium_name) {
                query = query.eq('stadium_name', filters.stadium_name);
            }
            if (filters.booking_date) {
                query = query.eq('booking_date', filters.booking_date);
            }
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.payment_status) {
                query = query.eq('payment_status', filters.payment_status);
            }
            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }

            // เรียงตามวันที่สร้าง
            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, data: data };

        } catch (error) {
            console.error('Error in getBookings:', error);
            return { success: false, error: error.message };
        }
    }

    // ยกเลิกการจอง
    async cancelBooking(bookingId, reason = '') {
        try {
            const { data, error } = await this.supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    notes: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId)
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            return {
                success: true,
                data: data,
                message: 'ยกเลิกการจองเรียบร้อย'
            };

        } catch (error) {
            console.error('Error in cancelBooking:', error);
            return { success: false, error: error.message };
        }
    }

    // ลบการจองจากฐานข้อมูลอย่างสมบูรณ์
    async deleteBooking(bookingId) {
        try {
            // วิธีที่ 1: ใช้ Database Function (แนะนำ)
            const { data, error } = await this.supabase
                .rpc('safe_delete_booking', {
                    p_booking_id: bookingId
                });

            if (error) {
                console.error('Error calling safe_delete_booking:', error);
                // Fallback ไปวิธีที่ 2 ถ้า function ไม่ทำงาน
                return await this.deleteBookingDirect(bookingId);
            }

            if (data && data.success) {
                return {
                    success: true,
                    data: data.deleted_booking,
                    message: data.message || 'ลบการจองเรียบร้อย'
                };
            } else {
                return {
                    success: false,
                    error: data?.error || 'ไม่สามารถลบการจองได้'
                };
            }

        } catch (error) {
            console.error('Error in deleteBooking:', error);
            // Fallback ไปวิธีที่ 2 ถ้าเกิดข้อผิดพลาด
            return await this.deleteBookingDirect(bookingId);
        }
    }

    // วิธีลบโดยตรง (Fallback method)
    async deleteBookingDirect(bookingId) {
        try {
            // ตรวจสอบว่าการจองมีอยู่จริงก่อน (ใช้ชื่อฟิลด์ที่ถูกต้อง)
            const { data: existingBooking, error: checkError } = await this.supabase
                .from('bookings')
                .select('id, booker_name, stadium_name, booking_date, start_time, end_time')
                .eq('id', bookingId)
                .single();

            if (checkError || !existingBooking) {
                return { 
                    success: false, 
                    error: 'ไม่พบการจองที่ต้องการลบ' 
                };
            }

            // ลบการจอง
            const { error: deleteError } = await this.supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId);

            if (deleteError) {
                return { 
                    success: false, 
                    error: deleteError.message 
                };
            }

            return {
                success: true,
                data: existingBooking,
                message: 'ลบการจองเรียบร้อย'
            };

        } catch (error) {
            console.error('Error in deleteBookingDirect:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // ฟังก์ชันช่วยคำนวณจำนวนชั่วโมง
    calculateHours(timeFrom, timeTo) {
        const [fromHour, fromMin] = timeFrom.split(':').map(Number);
        const [toHour, toMin] = timeTo.split(':').map(Number);
        
        const fromMinutes = fromHour * 60 + fromMin;
        const toMinutes = toHour * 60 + toMin;
        
        return (toMinutes - fromMinutes) / 60;
    }

    // ฟังก์ชันช่วยจัดรูปแบบเวลา
    formatTime(time) {
        return new Date(`2000-01-01 ${time}`).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    // ฟังก์ชันช่วยจัดรูปแบบวันที่
    formatDate(date) {
        return new Date(date).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    }
}

// Export class สำหรับใช้งาน
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookingManager;
} else {
    window.BookingManager = BookingManager;
}