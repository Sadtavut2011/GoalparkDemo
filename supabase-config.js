// การตั้งค่า Supabase สำหรับโปรเจค Goal Park
// แก้ไขค่าเหล่านี้ให้ตรงกับโปรเจค Supabase ของคุณ

const SUPABASE_CONFIG = {
    // URL ของโปรเจค Supabase
    url: 'https://hsradizrvpziqptvfoxs.supabase.co',
    
    // Anon Key (Public Key) 
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcmFkaXpydnB6aXFwdHZmb3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTkwNTgsImV4cCI6MjA3NTU5NTA1OH0.wwe4cK4CLQAaFv22BOXbQTVETB_E-u9eF1s7iJpoIJs',
    
    // การตั้งค่าตารางและ Schema
    tables: {
        users: 'users',
        user_sessions: 'user_sessions',
        bookings: 'bookings',
        stadiums: 'stadiums',
        payment_slips: 'payment_slips',
        profiles: 'profiles' // เพิ่มสำหรับระบบใหม่
    },
    
    // การตั้งค่า Storage Bucket (อัพเดทสำหรับระบบใหม่)
    storage: {
        bucketName: 'booking-files', // เก่า
        paymentSlips: {
            bucket: 'payment-slips',
            maxSize: 50 * 1024 * 1024, // 50MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        },
        stadiumImages: {
            bucket: 'stadium-images',
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        },
        maxFileSize: 5 * 1024 * 1024, // 5MB (เก่า)
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'] // เก่า
    },
    
    // ราคาสนามต่อชั่วโมง (บาท)
    stadiumPrices: {
        'The jaguar Maejo stadium': 500,
        'Maejo Arena': 800,
        'สนามฟุตบอล รวมโชค สปอร์ตคลับ': 400
    },
    
    // การตั้งค่าการเข้าสู่ระบบ
    auth: {
        // ระยะเวลาที่เซสชันจะหมดอายุ (วัน)
        sessionTimeout: 7,
        // ระยะเวลาที่จะจำการเข้าสู่ระบบ (วัน)
        rememberMeDuration: 30,
        // การตั้งค่าเพิ่มเติมสำหรับระบบใหม่
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
};

// สร้าง Supabase client (อัพเดทด้วยการตั้งค่าใหม่)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
        autoRefreshToken: SUPABASE_CONFIG.auth.autoRefreshToken,
        persistSession: SUPABASE_CONFIG.auth.persistSession,
        detectSessionInUrl: SUPABASE_CONFIG.auth.detectSessionInUrl
    },
    realtime: {
        enabled: true
    }
});

