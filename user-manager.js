// user-manager.js - จัดการข้อมูลผู้ใช้ที่เข้าสู่ระบบ

class UserManager {
    constructor() {
        this.supabase = window.supabase;
        this.currentUser = null;
        this.userProfile = null;
        this.init();
    }

    async init() {
        if (!this.supabase) {
            console.error('Supabase is not initialized');
            return;
        }
        
        await this.checkUserSession();
        this.displayUserInfo();
    }

    // ตรวจสอบเซสชันของผู้ใช้
    async checkUserSession() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session && session.user) {
                this.currentUser = session.user;
                await this.getUserProfile();
            } else {
                // ลองดึงจาก localStorage หากไม่มีเซสชันจาก Supabase
                const storedProfile = localStorage.getItem('currentUserProfile');
                if (storedProfile) {
                    this.userProfile = JSON.parse(storedProfile);
                    console.log('ใช้ข้อมูลผู้ใช้จาก localStorage:', this.userProfile);
                } else {
                    // หากไม่มีเซสชัน ให้ redirect ไปหน้าแรก
                    this.redirectToHome();
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking user session:', error);
            // ลองดึงจาก localStorage หากเกิดข้อผิดพลาด
            const storedProfile = localStorage.getItem('currentUserProfile');
            if (storedProfile) {
                this.userProfile = JSON.parse(storedProfile);
                console.log('ใช้ข้อมูลผู้ใช้จาก localStorage (fallback):', this.userProfile);
            } else {
                this.redirectToHome();
            }
        }
    }

    // ดึงข้อมูลโปรไฟล์ผู้ใช้จากฐานข้อมูล
    async getUserProfile() {
        if (!this.currentUser) return;

        try {
            // ดึงข้อมูลจากตาราง users
            const { data: userData, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (userError) {
                console.error('Error fetching user data:', userError);
                // ลองดึงจาก auth metadata หากไม่พบในตาราง users
                this.userProfile = {
                    full_name: this.currentUser.user_metadata?.full_name || 'ผู้ใช้ระบบ',
                    email: this.currentUser.email
                };
            } else if (userData) {
                this.userProfile = userData;
            }

            // หากยังไม่มีข้อมูล ให้สร้างจาก auth metadata
            if (!this.userProfile && this.currentUser.user_metadata) {
                this.userProfile = {
                    full_name: this.currentUser.user_metadata.full_name || 'ผู้ใช้ระบบ',
                    email: this.currentUser.email
                };
            }

            // บันทึกข้อมูลใน profiles table เมื่อผู้ใช้เข้าสู่ระบบ
            await this.saveUserProfile();

            // เก็บข้อมูลใน localStorage สำหรับใช้งานอื่น
            if (this.userProfile) {
                localStorage.setItem('currentUserProfile', JSON.stringify(this.userProfile));
            }

        } catch (error) {
            console.error('Error getting user profile:', error);
            this.userProfile = {
                full_name: 'ผู้ใช้ระบบ',
                email: this.currentUser?.email || ''
            };
        }
    }

    // บันทึกข้อมูลผู้ใช้ใน profiles table
    async saveUserProfile() {
        if (!this.currentUser || !this.userProfile) return;

        try {
            // ตรวจสอบว่ามีข้อมูลใน profiles table หรือไม่
            const { data: existingProfile, error: checkError } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('Error checking existing profile:', checkError);
                return;
            }

            const profileData = {
                id: this.currentUser.id,
                email: this.userProfile.email || this.currentUser.email,
                full_name: this.userProfile.full_name || this.userProfile.name || 'ผู้ใช้ระบบ',
                phone: this.userProfile.phone || null,
                role: this.userProfile.role || 'user',
                updated_at: new Date().toISOString()
            };

            if (existingProfile) {
                // อัพเดทข้อมูลที่มีอยู่
                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update({
                        ...profileData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentUser.id);

                if (updateError) {
                    console.error('Error updating profile:', updateError);
                } else {
                    console.log('Profile updated successfully');
                }
            } else {
                // สร้างข้อมูลใหม่
                const { error: insertError } = await this.supabase
                    .from('profiles')
                    .insert({
                        ...profileData,
                        created_at: new Date().toISOString()
                    });

                if (insertError) {
                    console.error('Error inserting profile:', insertError);
                } else {
                    console.log('Profile created successfully');
                }
            }

        } catch (error) {
            console.error('Error saving user profile:', error);
        }
    }

    // แสดงข้อมูลผู้ใช้ในหน้าเว็บ
    displayUserInfo() {
        if (!this.userProfile) return;

        // สร้าง element สำหรับแสดงชื่อผู้ใช้
        this.createUserDisplay();
        this.updateUserDisplay();
    }

    // สร้าง element สำหรับแสดงชื่อผู้ใช้
    createUserDisplay() {
        // ตรวจสอบว่ามี element อยู่แล้วหรือไม่
        if (document.getElementById('userNameDisplay')) return;

        // หา element ที่จะใส่ข้อมูลผู้ใช้ (แถบด้านบน)
        const targetElement = this.findTargetElement();
        
        if (targetElement) {
            // สร้าง user display element
            const userDisplayHTML = `
                <div id="userNameDisplay" class="user-name-display">
                    <div class="user-info">
                        <span class="welcome-text">ยินดีต้อนรับ</span>
                        <span class="user-name" id="displayUserName">กำลังโหลด...</span>
                    </div>
                </div>
            `;

            // เพิ่ม CSS สำหรับ user display
            this.addUserDisplayStyles();

            // แทรก HTML
            targetElement.insertAdjacentHTML('afterbegin', userDisplayHTML);

            // เพิ่ม event listeners
            this.setupUserDisplayEvents();
        }
    }

    // หา element ที่เหมาะสมสำหรับใส่ข้อมูลผู้ใช้
    findTargetElement() {
        // ลองหา element ต่างๆ ตามลำดับความเหมาะสม
        const selectors = [
            '.menu',           // สำหรับ login.html
            '.group',          // สำหรับ login2.html, login3.html
            'body',            // fallback
            '.container'       // fallback อื่น
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }

        return document.body; // fallback สุดท้าย
    }

    // เพิ่ม CSS สำหรับ user display
    addUserDisplayStyles() {
        if (document.getElementById('userDisplayStyles')) return;

        const styles = `
            <style id="userDisplayStyles">
                .user-name-display {
                    position: fixed;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    padding: 8px 16px;
                    border-radius: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 1000;
                    font-family: 'Sarabun', Arial, sans-serif;
                    border: 1px solid rgba(0,0,0,0.1);
                }

                .user-info {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                }

                .welcome-text {
                    font-size: 11px;
                    color: #666;
                    font-weight: normal;
                }

                .user-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }



                /* Responsive สำหรับหน้าจอเล็ก */
                @media (max-width: 768px) {
                    .user-name-display {
                        position: relative;
                        top: 0;
                        left: 0;
                        transform: none;
                        margin: 10px;
                        padding: 6px 12px;
                    }

                    .user-name {
                        max-width: 150px;
                        font-size: 13px;
                    }

                    .welcome-text {
                        font-size: 10px;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // อัพเดทข้อมูลผู้ใช้ที่แสดง
    updateUserDisplay() {
        const userNameElement = document.getElementById('displayUserName');
        if (userNameElement && this.userProfile) {
            userNameElement.textContent = this.userProfile.full_name || 'ผู้ใช้ระบบ';
        }
    }

    // ตั้งค่า event listeners สำหรับ user display
    setupUserDisplayEvents() {
        // ไม่มี event listeners เพิ่มเติมเนื่องจากลบเมนูออกแล้ว
    }



    // redirect ไปหน้าแรกหากไม่มีการเข้าสู่ระบบ
    redirectToHome() {
        // ตรวจสอบว่าเป็นหน้าทดสอบหรือไม่
        if (window.location.pathname.includes('test-user-display.html')) {
            return; // ไม่ redirect หากเป็นหน้าทดสอบ
        }
        
        console.log('ไม่พบเซสชันผู้ใช้ กำลัง redirect ไป Home.html');
        setTimeout(() => {
            window.location.href = 'Home.html';
        }, 1000);
    }

    // ฟังก์ชันสำหรับใช้งานจากภายนอก
    getCurrentUser() {
        return this.userProfile;
    }

    // รีเฟรชข้อมูลผู้ใช้
    async refreshUserData() {
        await this.getUserProfile();
        this.updateUserDisplay();
    }
}

// สร้าง instance เมื่อโหลดหน้าเว็บ
let userManager;

// รอให้ DOM โหลดเสร็จ และ supabase พร้อม
document.addEventListener('DOMContentLoaded', () => {
    // รอให้ supabase โหลดเสร็จ
    const initUserManager = () => {
        if (window.supabase) {
            userManager = new UserManager();
        } else {
            // รอต่ออีก 100ms หาก supabase ยังไม่โหลด
            setTimeout(initUserManager, 100);
        }
    };

    initUserManager();
});

// Export สำหรับใช้งานในไฟล์อื่น
window.UserManager = UserManager;