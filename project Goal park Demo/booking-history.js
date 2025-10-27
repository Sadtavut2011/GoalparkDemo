// booking-history.js - ระบบประวัติการจองของผู้ใช้

class BookingHistory {
    constructor() {
        this.supabase = window.supabase;
        this.currentUser = null;
        this.bookingData = [];
        this.overlayVisible = false;
        this.init();
    }

    async init() {
        console.log('BookingHistory: Initializing...'); // Debug log
        
        if (!this.supabase) {
            console.error('Supabase is not initialized');
            return;
        }
        
        await this.getCurrentUser();
        console.log('BookingHistory: Current user:', this.currentUser); // Debug log
        
        this.createHistoryOverlay();
        this.setupArrowButton();
        
        console.log('BookingHistory: Initialization complete'); // Debug log
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    async getCurrentUser() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session && session.user) {
                this.currentUser = session.user;
            } else {
                // ลองดึงจาก localStorage
                const storedProfile = localStorage.getItem('currentUserProfile');
                if (storedProfile) {
                    const profile = JSON.parse(storedProfile);
                    this.currentUser = { id: profile.id };
                }
            }
        } catch (error) {
            console.error('Error getting current user:', error);
        }
    }

    // สร้าง overlay สำหรับแสดงประวัติการจอง
    createHistoryOverlay() {
        // ตรวจสอบว่ามี overlay อยู่แล้วหรือไม่
        if (document.getElementById('bookingHistoryOverlay')) return;

        const overlayHTML = `
            <div id="historyBackdrop" class="history-backdrop"></div>
            <div id="bookingHistoryOverlay" class="booking-history-overlay">
                <div class="history-panel">
                    <div class="history-header">
                        <h3>ประวัติการจอง</h3>
                        <button id="closeHistoryBtn" class="close-history-btn">×</button>
                    </div>
                    <div class="history-content" id="historyContent">
                        <div class="loading-spinner">กำลังโหลด...</div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        this.addHistoryStyles();
        this.setupOverlayEvents();
    }

    // เพิ่ม CSS สำหรับ overlay
    addHistoryStyles() {
        if (document.getElementById('bookingHistoryStyles')) return;

        const styles = `
            <style id="bookingHistoryStyles">
                .booking-history-overlay {
                    position: fixed;
                    top: 0;
                    right: -400px;
                    width: 400px;
                    height: 100vh;
                    z-index: 9998;
                    transition: right 0.3s ease-in-out;
                    pointer-events: none;
                }

                .booking-history-overlay.show {
                    right: 0;
                    pointer-events: all;
                }

                .history-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.2);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                    z-index: 9997;
                }

                .history-backdrop.show {
                    opacity: 1;
                    visibility: visible;
                }

                .booking-history-overlay.show .history-backdrop {
                    opacity: 1;
                }

                .history-panel {
                    position: fixed;
                    top: 0;
                    right: 0;
                    width: 400px;
                    height: 100vh;
                    background: white;
                    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
                    transform: translateX(100%);
                    transition: transform 0.3s ease-in-out;
                    overflow-y: auto;
                    z-index: 9999;
                }

                .booking-history-overlay.show .history-panel {
                    transform: translateX(0);
                }

                .history-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #f8f9fa;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .history-header h3 {
                    margin: 0;
                    color: #333;
                    font-size: 18px;
                    font-weight: 600;
                }

                .close-history-btn {
                    background: transparent;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background 0.2s;
                }

                .close-history-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                }

                .history-content {
                    padding: 20px;
                }

                .loading-spinner {
                    text-align: center;
                    color: #666;
                    padding: 40px 0;
                }

                .booking-item {
                    background: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 12px;
                    transition: all 0.3s ease;
                    position: relative;
                    cursor: pointer;
                }

                .booking-item:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    transform: translateY(-2px);
                    border-color: #1976d2;
                }

                .booking-item::after {
                    content: '👆 คลิกเพื่อดูรายละเอียด';
                    position: absolute;
                    bottom: 8px;
                    right: 12px;
                    font-size: 10px;
                    color: #1976d2;
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                }

                .booking-item:hover::after {
                    opacity: 1;
                }

                .booking-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .booking-time-ago {
                    font-size: 11px;
                    color: #999;
                }

                .booking-stadium {
                    font-weight: 600;
                    color: #1976d2;
                    font-size: 16px;
                    margin-bottom: 8px;
                    line-height: 1.2;
                }

                .booking-details {
                    margin: 8px 0;
                }

                .booking-date {
                    color: #333;
                    font-size: 14px;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .booking-time {
                    color: #666;
                    font-size: 13px;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .booking-location {
                    color: #666;
                    font-size: 13px;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .booking-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                    padding-top: 8px;
                    border-top: 1px solid #e0e0e0;
                }

                .booking-price {
                    color: #2e7d32;
                    font-weight: 600;
                    font-size: 15px;
                }

                .booking-duration {
                    color: #666;
                    font-size: 12px;
                }

                .history-summary {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 20px;
                    padding: 16px;
                    background: linear-gradient(135deg, #1976d2, #42a5f5);
                    border-radius: 8px;
                    color: white;
                }

                .summary-item {
                    text-align: center;
                    flex: 1;
                }

                .summary-number {
                    display: block;
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 4px;
                }

                .summary-label {
                    font-size: 12px;
                    opacity: 0.9;
                }

                .no-bookings {
                    text-align: center;
                    color: #666;
                    padding: 40px 20px;
                    font-style: italic;
                }

                .no-bookings div:first-child {
                    font-style: normal;
                }

                .no-bookings div:last-child {
                    font-style: normal;
                }

                .booking-status {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                .status-confirmed {
                    background: #d4edda;
                    color: #155724;
                }

                .status-pending {
                    background: #10f545ff;
                    color: #ffffffff;
                }

                .status-cancelled {
                    background: #f8d7da;
                    color: #721c24;
                }

                /* Cancelled bookings styles */
                .cancelled-section {
                    margin-top: 20px;
                }

                .cancelled-item {
                    background: #fafafa;
                    border: 1px solid #e0e0e0;
                    border-left: 4px solid #d32f2f;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 12px;
                    transition: all 0.3s ease;
                    position: relative;
                    opacity: 0.9;
                }

                .cancelled-item:hover {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    opacity: 1;
                }

                .refund-status {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                .status-processing {
                    background: #fff3cd;
                    color: #856404;
                }

                .status-completed {
                    background: #d1f2eb;
                    color: #00695c;
                }

                .status-rejected {
                    background: #f8d7da;
                    color: #721c24;
                }

                .status-unknown {
                    background: #e2e3e5;
                    color: #495057;
                }

                .active-bookings-section {
                    margin-bottom: 20px;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .history-panel {
                        width: 100%;
                    }
                }

                /* Arrow button styles */
                .history-arrow-btn {
                    position: fixed !important;
                    top: 50% !important;
                    right: 20px !important;
                    transform: translateY(-50%) !important;
                    width: 50px !important;
                    height: 50px !important;
                    background: rgba(255, 255, 255, 0.9) !important;
                    border: 2px solid #1976d2 !important;
                    border-radius: 50% !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 20px !important;
                    color: #1976d2 !important;
                    z-index: 1000 !important;
                    transition: all 0.3s ease !important;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
                    font-family: Arial, sans-serif !important;
                }

                .history-arrow-btn:hover {
                    background: #1976d2 !important;
                    color: white !important;
                    transform: translateY(-50%) scale(1.1) !important;
                }

                .history-arrow-btn.active {
                    background: #1976d2 !important;
                    color: white !important;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // สร้างปุ่มลูกศรสำหรับเปิด overlay
    setupArrowButton() {
        console.log('BookingHistory: Setting up arrow button...'); // Debug log
        
        // ลบปุ่มเก่าหากมี
        const existingBtn = document.getElementById('historyArrowBtn');
        if (existingBtn) {
            console.log('BookingHistory: Removing existing arrow button'); // Debug log
            existingBtn.remove();
        }

        // รอให้ DOM พร้อม
        const createButton = () => {
            const arrowBtn = document.createElement('button');
            arrowBtn.id = 'historyArrowBtn';
            arrowBtn.className = 'history-arrow-btn';
            arrowBtn.innerHTML = '◀';
            arrowBtn.title = 'ดูประวัติการจอง';
            
            // เพิ่ม inline styles เพื่อให้แน่ใจ
            arrowBtn.style.cssText = `
                position: fixed !important;
                top: 50% !important;
                right: 20px !important;
                transform: translateY(-50%) !important;
                width: 50px !important;
                height: 50px !important;
                background: rgba(255, 255, 255, 0.9) !important;
                border: 2px solid #1976d2 !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 20px !important;
                color: #1976d2 !important;
                z-index: 10000 !important;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
                font-family: Arial, sans-serif !important;
            `;

            document.body.appendChild(arrowBtn);
            console.log('BookingHistory: Arrow button created and added to body'); // Debug log

            arrowBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('BookingHistory: Arrow button clicked'); // Debug log
                this.toggleHistoryOverlay();
            });
            
            // ทดสอบ hover effect
            arrowBtn.addEventListener('mouseover', () => {
                arrowBtn.style.background = '#1976d2 !important';
                arrowBtn.style.color = 'white !important';
            });
            
            arrowBtn.addEventListener('mouseout', () => {
                if (!arrowBtn.classList.contains('active')) {
                    arrowBtn.style.background = 'rgba(255, 255, 255, 0.9) !important';
                    arrowBtn.style.color = '#1976d2 !important';
                }
            });
        };

        // สร้างปุ่มทันที
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createButton);
        } else {
            createButton();
        }
    }

    // ตั้งค่า event listeners สำหรับ overlay
    setupOverlayEvents() {
        const closeBtn = document.getElementById('closeHistoryBtn');
        const backdrop = document.getElementById('historyBackdrop');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideHistoryOverlay();
            });
        }

        if (backdrop) {
            backdrop.addEventListener('click', () => {
                this.hideHistoryOverlay();
            });
        }

        // ปิด overlay เมื่อกด ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlayVisible) {
                this.hideHistoryOverlay();
            }
        });
    }

    // เปิด/ปิด overlay
    toggleHistoryOverlay() {
        if (this.overlayVisible) {
            this.hideHistoryOverlay();
        } else {
            this.showHistoryOverlay();
        }
    }

    // แสดง overlay
    async showHistoryOverlay() {
        const overlay = document.getElementById('bookingHistoryOverlay');
        const backdrop = document.getElementById('historyBackdrop');
        const arrowBtn = document.getElementById('historyArrowBtn');
        
        if (overlay && backdrop) {
            backdrop.classList.add('show');
            overlay.classList.add('show');
            this.overlayVisible = true;
            
            if (arrowBtn) {
                arrowBtn.innerHTML = '▶';
                arrowBtn.classList.add('active');
            }

            // โหลดข้อมูลประวัติการจอง
            await this.loadBookingHistory();
        }
    }

    // ซ่อน overlay
    hideHistoryOverlay() {
        const overlay = document.getElementById('bookingHistoryOverlay');
        const backdrop = document.getElementById('historyBackdrop');
        const arrowBtn = document.getElementById('historyArrowBtn');
        
        if (overlay && backdrop) {
            backdrop.classList.remove('show');
            overlay.classList.remove('show');
            this.overlayVisible = false;
            
            if (arrowBtn) {
                arrowBtn.innerHTML = '◀';
                arrowBtn.classList.remove('active');
            }
        }
    }

    // โหลดประวัติการจองจากฐานข้อมูล
    async loadBookingHistory() {
        if (!this.currentUser) {
            this.displayNoUser();
            return;
        }

        this.displayLoading();

        try {
            // ดึงข้อมูลจาก table bookings
            const { data: bookings, error } = await this.supabase
                .from('bookings')
                .select(`
                    id,
                    stadium_name,
                    booking_date,
                    start_time,
                    end_time,
                    total_price,
                    status,
                    created_at
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            console.log('Loaded bookings:', bookings); // Debug log

            this.bookingData = bookings || [];
            await this.displayBookingHistory();

        } catch (error) {
            console.error('Error loading booking history:', error);
            this.displayError(error.message);
        }
    }

    // แสดงสถานะกำลังโหลด
    displayLoading() {
        const content = document.getElementById('historyContent');
        if (content) {
            content.innerHTML = '<div class="loading-spinner">กำลังโหลดประวัติการจอง...</div>';
        }
    }

    // แสดงข้อความเมื่อไม่มีผู้ใช้
    displayNoUser() {
        const content = document.getElementById('historyContent');
        if (content) {
            content.innerHTML = '<div class="no-bookings">กรุณาเข้าสู่ระบบเพื่อดูประวัติการจอง</div>';
        }
    }

    // แสดงข้อผิดพลาด
    displayError(message) {
        const content = document.getElementById('historyContent');
        if (content) {
            content.innerHTML = `<div class="no-bookings">เกิดข้อผิดพลาด: ${message}</div>`;
        }
    }

    // แสดงประวัติการจอง
    async displayBookingHistory() {
        const content = document.getElementById('historyContent');
        if (!content) return;

        // โหลดข้อมูลการยกเลิกการจอง
        const cancelledHTML = await this.displayCancelledBookings();

        if (!this.bookingData || this.bookingData.length === 0) {
            if (cancelledHTML) {
                // แสดงเฉพาะประวัติการยกเลิก
                content.innerHTML = `
                    <div class="history-summary">
                        <div class="summary-item">
                            <span class="summary-number">0</span>
                            <span class="summary-label">การจองปัจจุบัน</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-number">0</span>
                            <span class="summary-label">บาท</span>
                        </div>
                    </div>
                    ${cancelledHTML}
                `;
            } else {
                content.innerHTML = `
                    <div class="no-bookings">
                        <div style="font-size: 48px; margin-bottom: 10px;">📅</div>
                        <div>ยังไม่มีประวัติการจอง</div>
                        <div style="font-size: 12px; color: #999; margin-top: 8px;">
                            เมื่อคุณทำการจองสนาม ประวัติจะแสดงที่นี่
                        </div>
                    </div>
                `;
            }
            return;
        }

        let historyHTML = `
            <div class="history-summary">
                <div class="summary-item">
                    <span class="summary-number">${this.bookingData.length}</span>
                    <span class="summary-label">การจองปัจจุบัน</span>
                </div>
                <div class="summary-item">
                    <span class="summary-number">${this.getTotalSpent()}</span>
                    <span class="summary-label">บาท</span>
                </div>
            </div>
        `;

        // แสดงการจองปัจจุบัน
        historyHTML += `
            <div class="active-bookings-section">
                <h4 style="color: #1976d2; margin: 20px 0 12px 0; font-size: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">
                    🎯 การจองปัจจุบัน (${this.bookingData.length} รายการ)
                </h4>
        `;

        this.bookingData.forEach((booking, index) => {
            const bookingDate = new Date(booking.booking_date);
            const formattedDate = bookingDate.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });

            const createdDate = new Date(booking.created_at);
            const timeDiff = this.getTimeAgo(createdDate);

            const statusClass = this.getStatusClass(booking.status || 'confirmed');
            const statusText = this.getStatusText(booking.status || 'confirmed');

            historyHTML += `
                <div class="booking-item" data-booking-id="${booking.id}">
                    <div class="booking-header">
                        <div class="booking-status ${statusClass}">${statusText}</div>
                        <div class="booking-time-ago">${timeDiff}</div>
                    </div>
                    
                    <div class="booking-stadium">${booking.stadium_name || 'ไม่ระบุสนาม'}</div>
                    
                    <div class="booking-details">
                        <div class="booking-date">
                            📅 ${formattedDate}
                        </div>
                        <div class="booking-time">
                            🕐 ${this.formatTime(booking.start_time)} - ${this.formatTime(booking.end_time)}
                        </div>
                    </div>
                    
                    <div class="booking-footer">
                        <div class="booking-price">
                            💰 ${this.formatPrice(booking.total_price || 0)} บาท
                        </div>
                        <div class="booking-duration">
                            ⏱️ ${this.calculateDuration(booking.start_time, booking.end_time)}
                        </div>
                    </div>
                </div>
            `;
        });

        historyHTML += '</div>';

        // เพิ่มประวัติการยกเลิก
        if (cancelledHTML) {
            historyHTML += cancelledHTML;
        }

        content.innerHTML = historyHTML;
        
        // เพิ่ม event listeners สำหรับการคลิกที่รายการจอง
        this.setupBookingItemClickListeners();
    }

    // ตั้งค่า event listeners สำหรับคลิกรายการจอง
    setupBookingItemClickListeners() {
        const bookingItems = document.querySelectorAll('.booking-item');
        bookingItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const bookingId = item.getAttribute('data-booking-id');
                const booking = this.bookingData.find(b => b.id === bookingId);
                if (booking) {
                    this.showBookingDetailOverlay(booking);
                }
            });
        });
    }

    // แสดง overlay รายละเอียดการจอง
    showBookingDetailOverlay(booking) {
        // ลบ overlay เดิมหากมี
        const existingOverlay = document.getElementById('bookingDetailOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const bookingDate = new Date(booking.booking_date);
        const formattedDate = bookingDate.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        const statusClass = this.getStatusClass(booking.status || 'confirmed');
        const statusText = this.getStatusText(booking.status || 'confirmed');
        const canCancel = this.canCancelBooking(booking);

        const overlayHTML = `
            <div id="bookingDetailOverlay" class="booking-detail-overlay">
                <div class="booking-detail-backdrop"></div>
                <div class="booking-detail-modal">
                    <div class="booking-detail-header">
                        <h3>รายละเอียดการจอง</h3>
                        <button class="close-detail-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                    </div>
                    
                    <div class="booking-detail-content">
                        <div class="booking-id-section">
                            <strong>รหัสการจอง:</strong> ${booking.id}
                        </div>
                        
                        <div class="status-badge-large ${statusClass}">
                            ${statusText}
                        </div>
                        
                        <div class="detail-section">
                            <h4>ข้อมูลสนาม</h4>
                            <div class="detail-item">
                                <span class="detail-label">🏟️ ชื่อสนาม:</span>
                                <span class="detail-value">${booking.stadium_name || 'ไม่ระบุ'}</span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>วันที่และเวลา</h4>
                            <div class="detail-item">
                                <span class="detail-label">📅 วันที่:</span>
                                <span class="detail-value">${formattedDate}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">🕐 เวลา:</span>
                                <span class="detail-value">${this.formatTime(booking.start_time)} - ${this.formatTime(booking.end_time)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">⏱️ ระยะเวลา:</span>
                                <span class="detail-value">${this.calculateDuration(booking.start_time, booking.end_time)}</span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>ข้อมูลราคา</h4>
                            <div class="detail-item">
                                <span class="detail-label">💰 ราคารวม:</span>
                                <span class="detail-value price-highlight">${this.formatPrice(booking.total_price || 0)} บาท</span>
                            </div>
                        </div>
                        
                        <div class="booking-actions">
                            ${canCancel ? `
                                <button class="cancel-booking-btn" onclick="bookingHistory.showCancelConfirmation('${booking.id}')">
                                    🗑️ ยกเลิกการจอง
                                </button>
                            ` : `
                                <div class="cancel-disabled-message">
                                    ไม่สามารถยกเลิกการจองได้
                                </div>
                            `}
                            <button class="close-detail-action-btn" onclick="document.getElementById('bookingDetailOverlay').remove()">
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        this.addBookingDetailStyles();
        
        // เพิ่ม event listener สำหรับปิด modal เมื่อคลิกข้างนอก
        const backdrop = document.querySelector('#bookingDetailOverlay .booking-detail-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                document.getElementById('bookingDetailOverlay').remove();
            });
        }
    }

    // เช็คว่าสามารถยกเลิกการจองได้หรือไม่
    canCancelBooking(booking) {
        // ไม่สามารถยกเลิกได้หากสถานะเป็น cancelled แล้ว
        const status = (booking.status || 'confirmed').toLowerCase();
        if (status.includes('cancel')) {
            return false;
        }
        
        // ไม่สามารถยกเลิกได้หากวันที่จองผ่านไปแล้ว
        const bookingDate = new Date(booking.booking_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);
        
        if (bookingDate < today) {
            return false;
        }
        
        return true;
    }

    // แสดง confirmation dialog สำหรับยกเลิกการจอง
    showCancelConfirmation(bookingId) {
        const booking = this.bookingData.find(b => b.id === bookingId);
        if (!booking) return;

        const confirmationHTML = `
            <div id="cancelConfirmationOverlay" class="cancel-confirmation-overlay">
                <div class="cancel-confirmation-backdrop"></div>
                <div class="cancel-confirmation-modal">
                    <div class="confirmation-header">
                        <h3>⚠️ ยืนยันการยกเลิก</h3>
                    </div>
                    
                    <div class="confirmation-content">
                        <p>คุณแน่ใจหรือไม่ที่จะยกเลิกการจอง?</p>
                        
                        <div class="cancel-booking-info">
                            <div><strong>สนาม:</strong> ${booking.stadium_name}</div>
                            <div><strong>วันที่:</strong> ${new Date(booking.booking_date).toLocaleDateString('th-TH')}</div>
                            <div><strong>เวลา:</strong> ${this.formatTime(booking.start_time)} - ${this.formatTime(booking.end_time)}</div>
                            <div><strong>ราคา:</strong> ${this.formatPrice(booking.total_price || 0)} บาท</div>
                        </div>
                        
                        <div class="warning-message">
                            ⚠️ ระบบจะทำการตรวจสอบและคืนเงินตามนโยบายการยกเลิกการจอง
                        </div>
                        
                        <div class="confirmation-actions">
                            <button class="confirm-cancel-btn" onclick="bookingHistory.cancelBooking('${bookingId}')">
                                ยืนยันยกเลิก
                            </button>
                            <button class="keep-booking-btn" onclick="document.getElementById('cancelConfirmationOverlay').remove()">
                                เก็บการจองไว้
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', confirmationHTML);
        this.addCancelConfirmationStyles();
        
        // เพิ่ม event listener สำหรับปิด modal เมื่อคลิกข้างนอก
        const backdrop = document.querySelector('#cancelConfirmationOverlay .cancel-confirmation-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                document.getElementById('cancelConfirmationOverlay').remove();
            });
        }
    }

    // แปลงสถานะเป็น CSS class
    getStatusClass(status) {
        if (!status) return 'status-confirmed';
        
        const statusLower = status.toLowerCase();
        
        if (statusLower.includes('confirm') || statusLower.includes('paid') || statusLower.includes('success')) {
            return 'status-confirmed';
        } else if (statusLower.includes('pending') || statusLower.includes('wait')) {
            return 'status-pending';
        } else if (statusLower.includes('cancel') || statusLower.includes('reject') || statusLower.includes('fail')) {
            return 'status-cancelled';
        } else {
            return 'status-confirmed';
        }
    }

    // แปลงสถานะเป็นข้อความภาษาไทย
    getStatusText(status) {
        if (!status) return 'ยืนยันแล้ว';
        
        const statusLower = status.toLowerCase();
        
        if (statusLower.includes('confirm')) {
            return 'ยืนยันแล้ว';
        } else if (statusLower.includes('paid') || statusLower.includes('success')) {
            return 'ชำระแล้ว';
        } else if (statusLower.includes('pending')) {
            return 'จองสำเร็จ';
        } else if (statusLower.includes('wait')) {
            return 'รอการชำระ';
        } else if (statusLower.includes('cancel')) {
            return 'ยกเลิกแล้ว';
        } else if (statusLower.includes('reject')) {
            return 'ถูกปฏิเสธ';
        } else if (statusLower.includes('fail')) {
            return 'ล้มเหลว';
        } else {
            return status; // แสดงสถานะเดิมหากไม่รู้จัก
        }
    }

    // จัดรูปแบบราคา
    formatPrice(price) {
        return new Intl.NumberFormat('th-TH').format(price);
    }

    // จัดรูปแบบเวลา
    formatTime(timeString) {
        if (!timeString) return 'ไม่ระบุ';
        
        // แปลงจาก HH:MM:SS หรือ HH:MM เป็น HH:MM
        const timeParts = timeString.split(':');
        if (timeParts.length >= 2) {
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return timeString;
    }

    // คำนวณระยะเวลาการจอง
    calculateDuration(startTime, endTime) {
        if (!startTime || !endTime) return 'ไม่ระบุ';
        
        const start = new Date(`2024-01-01 ${startTime}`);
        const end = new Date(`2024-01-01 ${endTime}`);
        
        const diffMs = end - start;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours === 1) {
            return '1 ชั่วโมง';
        } else if (diffHours < 1) {
            const diffMinutes = Math.round(diffMs / (1000 * 60));
            return `${diffMinutes} นาที`;
        } else {
            return `${diffHours} ชั่วโมง`;
        }
    }

    // คำนวณเวลาที่ผ่านมา
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                return diffMinutes <= 1 ? 'เมื่อสักครู่' : `${diffMinutes} นาทีที่แล้ว`;
            }
            return diffHours === 1 ? '1 ชั่วโมงที่แล้ว' : `${diffHours} ชั่วโมงที่แล้ว`;
        } else if (diffDays === 1) {
            return 'เมื่อวาน';
        } else if (diffDays < 7) {
            return `${diffDays} วันที่แล้ว`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? '1 สัปดาห์ที่แล้ว' : `${weeks} สัปดาห์ที่แล้ว`;
        } else {
            const months = Math.floor(diffDays / 30);
            return months === 1 ? '1 เดือนที่แล้ว' : `${months} เดือนที่แล้ว`;
        }
    }

    // คำนวณยอดเงินทั้งหมด
    getTotalSpent() {
        if (!this.bookingData || this.bookingData.length === 0) return '0';
        
        const total = this.bookingData.reduce((sum, booking) => {
            return sum + (booking.total_price || 0);
        }, 0);
        
        return this.formatPrice(total);
    }

    // รีเฟรชข้อมูลประวัติการจอง
    async refreshHistory() {
        if (this.overlayVisible) {
            await this.loadBookingHistory();
        }
    }

    // ตรวจสอบว่า Table cancel_reservation มีอยู่หรือไม่
    async checkCancelReservationTable() {
        try {
            const { data, error } = await this.supabase
                .from('cancel_reservation')
                .select('id')
                .limit(1);
            
            if (error && error.message.includes('does not exist')) {
                console.error('Table cancel_reservation does not exist. Please run create-cancel-reservation-table.sql first.');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error checking cancel_reservation table:', error);
            return false;
        }
    }

    // ยกเลิกการจอง
    async cancelBooking(bookingId) {
        try {
            // แสดงการโหลด
            const confirmBtn = document.querySelector('.confirm-cancel-btn');
            if (confirmBtn) {
                confirmBtn.innerHTML = 'กำลังยกเลิก...';
                confirmBtn.disabled = true;
            }

            console.log('Starting cancellation process for booking:', bookingId); // Debug log

            // ตรวจสอบ Table cancel_reservation
            const tableExists = await this.checkCancelReservationTable();
            if (!tableExists) {
                throw new Error('ระบบการยกเลิกการจองยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
            }

            // 1. ดึงข้อมูลการจองที่จะยกเลิก
            const { data: bookingData, error: fetchError } = await this.supabase
                .from('bookings')
                .select(`
                    id,
                    user_id,
                    stadium_name,
                    stadium_address,
                    booker_name,
                    booker_phone,
                    booker_email,
                    booking_date,
                    start_time,
                    end_time,
                    duration,
                    price_per_hour,
                    total_price,
                    payment_slip_url,
                    payment_slip_filename,
                    admin_notes,
                    notes,
                    status,
                    created_at,
                    updated_at
                `)
                .eq('id', bookingId)
                .eq('user_id', this.currentUser.id)
                .single();

            if (fetchError) {
                console.error('Fetch error:', fetchError); // Debug log
                throw new Error('ไม่พบข้อมูลการจอง: ' + fetchError.message);
            }

            if (!bookingData) {
                console.error('No booking data found for ID:', bookingId); // Debug log
                throw new Error('ไม่พบข้อมูลการจองที่ต้องการยกเลิก');
            }

            console.log('Retrieved booking data:', bookingData); // Debug log

            // 2. บันทึกข้อมูลการจองไปยัง cancel_reservation
            const cancelData = {
                original_booking_id: bookingData.id,
                user_id: bookingData.user_id,
                stadium_name: bookingData.stadium_name || 'ไม่ระบุสนาม',
                stadium_address: bookingData.stadium_address || null,
                booker_name: bookingData.booker_name || 'ไม่ระบุชื่อ',
                booker_phone: bookingData.booker_phone || 'ไม่ระบุเบอร์',
                booker_email: bookingData.booker_email || null,
                booking_date: bookingData.booking_date,
                start_time: bookingData.start_time,
                end_time: bookingData.end_time,
                duration: bookingData.duration || null,
                price_per_hour: bookingData.price_per_hour || null,
                total_price: bookingData.total_price || 0,
                payment_slip_url: bookingData.payment_slip_url || null,
                payment_slip_filename: bookingData.payment_slip_filename || null,
                admin_notes: bookingData.admin_notes || null,
                notes: bookingData.notes || null,
                cancelled_by: this.currentUser.id,
                cancellation_reason: 'ยกเลิกโดยผู้ใช้',
                refund_status: 'pending',
                refund_amount: bookingData.total_price || 0
            };

            console.log('Preparing cancel data:', cancelData); // Debug log

            const { error: insertError } = await this.supabase
                .from('cancel_reservation')
                .insert([cancelData]);

            if (insertError) {
                console.error('Insert error:', insertError); // Debug log
                console.error('Cancel data that failed:', cancelData); // Debug log
                throw new Error('ไม่สามารถบันทึกข้อมูลการยกเลิกได้: ' + insertError.message);
            }

            console.log('Successfully inserted cancellation data'); // Debug log

            // 3. ลบข้อมูลจากตาราง bookings (ระบบเดิม)
            const { error: deleteError } = await this.supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId)
                .eq('user_id', this.currentUser.id);

            if (deleteError) {
                console.error('Delete error:', deleteError); // Debug log
                throw new Error('ไม่สามารถลบข้อมูลการจองได้: ' + deleteError.message);
            }

            console.log('Successfully deleted booking from bookings table'); // Debug log

            // ปิด confirmation overlay
            const cancelOverlay = document.getElementById('cancelConfirmationOverlay');
            if (cancelOverlay) {
                cancelOverlay.remove();
            }

            // ปิด detail overlay
            const detailOverlay = document.getElementById('bookingDetailOverlay');
            if (detailOverlay) {
                detailOverlay.remove();
            }

            // แสดงข้อความสำเร็จพร้อมข้อมูลการคืนเงิน
            this.showSuccessMessage(
                `ยกเลิกการจองเรียบร้อยแล้ว<br>
                <small>ข้อมูลการยกเลิกถูกบันทึกเพื่อรอการคืนเงิน จำนวน ${this.formatPrice(bookingData.total_price)} บาท</small>`
            );

            // รีโหลดประวัติการจอง
            await this.loadBookingHistory();

        } catch (error) {
            console.error('Error cancelling booking:', error);
            console.error('Current user:', this.currentUser);
            console.error('Booking ID:', bookingId);
            
            // แสดงข้อความแปลงจากภาษาอังกฤษเป็นไทย
            let errorMessage = error.message;
            if (errorMessage.includes('null value in column')) {
                errorMessage = 'ข้อมูลการจองไม่สมบูรณ์ ไม่สามารถยกเลิกได้';
            } else if (errorMessage.includes('violates not-null constraint')) {
                errorMessage = 'ข้อมูลการจองมีปัญหา กรุณาติดต่อผู้ดูแลระบบ';
            } else if (errorMessage.includes('does not exist')) {
                errorMessage = 'ไม่พบข้อมูลการจอง';
            }
            
            this.showErrorMessage('เกิดข้อผิดพลาดในการยกเลิกการจอง: ' + errorMessage);

            // เปิดปุ่มใหม่
            const confirmBtn = document.querySelector('.confirm-cancel-btn');
            if (confirmBtn) {
                confirmBtn.innerHTML = 'ยืนยันยกเลิก';
                confirmBtn.disabled = false;
            }
        }
    }

    // แสดงข้อความสำเร็จ
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    // แสดงข้อความผิดพลาด
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    // แสดงข้อความ
    showMessage(message, type = 'info') {
        // ลบข้อความเก่าหากมี
        const existingMessage = document.getElementById('bookingMessage');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageHTML = `
            <div id="bookingMessage" class="booking-message ${type}">
                <div class="message-content">
                    <span class="message-icon">
                        ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                    </span>
                    <span class="message-text">${message}</span>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', messageHTML);
        this.addMessageStyles();

        // ลบข้อความอัตโนมัติหลัง 3 วินาที
        setTimeout(() => {
            const msgEl = document.getElementById('bookingMessage');
            if (msgEl) {
                msgEl.classList.add('fade-out');
                setTimeout(() => msgEl.remove(), 300);
            }
        }, 3000);
    }

    // เพิ่ม CSS styles สำหรับ booking detail overlay
    addBookingDetailStyles() {
        if (document.getElementById('bookingDetailStyles')) return;

        const styles = `
            <style id="bookingDetailStyles">
                .booking-detail-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .booking-detail-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1;
                }

                .booking-detail-modal {
                    position: relative;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    z-index: 2;
                    animation: modalFadeIn 0.3s ease-out;
                }

                @keyframes modalFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .booking-detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #f8f9fa;
                    border-radius: 12px 12px 0 0;
                }

                .booking-detail-header h3 {
                    margin: 0;
                    color: #333;
                    font-size: 18px;
                    font-weight: 600;
                }

                .close-detail-btn {
                    background: transparent;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background 0.2s;
                }

                .close-detail-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                }

                .booking-detail-content {
                    padding: 24px;
                }

                .booking-id-section {
                    background: #f0f0f0;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-family: monospace;
                    font-size: 14px;
                    color: #666;
                }

                .status-badge-large {
                    display: inline-block;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 20px;
                    text-align: center;
                }

                .detail-section {
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #f0f0f0;
                }

                .detail-section:last-of-type {
                    border-bottom: none;
                }

                .detail-section h4 {
                    margin: 0 0 12px 0;
                    color: #333;
                    font-size: 16px;
                    font-weight: 600;
                }

                .detail-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    padding: 8px 0;
                }

                .detail-item:last-child {
                    margin-bottom: 0;
                }

                .detail-label {
                    color: #666;
                    font-size: 14px;
                    min-width: 120px;
                }

                .detail-value {
                    color: #333;
                    font-size: 14px;
                    font-weight: 500;
                    text-align: right;
                    flex: 1;
                }

                .price-highlight {
                    color: #2e7d32;
                    font-weight: 600;
                    font-size: 16px;
                }

                .booking-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid #e0e0e0;
                }

                .cancel-booking-btn {
                    flex: 1;
                    padding: 12px 20px;
                    background: #d32f2f;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .cancel-booking-btn:hover {
                    background: #b71c1c;
                }

                .close-detail-action-btn {
                    flex: 1;
                    padding: 12px 20px;
                    background: #666;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .close-detail-action-btn:hover {
                    background: #555;
                }

                .cancel-disabled-message {
                    flex: 1;
                    padding: 12px 20px;
                    background: #f5f5f5;
                    color: #999;
                    border-radius: 8px;
                    font-size: 14px;
                    text-align: center;
                    font-style: italic;
                }

                .booking-item {
                    cursor: pointer;
                }

                .booking-item:hover {
                    transform: translateY(-1px);
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // เพิ่ม CSS styles สำหรับ cancel confirmation
    addCancelConfirmationStyles() {
        if (document.getElementById('cancelConfirmationStyles')) return;

        const styles = `
            <style id="cancelConfirmationStyles">
                .cancel-confirmation-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 10002;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .cancel-confirmation-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 1;
                }

                .cancel-confirmation-modal {
                    position: relative;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    max-width: 450px;
                    width: 90%;
                    z-index: 2;
                    animation: modalFadeIn 0.3s ease-out;
                }

                .confirmation-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #fff3cd;
                    border-radius: 12px 12px 0 0;
                }

                .confirmation-header h3 {
                    margin: 0;
                    color: #856404;
                    font-size: 18px;
                    font-weight: 600;
                }

                .confirmation-content {
                    padding: 24px;
                }

                .confirmation-content p {
                    margin: 0 0 16px 0;
                    color: #333;
                    font-size: 16px;
                    text-align: center;
                }

                .cancel-booking-info {
                    background: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 16px;
                    margin: 16px 0;
                }

                .cancel-booking-info > div {
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #333;
                }

                .cancel-booking-info > div:last-child {
                    margin-bottom: 0;
                }

                .warning-message {
                    background: #f8d7da;
                    color: #721c24;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin: 16px 0;
                    font-size: 14px;
                    text-align: center;
                }

                .confirmation-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }

                .confirm-cancel-btn {
                    flex: 1;
                    padding: 12px 20px;
                    background: #d32f2f;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .confirm-cancel-btn:hover {
                    background: #b71c1c;
                }

                .confirm-cancel-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }

                .keep-booking-btn {
                    flex: 1;
                    padding: 12px 20px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .keep-booking-btn:hover {
                    background: #218838;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // เพิ่ม CSS styles สำหรับข้อความ
    addMessageStyles() {
        if (document.getElementById('messageStyles')) return;

        const styles = `
            <style id="messageStyles">
                .booking-message {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10003;
                    min-width: 300px;
                    max-width: 400px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    animation: slideInRight 0.3s ease-out;
                }

                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .booking-message.fade-out {
                    animation: slideOutRight 0.3s ease-in;
                }

                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }

                .booking-message.success {
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                    color: #155724;
                }

                .booking-message.error {
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                }

                .booking-message.info {
                    background: #d1ecf1;
                    border: 1px solid #bee5eb;
                    color: #0c5460;
                }

                .message-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 20px;
                }

                .message-icon {
                    font-size: 18px;
                }

                .message-text {
                    font-size: 14px;
                    font-weight: 500;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // โหลดประวัติการยกเลิกการจอง
    async loadCancelledBookings() {
        if (!this.currentUser) {
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('cancel_reservation')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('cancelled_at', { ascending: false });

            if (error) {
                console.error('Error loading cancelled bookings:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error loading cancelled bookings:', error);
            return [];
        }
    }

    // แสดงประวัติการยกเลิกในส่วนของ history content
    async displayCancelledBookings() {
        const cancelledData = await this.loadCancelledBookings();
        
        if (cancelledData.length === 0) {
            return '';
        }

        let cancelledHTML = `
            <div class="cancelled-section">
                <h4 style="color: #d32f2f; margin: 20px 0 12px 0; font-size: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">
                    📋 การยกเลิกการจอง (${cancelledData.length} รายการ)
                </h4>
        `;

        cancelledData.forEach((cancelled, index) => {
            const cancelledDate = new Date(cancelled.cancelled_at);
            const bookingDate = new Date(cancelled.booking_date);
            const timeAgo = this.getTimeAgo(cancelledDate);
            const formattedBookingDate = bookingDate.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const refundStatusText = this.getRefundStatusText(cancelled.refund_status);
            const refundStatusClass = this.getRefundStatusClass(cancelled.refund_status);

            cancelledHTML += `
                <div class="cancelled-item" data-cancelled-id="${cancelled.id}">
                    <div class="booking-header">
                        <span class="refund-status ${refundStatusClass}">${refundStatusText}</span>
                        <span class="booking-time-ago">${timeAgo}</span>
                    </div>
                    <div class="booking-stadium">${cancelled.stadium_name}</div>
                    <div class="booking-details">
                        <div class="booking-date">📅 ${formattedBookingDate}</div>
                        <div class="booking-time">⏰ ${this.formatTime(cancelled.start_time)} - ${this.formatTime(cancelled.end_time)}</div>
                        <div class="booking-location">📍 ${cancelled.stadium_address || 'ไม่ระบุที่อยู่'}</div>
                    </div>
                    <div class="booking-footer">
                        <span class="booking-price">คืนเงิน: ${this.formatPrice(cancelled.refund_amount || cancelled.total_price)}</span>
                        <span class="booking-duration">${this.calculateDuration(cancelled.start_time, cancelled.end_time)}</span>
                    </div>
                </div>
            `;
        });

        cancelledHTML += '</div>';
        return cancelledHTML;
    }

    // แปลงสถานะการคืนเงินเป็นข้อความภาษาไทย
    getRefundStatusText(status) {
        switch (status) {
            case 'pending':
                return 'รอการคืนเงิน';
            case 'processing':
                return 'กำลังดำเนินการ';
            case 'completed':
                return 'คืนเงินแล้ว';
            case 'rejected':
                return 'ปฏิเสธการคืนเงิน';
            default:
                return 'ไม่ทราบสถานะ';
        }
    }

    // แปลงสถานะการคืนเงินเป็น CSS class
    getRefundStatusClass(status) {
        switch (status) {
            case 'pending':
                return 'status-pending';
            case 'processing':
                return 'status-processing';
            case 'completed':
                return 'status-completed';
            case 'rejected':
                return 'status-rejected';
            default:
                return 'status-unknown';
        }
    }

    // ลบ overlay (สำหรับการทำความสะอาด)
    destroy() {
        const overlay = document.getElementById('bookingHistoryOverlay');
        const arrowBtn = document.getElementById('historyArrowBtn');
        const styles = document.getElementById('bookingHistoryStyles');
        const detailStyles = document.getElementById('bookingDetailStyles');
        const confirmationStyles = document.getElementById('cancelConfirmationStyles');
        const messageStyles = document.getElementById('messageStyles');

        if (overlay) overlay.remove();
        if (arrowBtn) arrowBtn.remove();
        if (styles) styles.remove();
        if (detailStyles) detailStyles.remove();
        if (confirmationStyles) confirmationStyles.remove();
        if (messageStyles) messageStyles.remove();
    }
}

// สร้าง instance เมื่อโหลดหน้าเว็บ
let bookingHistory;

document.addEventListener('DOMContentLoaded', () => {
    console.log('BookingHistory: DOM loaded, initializing...'); // Debug log
    
    // รอให้ supabase โหลดเสร็จ
    const initBookingHistory = () => {
        if (window.supabase && window.SUPABASE_CONFIG) {
            console.log('BookingHistory: Supabase ready, creating instance...'); // Debug log
            try {
                bookingHistory = new BookingHistory();
                console.log('BookingHistory: Instance created successfully'); // Debug log
            } catch (error) {
                console.error('BookingHistory: Error creating instance:', error);
            }
        } else {
            console.log('BookingHistory: Waiting for Supabase...'); // Debug log
            // รอต่ออีก 200ms หาก supabase ยังไม่โหลด
            setTimeout(initBookingHistory, 200);
        }
    };

    // เริ่มต้นหลังจาก DOM โหลดเสร็จ 500ms
    setTimeout(initBookingHistory, 500);
});

// Export สำหรับใช้งานในไฟล์อื่น
window.BookingHistory = BookingHistory;