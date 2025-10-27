// Booking Page JavaScript
// ระบบจองสนามพร้อมการตรวจสอบการจองซ้ำและการชำระเงิน

class BookingPage {
    constructor() {
        this.currentStep = 1;
        this.selectedStadium = null;
        this.bookingManager = null;
        this.currentBooking = null;
        this.paymentSlipFile = null;
        
        this.init();
    }

    async init() {
        try {
            // เชื่อมต่อ Supabase
            if (typeof supabaseClient === 'undefined') {
                throw new Error('Supabase client not found');
            }
            
            this.bookingManager = new BookingManager(supabaseClient);
            
            // โหลดข้อมูลสนาม
            await this.loadStadiums();
            
            // ตั้งค่า Event Listeners
            this.setupEventListeners();
            
            // ตั้งค่าวันที่เริ่มต้น
            this.setupDateRestrictions();
            
            // สร้างตัวเลือกเวลา
            this.generateTimeOptions();
            
        } catch (error) {
            console.error('Error initializing booking page:', error);
            this.showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดระบบจองได้ กรุณาลองใหม่อีกครั้ง', 'error');
        }
    }

    async loadStadiums() {
        try {
            this.showLoading('กำลังโหลดข้อมูลสนาม...');

            const { data, error } = await supabaseClient
                .from('stadiums')
                .select('*')
                .eq('status', 'active')
                .order('name');

            if (error) throw error;

            this.renderStadiums(data);
            this.hideLoading();

        } catch (error) {
            console.error('Error loading stadiums:', error);
            this.hideLoading();
            this.showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลสนามได้', 'error');
        }
    }

