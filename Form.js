// Form.js - JavaScript for authentication forms

class AuthManager {
    constructor() {
        this.supabase = supabase;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Password confirmation validation
        document.getElementById('confirmPassword').addEventListener('input', (e) => {
            this.validatePasswordConfirmation();
        });

        // Forgot password
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update form content
        document.querySelectorAll('.form-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-form`).classList.add('active');

        // Clear message
        this.hideMessage();
    }

    async handleLogin() {
        const formData = new FormData(document.getElementById('loginForm'));
        const email = formData.get('email');
        const password = formData.get('password');
        const rememberMe = formData.get('rememberMe');

        if (!email || !password) {
            this.showMessage('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Sign in with Supabase
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                throw error;
            }

            // Update user session in database
            await this.updateUserSession(data.user.id, data.user.email, rememberMe);

            this.showMessage('เข้าสู่ระบบสำเร็จ! กำลังนำคุณไปยังหน้าหลัก...', 'success');
            
            // Store user info in localStorage for future logins
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
                localStorage.setItem('userSession', JSON.stringify({
                    id: data.user.id,
                    email: data.user.email,
                    loginTime: new Date().toISOString()
                }));
            } else {
                // แม้ไม่ tick remember me ก็ยังเก็บอีเมลไว้เพื่อความสะดวก
                localStorage.setItem('rememberedEmail', email);
            }

            // เก็บข้อมูลผู้ใช้สำหรับ UserManager
            await this.storeUserProfileForSession(data.user);

            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            console.error('Login error:', error);
            this.showMessage(this.getErrorMessage(error), 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister() {
        const formData = new FormData(document.getElementById('registerForm'));
        const fullName = formData.get('fullName');
        const email = formData.get('email');
        const phone = formData.get('phone');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const agreeTerms = formData.get('agreeTerms');

        // Validation
        if (!fullName || !email || !phone || !password || !confirmPassword) {
            this.showMessage('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('รหัสผ่านไม่ตรงกัน', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
            return;
        }

        if (!agreeTerms) {
            this.showMessage('กรุณายอมรับข้อกำหนดการใช้งาน', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Sign up with Supabase
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        phone: phone
                    }
                }
            });

            if (error) {
                throw error;
            }

            // Insert user profile into users table
            const { error: profileError } = await this.supabase
                .from('users')
                .insert([
                    {
                        id: data.user.id,
                        email: email,
                        full_name: fullName,
                        phone: phone,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (profileError) {
                console.error('Profile creation error:', profileError);
            }

            this.showMessage('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี', 'success');
            
            // เก็บอีเมลไว้เพื่อความสะดวกในการเข้าสู่ระบบ
            localStorage.setItem('rememberedEmail', email);
            
            // Clear form
            document.getElementById('registerForm').reset();
            
            // Switch to login tab after 3 seconds
            setTimeout(() => {
                this.switchTab('login');
                document.getElementById('loginEmail').value = email;
            }, 3000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage(this.getErrorMessage(error), 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('loginEmail').value;
        
        if (!email) {
            this.showMessage('กรุณากรอกอีเมลที่ต้องการรีเซ็ตรหัสผ่าน', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            });

            if (error) {
                throw error;
            }

            this.showMessage('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว', 'success');

        } catch (error) {
            console.error('Password reset error:', error);
            this.showMessage(this.getErrorMessage(error), 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async updateUserSession(userId, email, rememberMe) {
        try {
            const { error } = await this.supabase
                .from('user_sessions')
                .upsert([
                    {
                        user_id: userId,
                        email: email,
                        last_login: new Date().toISOString(),
                        remember_me: rememberMe,
                        ip_address: await this.getClientIP(),
                        user_agent: navigator.userAgent
                    }
                ]);

            if (error) {
                console.error('Session update error:', error);
            }
        } catch (error) {
            console.error('Session update error:', error);
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    async checkExistingSession() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                this.currentUser = session.user;
                // User is already logged in, redirect to login page
                window.location.href = 'login.html';
                return;
            }

            // Check localStorage for remembered email
            const rememberedEmail = localStorage.getItem('rememberedEmail');
            if (rememberedEmail) {
                document.getElementById('loginEmail').value = rememberedEmail;
                document.getElementById('rememberMe').checked = true;
            }

        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    validatePasswordConfirmation() {
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const confirmInput = document.getElementById('confirmPassword');

        if (confirmPassword && password !== confirmPassword) {
            confirmInput.style.borderColor = '#f44336';
            this.showMessage('รหัสผ่านไม่ตรงกัน', 'error');
        } else {
            confirmInput.style.borderColor = '#e0e0e0';
            this.hideMessage();
        }
    }

    showMessage(message, type) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.style.display = 'block';

        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideMessage();
        }, 5000);
    }

    hideMessage() {
        const messageEl = document.getElementById('message');
        messageEl.style.display = 'none';
    }

    showLoading(show) {
        const loadingEl = document.getElementById('loadingOverlay');
        loadingEl.style.display = show ? 'flex' : 'none';
    }

    // เก็บข้อมูลผู้ใช้สำหรับใช้ในหน้าอื่น
    async storeUserProfileForSession(user) {
        try {
            // ดึงข้อมูลจากตาราง users
            const { data: userData, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            let userProfile;

            if (userError || !userData) {
                // หากไม่พบข้อมูลในตาราง ใช้ข้อมูลจาก auth metadata
                userProfile = {
                    full_name: user.user_metadata?.full_name || 'ผู้ใช้ระบบ',
                    email: user.email,
                    id: user.id
                };
            } else {
                userProfile = userData;
            }

            // เก็บใน localStorage สำหรับใช้ในหน้าอื่น
            localStorage.setItem('currentUserProfile', JSON.stringify(userProfile));

        } catch (error) {
            console.error('Error storing user profile:', error);
            // สร้างข้อมูลพื้นฐานหากเกิดข้อผิดพลาด
            const basicProfile = {
                full_name: user.user_metadata?.full_name || 'ผู้ใช้ระบบ',
                email: user.email,
                id: user.id
            };
            localStorage.setItem('currentUserProfile', JSON.stringify(basicProfile));
        }
    }

    getErrorMessage(error) {
        switch (error.message) {
            case 'Invalid login credentials':
                return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            case 'Email rate limit exceeded':
                return 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่';
            case 'User already registered':
                return 'อีเมลนี้ถูกใช้งานแล้ว';
            case 'Password should be at least 6 characters':
                return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
            case 'Unable to validate email address: invalid format':
                return 'รูปแบบอีเมลไม่ถูกต้อง';
            case 'Signup is disabled':
                return 'การสมัครสมาชิกถูกปิดใช้งานชั่วคราว';
            default:
                return error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});