// 📋 Helper Functions (ใหม่)
const SupabaseHelper = {
    // ตรวจสอบการเชื่อมต่อ
    async testConnection() {
        try {
            const { data, error } = await supabaseClient
                .from('stadiums')
                .select('count', { count: 'exact', head: true });
            
            if (error) throw error;
            
            console.log('✅ Supabase connection successful');
            return true;
        } catch (error) {
            console.error('❌ Supabase connection failed:', error);
            return false;
        }
    },

    // ตรวจสอบสิทธิ์ Admin
    async isAdmin() {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return false;

            const { data, error } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data?.role === 'admin';
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    },

    // อัพโหลดไฟล์
    async uploadFile(bucket, file, path) {
        try {
            const { data, error } = await supabaseClient.storage
                .from(bucket)
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error uploading to ${bucket}:`, error);
            throw error;
        }
    },

    // ดาวน์โหลด URL ของไฟล์
    getFileUrl(bucket, path) {
        const { data } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(path);
        
        return data.publicUrl;
    },

    // ลบไฟล์
    async deleteFile(bucket, path) {
        try {
            const { error } = await supabaseClient.storage
                .from(bucket)
                .remove([path]);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`Error deleting from ${bucket}:`, error);
            throw error;
        }
    }
};

// 🔔 Real-time Subscriptions Helper (ใหม่)
const RealtimeHelper = {
    // Subscribe to booking changes
    subscribeToBookings(callback) {
        return supabaseClient
            .channel('booking-changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'bookings' 
                }, 
                callback
            )
            .subscribe();
    },

    // Subscribe to payment slip uploads
    subscribeToPaymentSlips(callback) {
        return supabaseClient
            .channel('payment-slip-changes')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'payment_slips' 
                }, 
                callback
            )
            .subscribe();
    },

    // Subscribe to admin notifications
    subscribeToAdminNotifications(callback) {
        return supabaseClient
            .channel('admin-notifications')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'bookings',
                    filter: 'status=eq.pending_admin_approval'
                }, 
                callback
            )
            .subscribe();
    },

    // Unsubscribe from channel
    unsubscribe(subscription) {
        if (subscription) {
            supabaseClient.removeChannel(subscription);
        }
    }
};

// 🎯 API Helpers (ใหม่)
const API = {
    // Authentication
    auth: {
        async signUp(email, password, metadata = {}) {
            return await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: metadata
                }
            });
        },

        async signIn(email, password) {
            return await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
        },

        async signOut() {
            return await supabaseClient.auth.signOut();
        },

        async getCurrentUser() {
            return await supabaseClient.auth.getUser();
        },

        async updateProfile(updates) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) throw new Error('No user logged in');

            return await supabaseClient
                .from('profiles')
                .update(updates)
                .eq('id', user.id);
        }
    },

    // Stadiums
    stadiums: {
        async getAll() {
            return await supabaseClient
                .from('stadiums')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });
        },

        async getById(id) {
            return await supabaseClient
                .from('stadiums')
                .select('*')
                .eq('id', id)
                .single();
        }
    },

    // Bookings
    bookings: {
        async create(bookingData) {
            return await supabaseClient
                .from('bookings')
                .insert([bookingData])
                .select()
                .single();
        },

        async getMyBookings() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) throw new Error('No user logged in');

            return await supabaseClient
                .from('bookings')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
        },

        async getAdminSummary() {
            return await supabaseClient
                .from('admin_booking_summary')
                .select('*')
                .order('created_at', { ascending: false });
        }
    },

    // Payment Slips
    paymentSlips: {
        async upload(bookingId, file) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) throw new Error('No user logged in');

            // อัพโหลดไฟล์
            const fileName = `${user.id}/${bookingId}/${Date.now()}_${file.name}`;
            const uploadResult = await SupabaseHelper.uploadFile(
                SUPABASE_CONFIG.storage.paymentSlips.bucket,
                file,
                fileName
            );

            // บันทึกข้อมูลในฐานข้อมูล
            return await supabaseClient
                .from('payment_slips')
                .insert([{
                    booking_id: bookingId,
                    user_id: user.id,
                    file_name: file.name,
                    file_path: fileName,
                    file_size: file.size
                }])
                .select()
                .single();
        }
    },

    // Admin Functions
    admin: {
        async getDashboardStats() {
            const { data, error } = await supabaseClient
                .rpc('get_admin_dashboard_stats');
            
            if (error) throw error;
            return data;
        },

        async approveBooking(bookingId, notes = '') {
            const { data, error } = await supabaseClient
                .rpc('admin_approve_booking', {
                    p_booking_id: bookingId,
                    p_admin_notes: notes
                });
            
            if (error) throw error;
            return data;
        },

        async rejectBooking(bookingId, notes) {
            const { data, error } = await supabaseClient
                .rpc('admin_reject_booking', {
                    p_booking_id: bookingId,
                    p_admin_notes: notes
                });
            
            if (error) throw error;
            return data;
        }
    }
};

// ✅ ตรวจสอบการเชื่อมต่อเมื่อโหลดไฟล์
document.addEventListener('DOMContentLoaded', async () => {
    const isConnected = await SupabaseHelper.testConnection();
    if (!isConnected) {
        console.warn('⚠️ ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบการตั้งค่า');
    }
});

// Export สำหรับใช้งานในไฟล์อื่น (รวมเดิมและใหม่)
window.supabase = supabaseClient;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.SupabaseHelper = SupabaseHelper;
window.RealtimeHelper = RealtimeHelper;
window.API = API;

console.log('🚀 GOAL PARK Supabase Config (Merged) loaded successfully!');