    renderStadiums(stadiums) {
        const stadiumGrid = document.getElementById('stadiumGrid');
        stadiumGrid.innerHTML = '';

        stadiums.forEach(stadium => {
            const stadiumCard = document.createElement('div');
            stadiumCard.className = 'stadium-card';
            stadiumCard.dataset.stadium = JSON.stringify(stadium);
            
            stadiumCard.innerHTML = `
                <div class="stadium-name">${stadium.name}</div>
                <div class="stadium-info">
                    <div class="stadium-detail">
                        <span>📍</span>
                        <span>${stadium.address || 'ไม่ระบุที่อยู่'}</span>
                    </div>
                    <div class="stadium-detail">
                        <span>⏰</span>
                        <span>เปิด ${stadium.open_time} - ${stadium.close_time}</span>
                    </div>
                    <div class="stadium-detail">
                        <span>📞</span>
                        <span>${stadium.phone || 'ไม่ระบุเบอร์โทร'}</span>
                    </div>
                    ${stadium.description ? `
                        <div class="stadium-detail">
                            <span>ℹ️</span>
                            <span>${stadium.description}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="stadium-price">฿${stadium.price_per_hour}/ชั่วโมง</div>
            `;

            stadiumCard.addEventListener('click', () => this.selectStadium(stadium, stadiumCard));
            stadiumGrid.appendChild(stadiumCard);
        });
    }

    selectStadium(stadium, cardElement) {
        // ลบการเลือกเก่า
        document.querySelectorAll('.stadium-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // เลือกสนามใหม่
        cardElement.classList.add('selected');
        this.selectedStadium = stadium;
        
        // เปิดใช้งานปุ่มต่อไป
        document.getElementById('nextBtn').disabled = false;
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevStep());
        document.getElementById('submitBtn').addEventListener('click', () => this.submitBooking());

        // Form inputs
        document.getElementById('timeFrom').addEventListener('change', () => this.updateTimeOptions());
        document.getElementById('timeTo').addEventListener('change', () => this.calculatePrice());
        document.getElementById('bookingDate').addEventListener('change', () => this.checkConflicts());

        // Payment method
        document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
            radio.addEventListener('change', () => this.updatePaymentInfo());
        });

        // File upload
        document.getElementById('paymentSlip').addEventListener('change', (e) => this.handleFileUpload(e));

        // Modal close
        document.querySelector('.close').addEventListener('click', () => this.hideAlert());
        document.getElementById('modalOkBtn').addEventListener('click', () => this.hideAlert());
    }

    setupDateRestrictions() {
        const today = new Date();
        const minDate = today.toISOString().split('T')[0];
        
        // ตั้งค่าวันที่ต่ำสุดเป็นวันนี้
        document.getElementById('bookingDate').min = minDate;
        
        // ตั้งค่าวันที่สูงสุดเป็น 30 วันข้างหน้า
        const maxDate = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
        document.getElementById('bookingDate').max = maxDate.toISOString().split('T')[0];
    }

    generateTimeOptions() {
        const timeFromSelect = document.getElementById('timeFrom');
        const timeToSelect = document.getElementById('timeTo');
        
        // สร้างตัวเลือกเวลาจาก 06:00 ถึง 22:00
        for (let hour = 6; hour <= 22; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                
                const optionFrom = document.createElement('option');
                optionFrom.value = timeString;
                optionFrom.textContent = timeString;
                timeFromSelect.appendChild(optionFrom);
                
                if (hour < 22 || (hour === 22 && minute === 0)) {
                    const optionTo = document.createElement('option');
                    optionTo.value = timeString;
                    optionTo.textContent = timeString;
                    timeToSelect.appendChild(optionTo);
                }
            }
        }
    }

    updateTimeOptions() {
        const timeFrom = document.getElementById('timeFrom').value;
        const timeTo = document.getElementById('timeTo');
        
        if (!timeFrom) return;
        
        // ล้างตัวเลือกเวลาสิ้นสุด
        timeTo.innerHTML = '<option value="">เลือกเวลา</option>';
        
        const [fromHour, fromMinute] = timeFrom.split(':').map(Number);
        let fromTotalMinutes = fromHour * 60 + fromMinute;
        
        // เพิ่มตัวเลือกเวลาที่มากกว่าเวลาเริ่ม
        for (let hour = 6; hour <= 22; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const totalMinutes = hour * 60 + minute;
                
                if (totalMinutes > fromTotalMinutes && hour <= 22) {
                    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const option = document.createElement('option');
                    option.value = timeString;
                    option.textContent = timeString;
                    timeTo.appendChild(option);
                }
            }
        }
        
        this.calculatePrice();
    }

    calculatePrice() {
        const timeFrom = document.getElementById('timeFrom').value;
        const timeTo = document.getElementById('timeTo').value;
        
        if (!timeFrom || !timeTo || !this.selectedStadium) return;
        
        const hours = this.bookingManager.calculateHours(timeFrom, timeTo);
        const pricePerHour = this.selectedStadium.price_per_hour;
        const totalPrice = hours * pricePerHour;
        
        document.getElementById('pricePerHour').textContent = `฿${pricePerHour}`;
        document.getElementById('totalHours').textContent = `${hours} ชั่วโมง`;
        document.getElementById('totalPrice').textContent = `฿${totalPrice}`;
    }

    async checkConflicts() {
        const stadiumName = this.selectedStadium?.name;
        const date = document.getElementById('bookingDate').value;
        const timeFrom = document.getElementById('timeFrom').value;
        const timeTo = document.getElementById('timeTo').value;
        
        if (!stadiumName || !date || !timeFrom || !timeTo) {
            document.getElementById('conflictResult').style.display = 'none';
            return;
        }
        
        try {
            const result = await this.bookingManager.checkBookingConflicts(
                stadiumName, date, timeFrom, timeTo
            );
            
            const conflictDiv = document.getElementById('conflictResult');
            
            if (result.hasConflict) {
                conflictDiv.className = 'conflict-result error';
                conflictDiv.innerHTML = `
                    <h4>⚠️ พบการจองซ้ำ</h4>
                    <p>มีการจองในช่วงเวลานี้แล้ว ${result.conflicts.length} รายการ:</p>
                    <ul>
                        ${result.conflicts.map(conflict => `
                            <li>${conflict.booker_name} - ${conflict.time_from} ถึง ${conflict.time_to}</li>
                        `).join('')}
                    </ul>
                    <p>กรุณาเลือกเวลาอื่น</p>
                `;
                conflictDiv.style.display = 'block';
                document.getElementById('nextBtn').disabled = true;
            } else {
                conflictDiv.className = 'conflict-result success';
                conflictDiv.innerHTML = `
                    <h4>✅ ช่วงเวลานี้ว่าง</h4>
                    <p>สามารถจองในช่วงเวลานี้ได้</p>
                `;
                conflictDiv.style.display = 'block';
                document.getElementById('nextBtn').disabled = false;
            }
            
        } catch (error) {
            console.error('Error checking conflicts:', error);
        }
    }

    nextStep() {
        if (!this.validateCurrentStep()) return;
        
        if (this.currentStep < 4) {
            this.currentStep++;
            this.updateStepDisplay();
            
            if (this.currentStep === 2) {
                this.showSelectedStadiumInfo();
            } else if (this.currentStep === 3) {
                this.showBookingSummary();
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                if (!this.selectedStadium) {
                    this.showAlert('กรุณาเลือกสนาม', 'เลือกสนามที่ต้องการจองก่อนดำเนินการต่อ', 'warning');
                    return false;
                }
                return true;
                
            case 2:
                const form = document.getElementById('bookingForm');
                const formData = new FormData(form);
                
                const required = ['bookerName', 'bookerPhone', 'bookingDate', 'timeFrom', 'timeTo'];
                for (let field of required) {
                    if (!formData.get(field)) {
                        this.showAlert('กรุณากรอกข้อมูลให้ครบ', `กรุณากรอก${this.getFieldLabel(field)}`, 'warning');
                        return false;
                    }
                }
                
                // ตรวจสอบการจองซ้ำ
                const conflictDiv = document.getElementById('conflictResult');
                if (conflictDiv.classList.contains('error')) {
                    this.showAlert('มีการจองซ้ำ', 'กรุณาเลือกช่วงเวลาอื่น', 'error');
                    return false;
                }
                
                return true;
                
            case 3:
                const paymentSlip = document.getElementById('paymentSlip').files[0];
                if (!paymentSlip) {
                    this.showAlert('กรุณาแนบสลิป', 'กรุณาแนบสลิปการชำระเงิน', 'warning');
                    return false;
                }
                return true;
                
            default:
                return true;
        }
    }

    getFieldLabel(field) {
        const labels = {
            'bookerName': 'ชื่อ-นามสกุล',
            'bookerPhone': 'เบอร์โทรศัพท์',
            'bookingDate': 'วันที่จอง',
            'timeFrom': 'เวลาเริ่ม',
            'timeTo': 'เวลาสิ้นสุด'
        };
        return labels[field] || field;
    }

    updateStepDisplay() {
        // อัปเดต Step Indicator
        document.querySelectorAll('.step').forEach((step, index) => {
            if (index + 1 <= this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        
        // แสดง/ซ่อน Step Content
        document.querySelectorAll('.booking-step').forEach((step, index) => {
            if (index + 1 === this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        
        // อัปเดตปุ่มนำทาง
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        prevBtn.style.display = this.currentStep > 1 ? 'block' : 'none';
        nextBtn.style.display = this.currentStep < 3 ? 'block' : 'none';
        submitBtn.style.display = this.currentStep === 3 ? 'block' : 'none';
    }

    showSelectedStadiumInfo() {
        const infoDiv = document.getElementById('selectedStadiumInfo');
        infoDiv.innerHTML = `
            <h3>สนามที่เลือก</h3>
            <div class="stadium-info">
                <h4>${this.selectedStadium.name}</h4>
                <p>📍 ${this.selectedStadium.address}</p>
                <p>💰 ฿${this.selectedStadium.price_per_hour}/ชั่วโมง</p>
                <p>⏰ เปิด ${this.selectedStadium.open_time} - ${this.selectedStadium.close_time}</p>
                ${this.selectedStadium.description ? `<p>ℹ️ ${this.selectedStadium.description}</p>` : ''}
            </div>
        `;
    }

    showBookingSummary() {
        const form = document.getElementById('bookingForm');
        const formData = new FormData(form);
        
        const hours = this.bookingManager.calculateHours(
            formData.get('timeFrom'),
            formData.get('timeTo')
        );
        const totalPrice = hours * this.selectedStadium.price_per_hour;
        
        const summaryDiv = document.getElementById('bookingSummary');
        summaryDiv.innerHTML = `
            <h3>สรุปการจอง</h3>
            <div class="booking-summary-details">
                <p><strong>สนาม:</strong> ${this.selectedStadium.name}</p>
                <p><strong>ผู้จอง:</strong> ${formData.get('bookerName')}</p>
                <p><strong>เบอร์โทร:</strong> ${formData.get('bookerPhone')}</p>
                <p><strong>วันที่:</strong> ${this.formatDate(formData.get('bookingDate'))}</p>
                <p><strong>เวลา:</strong> ${formData.get('timeFrom')} - ${formData.get('timeTo')}</p>
                <p><strong>จำนวนชั่วโมง:</strong> ${hours} ชั่วโมง</p>
                <p><strong>ราคารวม:</strong> ฿${totalPrice}</p>
                ${formData.get('specialRequirements') ? 
                    `<p><strong>ความต้องการพิเศษ:</strong> ${formData.get('specialRequirements')}</p>` : ''}
            </div>
        `;
    }

    updatePaymentInfo() {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        const bankInfo = document.getElementById('bankTransferInfo');
        const qrInfo = document.getElementById('qrCodeInfo');
        
        if (paymentMethod === 'bank_transfer') {
            bankInfo.style.display = 'block';
            qrInfo.style.display = 'none';
        } else if (paymentMethod === 'qr_code') {
            bankInfo.style.display = 'none';
            qrInfo.style.display = 'block';
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('filePreview');
        
        if (file) {
            // ตรวจสอบประเภทไฟล์
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                this.showAlert('ประเภทไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, GIF) หรือ PDF', 'error');
                event.target.value = '';
                return;
            }
            
            // ตรวจสอบขนาดไฟล์
            if (file.size > 10 * 1024 * 1024) {
                this.showAlert('ไฟล์ใหญ่เกินไป', 'ขนาดไฟล์ต้องไม่เกิน 10MB', 'error');
                event.target.value = '';
                return;
            }
            
            this.paymentSlipFile = file;
            
            // แสดง preview
            preview.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
            `;
            preview.style.display = 'block';
        }
    }

    async submitBooking() {
        try {
            this.showLoading('กำลังสร้างการจอง...');
            
            // รวบรวมข้อมูลการจอง
            const form = document.getElementById('bookingForm');
            const formData = new FormData(form);
            
            const bookingData = {
                stadium_name: this.selectedStadium.name,
                booker_name: formData.get('bookerName'),
                booker_phone: formData.get('bookerPhone'),
                booker_email: formData.get('bookerEmail'),
                booking_date: formData.get('bookingDate'),
                time_from: formData.get('timeFrom'),
                time_to: formData.get('timeTo'),
                payment_method: document.querySelector('input[name="paymentMethod"]:checked').value,
                special_requirements: formData.get('specialRequirements')
            };
            
            // สร้างการจอง
            const bookingResult = await this.bookingManager.createBooking(bookingData);
            
            if (!bookingResult.success) {
                throw new Error(bookingResult.error);
            }
            
            this.currentBooking = bookingResult.data;
            
            // อัปโหลดสลิปการชำระเงิน
            this.showLoading('กำลังอัปโหลดสลิป...');
            
            const uploadResult = await this.bookingManager.uploadPaymentSlip(
                this.paymentSlipFile,
                this.currentBooking.id
            );
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error);
            }
            
            this.hideLoading();
            
            // แสดงหน้าสำเร็จ
            this.currentStep = 4;
            this.updateStepDisplay();
            this.showBookingSuccess();
            
        } catch (error) {
            console.error('Error submitting booking:', error);
            this.hideLoading();
            this.showAlert('เกิดข้อผิดพลาด', error.message, 'error');
        }
    }

    showBookingSuccess() {
        document.getElementById('bookingId').textContent = this.currentBooking.id;
        
        const detailsDiv = document.getElementById('finalBookingDetails');
        detailsDiv.innerHTML = `
            <h4>รายละเอียดการจอง</h4>
            <p><strong>สนาม:</strong> ${this.currentBooking.stadium_name}</p>
            <p><strong>ผู้จอง:</strong> ${this.currentBooking.booker_name}</p>
            <p><strong>วันที่:</strong> ${this.formatDate(this.currentBooking.booking_date)}</p>
            <p><strong>เวลา:</strong> ${this.currentBooking.time_from} - ${this.currentBooking.time_to}</p>
            <p><strong>ราคารวม:</strong> ฿${this.currentBooking.total_price}</p>
            <p><strong>สถานะ:</strong> รอการตรวจสอบการชำระเงิน</p>
        `;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    }

    showLoading(text = 'กำลังประมวลผล...') {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showAlert(title, message, type = 'info') {
        const modal = document.getElementById('alertModal');
        const icon = document.getElementById('modalIcon');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        
        // ตั้งค่าไอคอนตามประเภท
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        
        icon.textContent = icons[type] || icons['info'];
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        modal.style.display = 'flex';
    }

    hideAlert() {
        document.getElementById('alertModal').style.display = 'none';
    }
}

// เริ่มต้นระบบเมื่อโหลดหน้าเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    new BookingPage();
});