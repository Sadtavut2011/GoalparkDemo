// logout.js - จัดการการออกจากระบบ

class LogoutManager {
    constructor() {
        this.supabase = window.supabase;
        this.init();
    }

    init() {
        this.setupLogoutHandlers();
        this.checkAuthStatus();
    }

    setupLogoutHandlers() {
        // หา logout links ทั้งหมดในหน้า
        const logoutLinks = document.querySelectorAll('a[href="Home.html"]');
        
        logoutLinks.forEach(link => {
            // ตรวจสอบว่าเป็น logout link หรือไม่
            const linkText = link.textContent.trim().toLowerCase();
            if (linkText.includes('log out') || linkText.includes('logout') || linkText.includes('ออกจากระบบ')) {
                // ลบ href เดิมและเพิ่ม event handler
                link.removeAttribute('href');
                link.style.cursor = 'pointer';
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
            }
        });
    }

    async handleLogout() {
        try {
            // แสดง loading state
            this.showLoadingState(true);
            
            // ออกจากระบบใน Supabase
            if (this.supabase) {
                const { error } = await this.supabase.auth.signOut();
                if (error) {
                    console.error('Supabase logout error:', error);
                    // ถ้า error ก็ยังให้ออกจากระบบต่อไป
                }
            }
            
            // ล้างเฉพาะข้อมูลเซสชันปัจจุบัน (ไม่ล้างข้อมูลผู้ใช้)
            this.clearSessionDataOnly();
            
            // แสดงข้อความแจ้ง
            this.showLogoutMessage();
            
            // รอ 1.5 วินาที แล้วไปหน้า Home
            setTimeout(() => {
                window.location.href = 'Home.html';
            }, 1500);
            
        } catch (error) {
            console.error('Logout error:', error);
            // ถ้าเกิด error ก็ยังให้ไปหน้า Home
            this.clearSessionDataOnly();
            setTimeout(() => {
                window.location.href = 'Home.html';
            }, 1000);
        }
    }

    clearSessionDataOnly() {
        // ล้างเฉพาะข้อมูลเซสชันปัจจุบัน (เก็บข้อมูลผู้ใช้ไว้)
        const sessionKeysToRemove = [
            'supabase.auth.token',
            'sb-hsradizrvpziqptvfoxs-auth-token',
            'userSession', // เฉพาะเซสชันปัจจุบัน
            'current_booking_data',
            'currentUserProfile' // ล้างข้อมูลโปรไฟล์ปัจจุบันเมื่อ logout
        ];
        
        sessionKeysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // ล้างเฉพาะ keys ที่เกี่ยวข้องกับ session/token (เก็บข้อมูลผู้ใช้ไว้)
        Object.keys(localStorage).forEach(key => {
            if (key.includes('auth-token') || 
                key.includes('access-token') || 
                key.includes('refresh-token') ||
                key.includes('session') && !key.includes('remembered')) {
                localStorage.removeItem(key);
            }
        });
        
        // ล้าง sessionStorage ทั้งหมด (ข้อมูลชั่วคราว)
        sessionStorage.clear();
    }

    clearAuthCookies() {
        // ลบ cookies ที่เกี่ยวข้องกับ authentication
        const cookiesToClear = [
            'supabase-auth-token',
            'sb-access-token',
            'sb-refresh-token',
            'goalpark-session'
        ];
        
        cookiesToClear.forEach(cookieName => {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
    }

    async checkAuthStatus() {
        // ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่
        try {
            if (this.supabase) {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) {
                    // หากไม่มีเซสชัน แต่ยังมีข้อมูลผู้ใช้ ให้อยู่ในหน้าปัจจุบัน
                    const rememberedEmail = localStorage.getItem('rememberedEmail');
                    if (!rememberedEmail) {
                        console.log('No session and no remembered user, redirecting to home...');
                        setTimeout(() => {
                            window.location.href = 'Home.html';
                        }, 2000);
                    } else {
                        console.log('No session but user data exists, staying on current page...');
                    }
                }
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }

    showLoadingState(show) {
        const logoutLinks = document.querySelectorAll('a');
        logoutLinks.forEach(link => {
            const linkText = link.textContent.trim().toLowerCase();
            if (linkText.includes('log out') || linkText.includes('logout')) {
                if (show) {
                    link.textContent = 'กำลังออกจากระบบ...';
                    link.style.opacity = '0.6';
                } else {
                    link.textContent = 'log out';
                    link.style.opacity = '1';
                }
            }
        });
    }

    showLogoutMessage() {
        // สร้างข้อความแจ้งการออกจากระบบ
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #4CAF50;
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            font-family: Arial, sans-serif;
            text-align: center;
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        messageDiv.innerHTML = `
            <div style="font-size: 18px; margin-bottom: 10px;">✅ ออกจากระบบสำเร็จ</div>
            <div style="font-size: 14px;">ข้อมูลของคุณยังคงอยู่ เพื่อความสะดวกในการเข้าสู่ระบบครั้งต่อไป</div>
            <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">กำลังนำคุณกลับสู่หน้าหลัก...</div>
        `;
        
        // เพิ่ม CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(messageDiv);
        
        // ลบข้อความหลัง 1.2 วินาที
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 1200);
    }
}

// เริ่มต้นใช้งานเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    // รอให้ supabase โหลดเสร็จก่อน
    if (typeof window !== 'undefined') {
        const initLogout = () => {
            if (window.supabase || document.querySelector('script[src*="supabase"]')) {
                new LogoutManager();
            } else {
                // ถ้าไม่มี supabase ก็ยังทำงานได้ (แค่ลบ localStorage)
                setTimeout(initLogout, 500);
            }
        };
        
        initLogout();
    }
});

// Export สำหรับใช้งานในไฟล์อื่น
window.LogoutManager = LogoutManager;