// Auto-login using 'Remember Me' credentials if present
; (function () {
    const rem = localStorage.getItem('rememberMe');
    if (rem) {
        try {
            const { email, password, userType } = JSON.parse(rem);
            if (email && password && userType) {
                login(email, password, userType);
            }
        } catch { }
    }
})();

// ===== ORTHODONTICS SCHEDULE =====
let orthodonticsSchedules = {};

// ===== UTILITY FUNCTIONS =====
function formatLargeNumber(value, element) {
    // Remove existing classes
    element.classList.remove('large-number', 'very-large-number');

    // Apply appropriate class based on value length
    const valueStr = value.toString().replace(/[^0-9.]/g, ''); // Remove currency symbols
    const numValue = parseFloat(valueStr);

    if (numValue >= 1000000) { // Over 1 million
        element.classList.add('very-large-number');
    } else if (numValue >= 100000) { // Over 100k
        element.classList.add('large-number');
    }

    element.textContent = value;
    // Auto-adjust font size to fit container width
    // Reset any inline font-size before adjustment
    element.style.fontSize = '';
    const computedStyle = window.getComputedStyle(element, null);
    let fontSize = parseFloat(computedStyle.fontSize);
    // Set minimum font-size in pixels based on number magnitude
    // Allow smaller defaults to ensure small currency values fully fit
    // For very long numbers, allow deeper shrinkage
    const minFontSize = element.classList.contains('very-large-number') ? 6
        : element.classList.contains('large-number') ? 8 : 12;
    // Reduce font-size until text fits within element width or reaches minimum
    while (element.scrollWidth > element.clientWidth && fontSize > minFontSize) {
        fontSize--;
        element.style.fontSize = fontSize + 'px';
    }
    // If still too wide after resizing, apply horizontal scale to fit
    if (element.scrollWidth > element.clientWidth) {
        const scaleX = element.clientWidth / element.scrollWidth;
        element.style.transform = `scaleX(${scaleX})`;
    } else {
        element.style.transform = '';
    }
}

function formatCurrency(amount, currency) {
    // Format with appropriate number of decimal places
    const options = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'IQD' ? 0 : 2,
        maximumFractionDigits: currency === 'IQD' ? 0 : 2
    };

    return new Intl.NumberFormat('en-US', options).format(amount);
}

async function goToOrthodonticsSchedule(patientId) {
    // Show the Orthodontics Schedule section and hide others
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    let orthoSection = document.getElementById('orthodonticsScheduleSection');
    if (!orthoSection) {
        orthoSection = document.createElement('section');
        orthoSection.id = 'orthodonticsScheduleSection';
        orthoSection.className = 'content-section active';
        orthoSection.innerHTML = `
            <div class="section-header">
                <h2>Orthodontics Schedule</h2>
                <button class="btn btn-secondary" onclick="showSection('patients')">Back to Patients</button>
            </div>
            <div id="orthodonticsScheduleTableContainer">
                <div class="loading">Loading orthodontics schedule...</div>
            </div>
            <button class="btn btn-primary" id="addOrthoEntryBtn">Add Entry</button>
            <div id="orthoEntryFormContainer" style="display:none;"></div>
        `;
        document.querySelector('.main-content').appendChild(orthoSection);
    } else {
        orthoSection.classList.add('active');
    }
    await loadOrthodonticsSchedule(patientId);
    setupOrthoEntryHandlers(patientId);
}

async function loadOrthodonticsSchedule(patientId) {
    try {
        const response = await fetch(`/api/patients/${patientId}/orthodontics-schedule`);
        if (response.ok) {
            const schedule = await response.json();
            orthodonticsSchedules[patientId] = schedule;
            renderOrthodonticsScheduleTable(patientId);
        } else {
            console.error('Failed to load orthodontics schedule');
            showNotification('Failed to load orthodontics schedule', 'error');
            renderOrthodonticsScheduleTable(patientId);
        }
    } catch (error) {
        console.error('Error loading orthodontics schedule:', error);
        showNotification('Error loading orthodontics schedule', 'error');
        renderOrthodonticsScheduleTable(patientId);
    }
}

function renderOrthodonticsScheduleTable(patientId) {
    const container = document.getElementById('orthodonticsScheduleTableContainer');
    const schedule = orthodonticsSchedules[patientId] || [];
    let html = `<table class="ortho-table">
        <thead>
            <tr>
                <th>#</th>
                <th>Upper Size</th>
                <th>Lower Size</th>
                <th>Amount Paid</th>
                <th>Date</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    if (schedule.length === 0) {
        html += '<tr><td colspan="5" class="text-center text-muted">No schedule entries</td></tr>';
    } else {
        schedule.forEach((entry, idx) => {
            const formattedAmount = formatAmount(entry.amountPaid, entry.currency);
            const formattedDate = formatDate(entry.date);
            html += `<tr>
                <td>${idx + 1}</td>
                <td>${entry.upperSize || ''}</td>
                <td>${entry.lowerSize || ''}</td>
                <td>${formattedAmount}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="action-btn" onclick="editOrthoEntry(${patientId}, ${entry.id})">Edit</button>
                    <button class="action-btn" onclick="deleteOrthoEntry(${patientId}, ${entry.id})">Delete</button>
                </td>
            </tr>`;
        });
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

function setupOrthoEntryHandlers(patientId) {
    document.getElementById('addOrthoEntryBtn').onclick = function () {
        showOrthoEntryForm(patientId);
    };
}

function showOrthoEntryForm(patientId, entryId = null) {
    const formContainer = document.getElementById('orthoEntryFormContainer');
    let entry = { upperSize: '', lowerSize: '', amountPaid: '', currency: 'USD', date: '' };

    if (entryId !== null) {
        const existingEntry = orthodonticsSchedules[patientId]?.find(e => e.id === entryId);
        if (existingEntry) {
            entry = { ...existingEntry };
            // Format date for input field
            entry.date = entry.date.split('T')[0];
        }
    }

    formContainer.innerHTML = `
        <form id="orthoEntryForm">
            <div class="form-row">
                <label>Upper Size: <input type="text" id="orthoUpperSize" value="${entry.upperSize || ''}" required></label>
                <label>Lower Size: <input type="text" id="orthoLowerSize" value="${entry.lowerSize || ''}" required></label>
                <label>Amount Paid: <input type="number" id="orthoAmountPaid" value="${entry.amountPaid}" step="0.01" min="0" required></label>
            </div>
            <div class="form-row">
                <label>Currency:
                    <select id="orthoCurrency" required>
                        <option value="USD" ${entry.currency === 'USD' ? 'selected' : ''}>USD</option>
                        <option value="IQD" ${entry.currency === 'IQD' ? 'selected' : ''}>IQD</option>
                    </select>
                </label>
                <label>Date: <input type="date" id="orthoDate" value="${entry.date}" required></label>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">${entryId !== null ? 'Update' : 'Add'} Entry</button>
                <button type="button" class="btn btn-secondary" onclick="hideOrthoEntryForm()">Cancel</button>
            </div>
        </form>
    `;
    formContainer.style.display = '';

    document.getElementById('orthoEntryForm').onsubmit = async function (e) {
        e.preventDefault();
        await saveOrthoEntry(patientId, entryId);
    };
}

async function saveOrthoEntry(patientId, entryId = null) {
    const upperSize = document.getElementById('orthoUpperSize').value;
    const lowerSize = document.getElementById('orthoLowerSize').value;
    const amountPaid = document.getElementById('orthoAmountPaid').value;
    const currency = document.getElementById('orthoCurrency').value;
    const date = document.getElementById('orthoDate').value;

    const entryData = { upperSize, lowerSize, amountPaid, currency, date };

    try {
        let response;
        if (entryId !== null) {
            // Update existing entry
            response = await fetch(`/api/orthodontics-schedule/${entryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entryData)
            });
        } else {
            // Add new entry
            response = await fetch(`/api/patients/${patientId}/orthodontics-schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entryData)
            });
        }

        if (response.ok) {
            showNotification(`Entry ${entryId ? 'updated' : 'added'} successfully`, 'success');
            hideOrthoEntryForm();
            await loadOrthodonticsSchedule(patientId);
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save entry', 'error');
        }
    } catch (error) {
        console.error('Error saving orthodontics entry:', error);
        showNotification('Error saving entry', 'error');
    }
}

function hideOrthoEntryForm() {
    const formContainer = document.getElementById('orthoEntryFormContainer');
    formContainer.style.display = 'none';
    formContainer.innerHTML = '';
}

function editOrthoEntry(patientId, entryId) {
    showOrthoEntryForm(patientId, entryId);
}

async function deleteOrthoEntry(patientId, entryId) {
    if (confirm('Are you sure you want to delete this orthodontics schedule entry?')) {
        try {
            const response = await fetch(`/api/orthodontics-schedule/${entryId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showNotification('Entry deleted successfully', 'success');
                await loadOrthodonticsSchedule(patientId);
            } else {
                const error = await response.json();
                showNotification(error.error || 'Failed to delete entry', 'error');
            }
        } catch (error) {
            console.error('Error deleting orthodontics entry:', error);
            showNotification('Error deleting entry', 'error');
        }
    }
}
// ===== GLOBAL VARIABLES =====
let currentUser = null;
let currentUserType = null;
let isLoggedIn = false;

// ===== REMINDERS STORAGE =====
let allReminders = [];
let currentReminderRange = '';
// ===== APPOINTMENT RANGE FILTER =====
let currentAppointmentRange = '';

// ===== UTILITY FUNCTIONS =====
// Format amount given specific currency
function formatAmount(amount, currency) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function showNotification(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const messageEl = document.getElementById('toastMessage');

    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.className = `notification-toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');

        // Clear appointment patient search when closing the modal
        if (modalId === 'addAppointmentModal') {
            const searchInput = document.getElementById('appointmentPatientSearch');
            const dropdown = document.getElementById('appointmentPatientDropdown');
            if (searchInput) {
                searchInput.value = '';
                searchInput.style.borderColor = '';
                searchInput.style.backgroundColor = '';
            }
            if (dropdown) {
                dropdown.classList.remove('show');
            }
            clearSelectedPatient();
        }
    }
}

function openModal(modalId) {
    console.log('Opening modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log('Modal element found, adding active class');
        modal.classList.add('active');

        // Clear and reset appointment patient search when opening the modal
        if (modalId === 'addAppointmentModal') {
            const searchInput = document.getElementById('appointmentPatientSearch');
            const dropdown = document.getElementById('appointmentPatientDropdown');
            if (searchInput) {
                searchInput.value = '';
                searchInput.style.borderColor = '';
                searchInput.style.backgroundColor = '';
            }
            if (dropdown) {
                dropdown.classList.remove('show');
            }
            clearSelectedPatient();
        }
    } else {
        console.error('Modal element not found:', modalId);
    }
}

// Close modals when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        // Prevent closing login modal when clicking outside
        if (modal.id === 'loginModal') return;
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Function to update remaining amount based on payment status selection
function updateRemainingAmount() {
    const totalCost = parseFloat(document.getElementById('totalCost').value) || 0;
    const paymentStatus = document.getElementById('patientPaymentStatus').value;
    const remainingAmountField = document.getElementById('remainingAmount');

    switch (paymentStatus) {
        case 'not_paid':
            remainingAmountField.value = totalCost;
            remainingAmountField.readOnly = true;
            break;
        case 'paid':
            remainingAmountField.value = 0;
            remainingAmountField.readOnly = true;
            break;
        case 'partial':
            remainingAmountField.readOnly = false;
            if (remainingAmountField.value == totalCost || remainingAmountField.value == 0) {
                remainingAmountField.value = '';
            }
            break;
        default:
            remainingAmountField.readOnly = false;
            break;
    }
}

// Function to update remaining amount for edit form
function updateEditRemainingAmount() {
    const totalCost = parseFloat(document.getElementById('editTotalCost').value) || 0;
    const paymentStatus = document.getElementById('editPatientPaymentStatus').value;
    const remainingAmountField = document.getElementById('editRemainingAmount');

    switch (paymentStatus) {
        case 'not_paid':
            remainingAmountField.value = totalCost;
            remainingAmountField.readOnly = true;
            break;
        case 'paid':
            remainingAmountField.value = 0;
            remainingAmountField.readOnly = true;
            break;
        case 'partial':
            remainingAmountField.readOnly = false;
            if (remainingAmountField.value == totalCost || remainingAmountField.value == 0) {
                remainingAmountField.value = '';
            }
            break;
        default:
            remainingAmountField.readOnly = false;
            break;
    }
}
// Show/hide implant-specific fields based on case selection (global scope)
function handlePatientProblemChange(selectEl) {
    const selected = Array.from(selectEl.selectedOptions).map(o => o.value);
    const implantDetails = document.querySelectorAll('.implant-details');
    if (selected.includes('Implant')) {
        implantDetails.forEach(el => el.classList.remove('hidden'));
    } else {
        implantDetails.forEach(el => el.classList.add('hidden'));
    }
}

// ===== API FUNCTIONS =====
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`http://localhost:3000${endpoint}`, options);
        const result = await response.json();

        // Handle authentication errors ONLY for protected routes (not login routes)
        if (response.status === 401 || response.status === 403) {
            // Skip session handling for login endpoints
            if (!endpoint.includes('/login')) {
                // Session expired or invalid - redirect to login
                if (result.error && (result.error.includes('Authentication required') || result.error.includes('Admin access required'))) {
                    showNotification('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                    throw new Error(result.error);
                }
            }
        }

        if (!response.ok) {
            throw new Error(result.error || 'An error occurred');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);

        // Don't show notification here - let the calling function handle it
        // to avoid duplicate error messages
        throw error;
    }
}

// Check if session is still valid
async function checkSession() {
    try {
        const result = await fetch('http://localhost:3000/api/auth/check', {
            method: 'GET',
            credentials: 'include'
        });

        if (result.ok) {
            const data = await result.json();
            return data.user;
        } else {
            // 401 is expected when not logged in, don't treat as error
            return null;
        }
    } catch (error) {
        // Only log network errors, not auth errors
        console.error('Session check network error:', error);
        return null;
    }
}

// ===== AUTHENTICATION =====
async function login(email, password, userType) {
    try {
        const endpoint = userType === 'admin' ? '/api/auth/admin/login' : '/api/auth/doctor/login';
        const result = await apiCall(endpoint, 'POST', { email, password });

        if (result.success) {
            currentUser = result.user;
            currentUserType = userType;
            isLoggedIn = true;

            // Hide login modal and show dashboard
            closeModal('loginModal');
            document.getElementById('dashboard').classList.remove('hidden');

            // Update UI with user info
            updateUserInfo();

            // Load initial data
            if (userType === 'admin') {
                loadAdminDashboard();
            } else {
                loadDoctorDashboard();
            }

            // Start activity tracking
            setupActivityTracking();

            showNotification(`Welcome back, ${result.user.name}!`, 'success');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Invalid credentials. Please try again.', 'error');
    }
}

function logout() {
    // Clear persistent auto-login on logout
    localStorage.removeItem('rememberMe');
    // Store user type for redirect
    const userTypeForRedirect = currentUserType;
    currentUser = null;
    currentUserType = null;
    isLoggedIn = false;

    // Determine redirect page based on current URL
    const currentPath = window.location.pathname;
    const redirectPage = currentPath.includes('admin.html') ? 'admin.html'
        : currentPath.includes('doctor.html') ? 'doctor.html'
            : null;

    // Clear intervals
    if (reminderInterval) {
        clearInterval(reminderInterval);
    }
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }

    // Call logout API
    fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    }).then(() => {
        // Redirect based on current page first
        if (redirectPage) {
            window.location.href = redirectPage;
        } else if (userTypeForRedirect === 'admin') {
            window.location.href = 'admin.html';
        } else if (userTypeForRedirect === 'doctor') {
            window.location.href = 'doctor.html';
        } else {
            window.location.href = 'index.html';
        }
    }).catch((error) => {
        console.error('Logout error:', error);
        // Redirect anyway (fallback)
        if (redirectPage) {
            window.location.href = redirectPage;
        } else if (userTypeForRedirect === 'admin') {
            window.location.href = 'admin.html';
        } else if (userTypeForRedirect === 'doctor') {
            window.location.href = 'doctor.html';
        } else {
            window.location.href = 'index.html';
        }
    });
}

function updateUserInfo() {
    if (currentUserType === 'admin') {
        const adminNameEl = document.querySelector('.admin-name');
        if (adminNameEl) {
            adminNameEl.textContent = `Welcome, ${currentUser.name}`;
        }
    } else {
        const doctorNameEl = document.getElementById('doctorName');
        const doctorNameWelcomeEl = document.getElementById('doctorNameWelcome');

        if (doctorNameEl) {
            doctorNameEl.textContent = `Welcome, Dr. ${currentUser.name}`;
        }
        if (doctorNameWelcomeEl) {
            doctorNameWelcomeEl.textContent = `Dr. ${currentUser.name}`;
        }
    }
}

// ===== ADMIN DASHBOARD FUNCTIONS =====
async function loadAdminDashboard() {
    try {
        // Request notification permission for reminders
        requestNotificationPermission();

        // Load statistics
        loadAdminStats();

        // Load initial data
        loadAdmins();
        loadDoctors();
        loadPatients();
        loadAppointments();
        loadReminders();

        // Start reminder checking
        startReminderCheck();

    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

async function loadAdminStats() {
    try {
        const stats = await apiCall('/api/admin/stats');

        document.getElementById('totalAdmins').textContent = stats.totalAdmins || 0;
        document.getElementById('totalDoctors').textContent = stats.totalDoctors || 0;
        document.getElementById('totalPatients').textContent = stats.totalPatients || 0;
        document.getElementById('todayAppointments').textContent = stats.todayAppointments || 0;
        // Compute and display revenue by currency
        const patients = await apiCall('/api/patients');
        let usdRevenue = 0, iqdRevenue = 0;
        // Sum remaining amounts for each currency
        patients.forEach(patient => {
            const remaining = parseFloat(patient.remainingAmount) || 0;
            if (patient.currency === 'USD') usdRevenue += remaining;
            else if (patient.currency === 'IQD') iqdRevenue += remaining;
        });
        // Display paid revenue by currency
        const totalRevenueElement = document.getElementById('totalRevenue');
        const totalRevenueIQDElement = document.getElementById('totalRevenueIQD');

        formatLargeNumber(formatCurrency(usdRevenue, 'USD'), totalRevenueElement);
        formatLargeNumber(formatCurrency(iqdRevenue, 'IQD'), totalRevenueIQDElement);

        // Compute and display total earned by currency (totalCost minus remainingAmount)
        let usdEarn = 0, iqdEarn = 0;
        patients.forEach(patient => {
            const cost = parseFloat(patient.totalCost) || 0;
            const remaining = parseFloat(patient.remainingAmount) || 0;
            const earned = Math.max(cost - remaining, 0);
            if (patient.currency === 'USD') usdEarn += earned;
            else if (patient.currency === 'IQD') iqdEarn += earned;
        });

        const totalEarnUSDElement = document.getElementById('totalEarnUSD');
        const totalEarnIQDElement = document.getElementById('totalEarnIQD');

        formatLargeNumber(formatCurrency(usdEarn, 'USD'), totalEarnUSDElement);
        formatLargeNumber(formatCurrency(iqdEarn, 'IQD'), totalEarnIQDElement);
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

async function loadDoctors() {
    try {
        const doctors = await apiCall('/api/doctors');
        const tbody = document.getElementById('doctorsTableBody');
        const selectEls = document.querySelectorAll('#assignedDoctor, #appointmentDoctor');

        // Update table
        tbody.innerHTML = doctors.map(doctor => `
            <tr>
                <td>${doctor.id}</td>
                <td>${doctor.name}</td>
                <td>${doctor.email}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="editDoctor(${doctor.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="deleteDoctor(${doctor.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Update select options
        selectEls.forEach(select => {
            select.innerHTML = '<option value="">Select Doctor</option>' +
                doctors.map(doctor => `<option value="${doctor.id}">${doctor.name}</option>`).join('');
        });

        // Update edit form select options
        const editSelectEls = document.querySelectorAll('#editAssignedDoctor, #editAppointmentDoctor');
        editSelectEls.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Select Doctor</option>' +
                    doctors.map(doctor => `<option value="${doctor.id}">${doctor.name}</option>`).join('');
            }
        });

        // Update appointment filter options
        const appointmentFilterSelect = document.getElementById('appointmentDoctorFilter');
        if (appointmentFilterSelect) {
            appointmentFilterSelect.innerHTML = '<option value="all">All Doctors</option>' +
                doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        }
        // Update patient doctor filter options
        const patientDoctorFilter = document.getElementById('patientDoctorFilter');
        if (patientDoctorFilter) {
            patientDoctorFilter.innerHTML = '<option value="all">All Doctors</option>' +
                doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading doctors:', error);
    }
}

async function loadAdmins() {
    try {
        const admins = await apiCall('/api/admins');
        const tbody = document.getElementById('adminsTableBody');

        // Update table
        tbody.innerHTML = admins.map(admin => `
            <tr>
                <td>${admin.id}</td>
                <td>${admin.name}</td>
                <td>${admin.email}</td>
                <td>${formatDate(admin.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="editAdmin(${admin.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="deleteAdmin(${admin.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

function renderPatientsTable(patients) {
    const tbody = document.getElementById('patientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = patients.map(patient => {
        // If "Orthodontics" is in the problem list, add a button to go to schedule
        const isOrtho = (patient.problem || '').split(',').map(s => s.trim()).includes('Orthodontics');
        const isImplant = (patient.problem || '').split(',').map(s => s.trim()).includes('Implant');
        return `
        <tr>
            <td>${patient.id}</td>
            <td>${patient.fullName}</td>
            <td>${patient.phone}</td>
            <td>${patient.problem}
                ${isOrtho ? `<button class=\"btn btn-sm btn-accent\" onclick=\"goToOrthodonticsSchedule(${patient.id})\">Ortho Schedule</button>` : ''}
                ${isImplant ? `<button class=\"btn btn-sm btn-info\" onclick=\"openImplantInfoModal(${patient.id}, '${patient.fullName.replace(/'/g, "&#39;") || ''}')\">Implant Information</button>` : ''}
            </td>
            <td>${patient.doctorName || 'Unassigned'}</td>
            <td>${formatAmount(patient.totalCost || 0, patient.currency)}</td>
            <td class="${patient.remainingAmount > 0 ? 'text-warning' : 'text-success'}">
                ${formatAmount(patient.remainingAmount || 0, patient.currency)}
            </td>
            <td>
                <button class=\"btn btn-sm btn-secondary\" onclick=\"openPatientNoteModal(${patient.id}, '${patient.fullName.replace(/'/g, "&#39;") || ''}')\">Note</button>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="editPatient(${patient.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="deletePatient(${patient.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// --- Implant Information Modal Logic ---
let currentImplantPatientId = null;
function openImplantInfoModal(patientId, fullName) {
    currentImplantPatientId = patientId;
    document.getElementById('implantInfoModalTitle').textContent = `Implant Information: ${fullName}`;
    document.getElementById('implantInfoStatus').textContent = '';
    // Hide input fields and save button, show read-only display fields
    document.getElementById('implantBrandInput').style.display = 'none';
    document.getElementById('implantFormerInput').style.display = 'none';
    document.getElementById('implantCrownTypeInput').style.display = 'none';
    document.getElementById('implantBrandDisplay').style.display = '';
    document.getElementById('implantFormerDisplay').style.display = '';
    document.getElementById('implantCrownTypeDisplay').style.display = '';
    document.getElementById('implantInfoSaveBtn').style.display = 'none';
    document.getElementById('implantInfoModal').style.display = 'block';
    // Fetch implant info from backend
    fetch(`/api/patients/${patientId}/implant-info`).then(res => res.json()).then(data => {
        document.getElementById('implantBrandDisplay').textContent = data.implantBrand || '-';
        document.getElementById('implantFormerDisplay').textContent = data.implantFormer || '-';
        document.getElementById('implantCrownTypeDisplay').textContent = data.implantCrownType || '-';
    }).catch(() => {
        document.getElementById('implantInfoStatus').textContent = 'Failed to load implant info.';
        document.getElementById('implantBrandDisplay').textContent = '-';
        document.getElementById('implantFormerDisplay').textContent = '-';
        document.getElementById('implantCrownTypeDisplay').textContent = '-';
    });
}

function closeImplantInfoModal() {
    document.getElementById('implantInfoModal').style.display = 'none';
    currentImplantPatientId = null;
}

function saveImplantInfo() {
    if (!currentImplantPatientId) return;
    const implantBrand = document.getElementById('implantBrandInput').value;
    const implantFormer = document.getElementById('implantFormerInput').value;
    const implantCrownType = document.getElementById('implantCrownTypeInput').value;
    fetch(`/api/patients/${currentImplantPatientId}/implant-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ implantBrand, implantFormer, implantCrownType })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('implantInfoStatus').textContent = 'Implant info saved!';
            } else {
                document.getElementById('implantInfoStatus').textContent = 'Failed to save implant info.';
            }
        })
        .catch(() => {
            document.getElementById('implantInfoStatus').textContent = 'Failed to save implant info.';
        });
}


// --- Patient Note Modal Logic ---
let currentPatientNoteId = null;
function openPatientNoteModal(patientId, fullName) {
    currentPatientNoteId = patientId;
    document.getElementById('patientNoteModalTitle').textContent = `Patient Note: ${fullName}`;
    document.getElementById('patientNoteStatus').textContent = '';
    document.getElementById('patientNoteTextarea').value = '';
    document.getElementById('patientNoteModal').style.display = 'block';
    // Fetch note from backend
    fetch(`/api/patients/${patientId}/note`).then(res => res.json()).then(data => {
        document.getElementById('patientNoteTextarea').value = data.note || '';
    }).catch(() => {
        document.getElementById('patientNoteStatus').textContent = 'Failed to load note.';
    });
}

function closePatientNoteModal() {
    document.getElementById('patientNoteModal').style.display = 'none';
    currentPatientNoteId = null;
}

function savePatientNote() {
    if (!currentPatientNoteId) return;
    const note = document.getElementById('patientNoteTextarea').value;
    fetch(`/api/patients/${currentPatientNoteId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('patientNoteStatus').textContent = 'Note saved!';
            } else {
                document.getElementById('patientNoteStatus').textContent = 'Failed to save note.';
            }
        })
        .catch(() => {
            document.getElementById('patientNoteStatus').textContent = 'Failed to save note.';
        });
}



function updatePatientSelectOptions(patients) {
    // This function is no longer needed for autocomplete, but kept for compatibility
    const hiddenInput = document.getElementById('appointmentPatient');
    if (hiddenInput && patients.length === 1) {
        // Auto-select if only one patient matches
        hiddenInput.value = patients[0].id;
    }
}

function filterPatientsForAppointment(searchTerm) {
    const dropdown = document.getElementById('appointmentPatientDropdown');
    if (!dropdown) return;

    if (!searchTerm || searchTerm.trim() === '') {
        dropdown.classList.remove('show');
        clearSelectedPatient();
        return;
    }

    const filtered = allPatients.filter(patient => {
        const fullName = patient.fullName.toLowerCase();
        const phone = (patient.phone || '').toLowerCase();
        const search = searchTerm.toLowerCase().trim();

        return fullName.includes(search) || phone.includes(search);
    });

    renderAutocompleteDropdown(filtered, searchTerm);
}

function renderAutocompleteDropdown(patients, searchTerm) {
    const dropdown = document.getElementById('appointmentPatientDropdown');
    if (!dropdown) return;

    if (patients.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-no-results">No patients found</div>';
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = patients.map(patient => `
        <div class="autocomplete-item" data-patient-id="${patient.id}" data-patient-name="${patient.fullName}">
            <div class="autocomplete-item-name">${highlightMatch(patient.fullName, searchTerm)}</div>
            <div class="autocomplete-item-details">
                📞 ${highlightMatch(patient.phone || 'No phone', searchTerm)} •
                🏥 ${patient.problem || 'No problem specified'} •
                💰 ${formatAmount(patient.remainingAmount || 0, patient.currency)} remaining
            </div>
        </div>
    `).join('');

    dropdown.classList.add('show');

    // Add click event listeners to dropdown items
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            selectPatientFromDropdown(item);
        });
    });
}

function highlightMatch(text, searchTerm) {
    if (!searchTerm || !text) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

function selectPatientFromDropdown(item) {
    const patientId = item.getAttribute('data-patient-id');
    const patientName = item.getAttribute('data-patient-name');

    // Update the search input with selected patient name
    const searchInput = document.getElementById('appointmentPatientSearch');
    const hiddenInput = document.getElementById('appointmentPatient');
    const dropdown = document.getElementById('appointmentPatientDropdown');

    if (searchInput) searchInput.value = patientName;
    if (hiddenInput) hiddenInput.value = patientId;
    if (dropdown) dropdown.classList.remove('show');

    // Add visual feedback
    if (searchInput) {
        searchInput.style.borderColor = '#10b981';
        searchInput.style.backgroundColor = '#f0fdf4';
    }
}

function clearSelectedPatient() {
    const hiddenInput = document.getElementById('appointmentPatient');
    const searchInput = document.getElementById('appointmentPatientSearch');

    if (hiddenInput) hiddenInput.value = '';
    if (searchInput) {
        searchInput.style.borderColor = '';
        searchInput.style.backgroundColor = '';
    }
}

// Enhanced function to validate and auto-select exact matches
function validateAndSelectExactMatch(searchValue) {
    if (!searchValue) return false;

    const exactMatch = allPatients.find(patient =>
        patient.fullName.toLowerCase() === searchValue.toLowerCase()
    );

    if (exactMatch) {
        const hiddenInput = document.getElementById('appointmentPatient');
        const searchInput = document.getElementById('appointmentPatientSearch');

        if (hiddenInput) hiddenInput.value = exactMatch.id;
        if (searchInput) {
            searchInput.style.borderColor = '#10b981';
            searchInput.style.backgroundColor = '#f0fdf4';
        }
        return true;
    }
    return false;
}

function updateAppointmentSearchStatus(message) {
    // This function is no longer needed for autocomplete but kept for compatibility
}

function setupAppointmentPatientSearch() {
    const searchInput = document.getElementById('appointmentPatientSearch');
    const dropdown = document.getElementById('appointmentPatientDropdown');

    if (searchInput && dropdown) {
        // Use debounce to avoid too many updates while typing
        searchInput.addEventListener('input', debounce((e) => {
            const value = e.target.value;
            if (value.length === 0) {
                clearSelectedPatient();
            }
            filterPatientsForAppointment(value);
        }, 200));

        // Load patients when focused
        searchInput.addEventListener('focus', async () => {
            if (!allPatients.length) {
                await loadPatients();
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // Handle keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            handleAutocompleteKeydown(e);
        });

        // Enhanced selection validation when input changes
        searchInput.addEventListener('blur', () => {
            const currentValue = searchInput.value.trim();
            if (currentValue) {
                // Try to auto-select if exact match found
                if (!validateAndSelectExactMatch(currentValue)) {
                    // If no exact match and not empty, clear selection
                    clearSelectedPatient();
                }
            }
        });

        // Real-time validation during typing
        searchInput.addEventListener('input', () => {
            const currentValue = searchInput.value.trim();
            if (currentValue === '') {
                clearSelectedPatient();
            } else {
                // Check for exact match in real-time
                validateAndSelectExactMatch(currentValue);
            }
        });
    }
}

function handleAutocompleteKeydown(e) {
    const dropdown = document.getElementById('appointmentPatientDropdown');
    if (!dropdown || !dropdown.classList.contains('show')) return;

    const items = dropdown.querySelectorAll('.autocomplete-item');
    let highlighted = dropdown.querySelector('.autocomplete-item.highlighted');

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (!highlighted) {
                items[0]?.classList.add('highlighted');
            } else {
                highlighted.classList.remove('highlighted');
                const next = highlighted.nextElementSibling || items[0];
                next.classList.add('highlighted');
            }
            break;

        case 'ArrowUp':
            e.preventDefault();
            if (!highlighted) {
                items[items.length - 1]?.classList.add('highlighted');
            } else {
                highlighted.classList.remove('highlighted');
                const prev = highlighted.previousElementSibling || items[items.length - 1];
                prev.classList.add('highlighted');
            }
            break;

        case 'Enter':
            e.preventDefault();
            if (highlighted) {
                selectPatientFromDropdown(highlighted);
            }
            break;

        case 'Escape':
            dropdown.classList.remove('show');
            break;
    }
}

async function loadPatients() {
    try {
        const patients = await apiCall('/api/patients');

        // Store all patients for filtering
        allPatients = patients;

        // Render table and update select options
        renderPatientsTable(patients);
        updatePatientSelectOptions(patients);
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

async function loadAppointments() {
    try {
        const appointments = await apiCall('/api/appointments');
        allAppointments = appointments;
        applyAppointmentFilters();
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

function getAppointmentStatus(appointment) {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);
    const now = new Date();

    if (appointmentDate < now) {
        return 'completed';
    } else if (appointmentDate.toDateString() === now.toDateString()) {
        return 'today';
    } else {
        return 'scheduled';
    }
}

function getAppointmentStatusText(appointment) {
    const status = getAppointmentStatus(appointment);
    switch (status) {
        case 'completed': return 'Completed';
        case 'today': return 'Today';
        case 'scheduled': return 'Scheduled';
        default: return 'Unknown';
    }
}

async function loadReminders() {
    try {
        let remindersEndpoint = '/api/reminders';

        // Use doctor-specific endpoint if user is a doctor
        if (currentUserType === 'doctor' && currentUser?.id) {
            remindersEndpoint = `/api/doctor/${currentUser.id}/reminders`;
        }

        const reminders = await apiCall(remindersEndpoint);
        // Store all reminders for filtering
        allReminders = reminders;
        applyReminderFilters();
        return;
    } catch (error) {
        console.error('Error loading reminders:', error);
    }
}

// Reminder filters and rendering
function applyReminderFilters() {
    let filtered = Array.isArray(allReminders) ? [...allReminders] : [];
    // Filter by explicit date (YYYY-MM-DD)
    const dateVal = document.getElementById('reminderDateFilter').value;
    if (dateVal) {
        const selected = new Date(dateVal);
        filtered = filtered.filter(r => {
            const d = new Date(r.date);
            return d.getFullYear() === selected.getFullYear()
                && d.getMonth() === selected.getMonth()
                && d.getDate() === selected.getDate();
        });
    }
    // Filter by explicit time (HH:MM)
    const timeVal = document.getElementById('reminderTimeFilter').value;
    if (timeVal) filtered = filtered.filter(r => r.time && r.time.startsWith(timeVal));
    // Quick-range filtering (applied only if no explicit date/time filter)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!dateVal && !timeVal) {
        if (currentReminderRange === 'today') {
            filtered = filtered.filter(r => new Date(r.date).toDateString() === now.toDateString());
        } else if (currentReminderRange === 'week') {
            const weekLater = new Date(todayStart);
            weekLater.setDate(weekLater.getDate() + 7);
            filtered = filtered.filter(r => {
                const d = new Date(r.date);
                return d >= todayStart && d < weekLater;
            });
        } else if (currentReminderRange === 'month') {
            filtered = filtered.filter(r => {
                const d = new Date(r.date);
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            });
        }
    }
    // Sort reminders chronologically
    filtered.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    renderReminders(filtered);
}

function setReminderTimeRange(range) {
    currentReminderRange = range;
    document.getElementById('reminderDateFilter').value = '';
    document.getElementById('reminderTimeFilter').value = '';
    applyReminderFilters();
}
// Quick-range filters for appointments
function setAppointmentDateRange(range) {
    currentAppointmentRange = range;
    // Clear explicit filters
    document.getElementById('appointmentDateFilter').value = '';
    document.getElementById('appointmentTimeFilter').value = '';
    applyAppointmentFilters();
}

function clearReminderFilters() {
    currentReminderRange = '';
    document.getElementById('reminderDateFilter').value = '';
    document.getElementById('reminderTimeFilter').value = '';
    applyReminderFilters();
}

function renderReminders(reminders) {
    const container = document.getElementById('remindersList');
    if (reminders.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">No pending reminders</p>';
        return;
    }
    container.innerHTML = reminders.map(reminder => {
        const isUrgent = new Date(`${reminder.date}T${reminder.time}`) <= new Date();
        return `
            <div class="reminder-item ${isUrgent ? 'urgent' : ''}">
                <div class="reminder-content">
                    <h4>${reminder.patientName} - Dr. ${reminder.doctorName}</h4>
                    <p><i class="fas fa-calendar"></i> ${formatDate(reminder.date)} at ${formatTime(reminder.time)}</p>
                    <p><i class="fas fa-clipboard"></i> ${reminder.problem}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ===== DOCTOR DASHBOARD FUNCTIONS =====
async function loadDoctorDashboard() {
    try {
        // Request notification permission for reminders
        requestNotificationPermission();

        // Load doctor statistics
        loadDoctorStats();

        // Load doctor's data
        loadDoctorAppointments();
        loadDoctorPatients();
        loadReminders();

        // Set current date
        const currentDateEl = document.getElementById('currentDate');
        if (currentDateEl) {
            currentDateEl.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Start reminder checking
        startReminderCheck();

    } catch (error) {
        console.error('Error loading doctor dashboard:', error);
    }
}

async function loadDoctorStats() {
    try {
        const stats = await apiCall(`/api/doctor/${currentUser.id}/stats`);

        document.getElementById('todayAppointmentsCount').textContent = stats.todayAppointments || 0;
        document.getElementById('totalPatientsCount').textContent = stats.totalPatients || 0;
        document.getElementById('nextAppointmentTime').textContent = stats.nextAppointmentTime || '--:--';
        // Display pending payments by currency
        const usdEl = document.getElementById('pendingPaymentsUSD');
        const iqdEl = document.getElementById('pendingPaymentsIQD');
        if (usdEl) formatLargeNumber(formatCurrency(stats.pendingPaymentsUSD || 0, 'USD'), usdEl);
        if (iqdEl) formatLargeNumber(formatCurrency(stats.pendingPaymentsIQD || 0, 'IQD'), iqdEl);
    } catch (error) {
        console.error('Error loading doctor stats:', error);
    }
}

async function loadDoctorAppointments() {
    try {
        // Load today's appointments
        const todayAppointments = await apiCall(`/api/doctor/${currentUser.id}/appointments/today`);
        const todayContainer = document.getElementById('todayAppointmentsList');

        if (todayAppointments.length === 0) {
            todayContainer.innerHTML = '<p class="text-center text-secondary">No appointments scheduled for today</p>';
        } else {
            todayContainer.innerHTML = todayAppointments.map(appointment => `
                <div class="timeline-item">
                    <div class="timeline-time">${formatTime(appointment.time)}</div>
                    <div class="timeline-content">
                        <div class="timeline-patient">${appointment.patientName}</div>
                        <div class="timeline-problem">${appointment.problem}</div>
                    </div>
                </div>
            `).join('');
        }

        // Load all appointments
        const allAppointments = await apiCall(`/api/doctor/${currentUser.id}/appointments`);
        const allTableBody = document.getElementById('allAppointmentsTableBody');
        console.log('All doctor appointments:', allAppointments);
        if (allAppointments.length === 0) {
            allTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No appointments found</td></tr>';
        } else {
            allTableBody.innerHTML = allAppointments.map(appointment => `
                <tr>
                    <td>${formatDate(appointment.date)}</td>
                    <td>${formatTime(appointment.time)}</td>
                    <td>${appointment.patientName}</td>
                    <td>${appointment.problem}</td>
                    <td>
                        <span class="payment-status ${appointment.remainingAmount > 0 ? 'partial' : 'paid'}">
                            ${appointment.remainingAmount > 0 ?
                    `${formatCurrency(appointment.remainingAmount, appointment.currency || 'USD')} remaining` :
                    'Paid in full'}
                        </span>
                    </td>
                    <td>
                        <span class="payment-status ${getAppointmentStatus(appointment)}">
                            ${getAppointmentStatusText(appointment)}
                        </span>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading doctor appointments:', error);
    }
}

function renderDoctorPatientsGrid(patients) {
    const container = document.getElementById('patientsGrid');
    if (!container) return;

    if (patients.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">No patients found</p>';
        return;
    }

    container.innerHTML = patients.map(patient => {
        let paymentStatus = '';
        let statusClass = '';

        if (parseFloat(patient.remainingAmount) === 0) {
            paymentStatus = 'Paid in Full';
            statusClass = 'paid';
        } else if (parseFloat(patient.remainingAmount) === parseFloat(patient.totalCost)) {
            paymentStatus = 'Not Paid Yet';
            statusClass = 'pending';
        } else {
            paymentStatus = 'Has Remaining';
            statusClass = 'partial';
        }

        return `
        <div class="patient-card" onclick="showPatientDetails(${patient.id})">
            <div class="patient-header">
                <div class="patient-name">${patient.fullName}</div>
                <span class="payment-status ${statusClass}">
                    ${paymentStatus}
                </span>
            </div>
            <div class="patient-info">
                <p><i class="fas fa-phone"></i> ${patient.phone}</p>
                <p><i class="fas fa-clipboard"></i> ${patient.problem}</p>
                <p><i class="fas fa-dollar-sign"></i> Total: ${formatAmount(patient.totalCost, patient.currency)}</p>
                <p><i class="fas fa-credit-card"></i> Remaining: ${formatAmount(patient.remainingAmount, patient.currency)}</p>
            </div>
        </div>
        `;
    }).join('');
}

async function loadDoctorPatients() {
    try {
        const patients = await apiCall(`/api/doctor/${currentUser.id}/patients`);

        // Store all doctor patients for filtering
        allDoctorPatients = patients;

        renderDoctorPatientsGrid(patients);
    } catch (error) {
        console.error('Error loading doctor patients:', error);
    }
}

async function showPatientDetails(patientId) {
    try {
        const patient = await apiCall(`/api/patients/${patientId}`);
        const appointments = await apiCall(`/api/patients/${patientId}/appointments`);

        // Fill modal with patient data
        document.getElementById('modalPatientName').textContent = patient.fullName;
        document.getElementById('modalPatientPhone').textContent = patient.phone;
        document.getElementById('modalPatientProblem').textContent = patient.problem;
        document.getElementById('modalPatientTotalCost').textContent = formatAmount(patient.totalCost, patient.currency);

        const remainingEl = document.getElementById('modalPatientRemaining');
        remainingEl.textContent = formatAmount(patient.remainingAmount, patient.currency);
        remainingEl.className = `remaining-amount ${patient.remainingAmount > 0 ? 'positive' : 'zero'}`;

        const statusEl = document.getElementById('modalPaymentStatus');
        statusEl.textContent = patient.remainingAmount > 0 ? 'Pending Payment' : 'Paid in Full';
        statusEl.className = `payment-status ${patient.remainingAmount > 0 ? 'partial' : 'paid'}`;

        // Fill appointments
        const appointmentsContainer = document.getElementById('modalPatientAppointments');
        if (appointments.length === 0) {
            appointmentsContainer.innerHTML = '<p class="text-secondary">No upcoming appointments</p>';
        } else {
            appointmentsContainer.innerHTML = appointments.map(appointment => `
                <div class="appointment-item">
                    <div><strong>${formatDate(appointment.date)} at ${formatTime(appointment.time)}</strong></div>
                    <div>Dr. ${appointment.doctorName}</div>
                </div>
            `).join('');
        }

        openModal('patientDetailsModal');
    } catch (error) {
        console.error('Error loading patient details:', error);
    }
}

// ===== MODAL FUNCTIONS =====
function openAddAdminModal() {
    console.log('Opening add admin modal...');
    openModal('addAdminModal');
}

function openAddDoctorModal() {
    openModal('addDoctorModal');
}

function openAddPatientModal() {
    // Load doctors for the select dropdown
    loadDoctors();
    openModal('addPatientModal');
}

function openAddAppointmentModal() {
    // Load patients and doctors for the select dropdowns
    loadPatients();
    loadDoctors();

    // Set minimum date to today
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
    }

    openModal('addAppointmentModal');
}

// ===== NAVIGATION =====
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        const titles = {
            'overview': currentUserType === 'admin' ? 'Dashboard Overview' : 'Doctor Dashboard',
            'admins': 'Manage Admins',
            'doctors': 'Manage Doctors',
            'patients': currentUserType === 'admin' ? 'Manage Patients' : 'My Patients',
            'appointments': 'Manage Appointments',
            'today-appointments': "Today's Schedule",
            'all-appointments': 'All Appointments',
            'reminders': 'Appointment Reminders'
        };
        pageTitle.textContent = titles[sectionId] || 'Dashboard';
    }

    // Refresh reminders display if reminders section is active
    refreshRemindersIfActive();
}

// ===== SEARCH FUNCTIONALITY =====
function setupSearch() {
    const patientSearch = document.getElementById('patientSearch');
    const doctorPatientSearch = document.getElementById('patientSearchDoctor');

    if (patientSearch) {
        patientSearch.addEventListener('input', debounce(searchPatients, 300));
    }

    if (doctorPatientSearch) {
        doctorPatientSearch.addEventListener('input', debounce(searchDoctorPatients, 300));
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function searchPatients() {
    const searchTerm = document.getElementById('patientSearch').value.trim();
    console.log('Search term:', searchTerm); // Debug log

    try {
        if (searchTerm === '') {
            // If search is empty, apply current filters without search
            applyPatientFilters();
            return;
        }

        // Apply all filters including the search term
        applyPatientFilters();
    } catch (error) {
        console.error('Error searching patients:', error);
        showNotification(`Error searching patients: ${error.message}`, 'error');
    }
}

async function searchDoctorPatients() {
    const searchTerm = document.getElementById('patientSearchDoctor').value.trim();

    try {
        if (searchTerm === '') {
            // If search is empty, apply current filters without search
            applyDoctorPatientFilters();
            return;
        }

        // Apply all filters including the search term
        applyDoctorPatientFilters();
    } catch (error) {
        console.error('Error searching doctor patients:', error);
        showNotification('Error searching patients', 'error');
    }
}

// ===== PATIENT FILTERING AND SORTING =====
let allPatients = []; // Store all patients for filtering
let allAppointments = []; // Store all appointments for filtering

// ===== APPOINTMENT FILTERING =====
function applyAppointmentFilters() {
    const doctorFilter = document.getElementById('appointmentDoctorFilter')?.value;
    const dateFilter = document.getElementById('appointmentDateFilter')?.value;
    const timeFilter = document.getElementById('appointmentTimeFilter')?.value;
    let filtered = [...allAppointments];
    if (doctorFilter && doctorFilter !== 'all') {
        filtered = filtered.filter(a => a.doctorId.toString() === doctorFilter);
    }
    if (dateFilter) {
        // Compare by year/month/day using Date objects
        const selected = new Date(dateFilter);
        filtered = filtered.filter(a => {
            const appt = new Date(a.date);
            return appt.getFullYear() === selected.getFullYear()
                && appt.getMonth() === selected.getMonth()
                && appt.getDate() === selected.getDate();
        });
    }
    if (timeFilter) {
        // Normalize both to HH:MM for comparison
        filtered = filtered.filter(a => a.time.startsWith(timeFilter));
    }
    // Quick-range filtering (when no explicit date/time filters)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!dateFilter && !timeFilter && currentAppointmentRange) {
        if (currentAppointmentRange === 'today') {
            filtered = filtered.filter(a => new Date(a.date).toDateString() === now.toDateString());
        } else if (currentAppointmentRange === 'this_week') {
            const weekEnd = new Date(todayStart);
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
            filtered = filtered.filter(a => {
                const d = new Date(a.date);
                return d >= todayStart && d <= weekEnd;
            });
        } else if (currentAppointmentRange === 'next_week') {
            const nextWeekStart = new Date(todayStart);
            nextWeekStart.setDate(nextWeekStart.getDate() + (7 - nextWeekStart.getDay()) + 1);
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
            filtered = filtered.filter(a => {
                const d = new Date(a.date);
                return d >= nextWeekStart && d <= nextWeekEnd;
            });
        } else if (currentAppointmentRange === 'this_month') {
            filtered = filtered.filter(a => {
                const d = new Date(a.date);
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            });
        } else if (currentAppointmentRange === 'next_month') {
            const nextMonth = now.getMonth() + 1;
            const nextMonthStart = new Date(now.getFullYear(), nextMonth, 1);
            const nextMonthEnd = new Date(now.getFullYear(), nextMonth + 1, 0);
            filtered = filtered.filter(a => {
                const d = new Date(a.date);
                return d >= nextMonthStart && d <= nextMonthEnd;
            });
        }
    }
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No appointments found</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(appointment => `
        <tr>
            <td>${appointment.id}</td>
            <td>${appointment.patientName}</td>
            <td>${appointment.doctorName}</td>
            <td>${formatDate(appointment.date)}</td>
            <td>${formatTime(appointment.time)}</td>
            <td>
                <span class="payment-status ${appointment.remainingAmount > 0 ? 'partial' : 'paid'}">
                    ${appointment.remainingAmount > 0 ?
            `${formatCurrency(appointment.remainingAmount, appointment.currency || 'USD')} remaining` :
            'Paid in full'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="editAppointment(${appointment.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="deleteAppointment(${appointment.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function clearAppointmentFilters() {
    const docFilter = document.getElementById('appointmentDoctorFilter');
    const dateFilter = document.getElementById('appointmentDateFilter');
    const timeFilter = document.getElementById('appointmentTimeFilter');
    // Reset quick-range filter
    currentAppointmentRange = '';
    if (docFilter) docFilter.value = 'all';
    if (dateFilter) dateFilter.value = '';
    if (timeFilter) timeFilter.value = '';
    applyAppointmentFilters();
}

function applyPatientFilters() {
    const paymentFilter = document.getElementById('paymentStatusFilter').value;
    const doctorFilter = document.getElementById('patientDoctorFilter')?.value;
    const sortOrder = document.getElementById('sortOrderFilter').value;
    const searchTerm = document.getElementById('patientSearch').value.trim();

    let filteredPatients = [...allPatients];

    // Apply search filter first
    if (searchTerm) {
        filteredPatients = filteredPatients.filter(patient =>
            patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            patient.phone.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Apply payment status filter
    if (paymentFilter === 'paid') {
        filteredPatients = filteredPatients.filter(patient => parseFloat(patient.remainingAmount) === 0);
    } else if (paymentFilter === 'remaining') {
        filteredPatients = filteredPatients.filter(patient => {
            const remaining = parseFloat(patient.remainingAmount);
            const total = parseFloat(patient.totalCost);
            return remaining > 0 && remaining < total;
        });
    } else if (paymentFilter === 'not_paid') {
        filteredPatients = filteredPatients.filter(patient => {
            const remaining = parseFloat(patient.remainingAmount);
            const total = parseFloat(patient.totalCost);
            return remaining === total;
        });
    }

    // Apply doctor filter
    if (doctorFilter && doctorFilter !== 'all') {
        filteredPatients = filteredPatients.filter(p => p.assignedDoctorId?.toString() === doctorFilter);
    }

    // Apply sorting
    switch (sortOrder) {
        case 'id':
            filteredPatients.sort((a, b) => a.id - b.id);
            break;
        case 'name':
            filteredPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
            break;
        case 'doctor':
            filteredPatients.sort((a, b) => (a.doctorName || '').localeCompare(b.doctorName || ''));
            break;
        case 'dollar':
            // Show only USD patients, sorted by name
            filteredPatients = filteredPatients.filter(p => p.currency === 'USD');
            filteredPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
            break;
        case 'dinar':
            // Show only IQD patients, sorted by name
            filteredPatients = filteredPatients.filter(p => p.currency === 'IQD');
            filteredPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
            break;
        case 'remaining_desc':
            filteredPatients.sort((a, b) => parseFloat(b.remainingAmount) - parseFloat(a.remainingAmount));
            break;
        case 'remaining_asc':
            filteredPatients.sort((a, b) => parseFloat(a.remainingAmount) - parseFloat(b.remainingAmount));
            break;
        default:
            filteredPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    // Render the filtered and sorted patients
    renderPatientsTable(filteredPatients);

    // Show filter summary
    showFilterSummary(filteredPatients.length, allPatients.length, paymentFilter, searchTerm);
}

function showFilterSummary(filteredCount, totalCount, paymentFilter, searchTerm) {
    const tbody = document.getElementById('patientsTableBody');
    if (!tbody) return;

    if (filteredCount === 0 && (paymentFilter !== 'all' || searchTerm)) {
        let message = 'No patients found';
        if (searchTerm) {
            message += ` matching "${searchTerm}"`;
        }
        if (paymentFilter === 'paid') {
            message += ' with payments completed';
        } else if (paymentFilter === 'remaining') {
            message += ' with remaining payments';
        } else if (paymentFilter === 'not_paid') {
            message += ' who have not paid yet';
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    ${message}
                </td>
            </tr>
        `;
    }
}

function clearAllPatientFilters() {
    // Clear search
    const searchInput = document.getElementById('patientSearch');
    if (searchInput) searchInput.value = '';

    // Reset filters
    const paymentFilter = document.getElementById('paymentStatusFilter');
    if (paymentFilter) paymentFilter.value = 'all';

    const sortFilter = document.getElementById('sortOrderFilter');
    if (sortFilter) sortFilter.value = 'name';

    // Reload all patients
    loadPatients();
}

// ===== DOCTOR PATIENT FILTERING AND SORTING =====
let allDoctorPatients = []; // Store all doctor patients for filtering

function applyDoctorPatientFilters() {
    const paymentFilter = document.getElementById('doctorPaymentStatusFilter').value;
    const sortOrder = document.getElementById('doctorSortOrderFilter').value;
    const searchTerm = document.getElementById('patientSearchDoctor').value.trim();

    let filteredPatients = [...allDoctorPatients];

    // Apply search filter first
    if (searchTerm) {
        filteredPatients = filteredPatients.filter(patient =>
            patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            patient.phone.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Apply payment status filter
    if (paymentFilter === 'paid') {
        filteredPatients = filteredPatients.filter(patient => parseFloat(patient.remainingAmount) === 0);
    } else if (paymentFilter === 'remaining') {
        filteredPatients = filteredPatients.filter(patient => {
            const remaining = parseFloat(patient.remainingAmount);
            const total = parseFloat(patient.totalCost);
            return remaining > 0 && remaining < total;
        });
    } else if (paymentFilter === 'not_paid') {
        filteredPatients = filteredPatients.filter(patient => {
            const remaining = parseFloat(patient.remainingAmount);
            const total = parseFloat(patient.totalCost);
            return remaining === total;
        });
    }

    // Apply sorting
    switch (sortOrder) {
        case 'id':
            filteredPatients.sort((a, b) => a.id - b.id);
            break;
        case 'name':
            filteredPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
            break;
        case 'remaining_desc':
            filteredPatients.sort((a, b) => parseFloat(b.remainingAmount) - parseFloat(a.remainingAmount));
            break;
        case 'remaining_asc':
            filteredPatients.sort((a, b) => parseFloat(a.remainingAmount) - parseFloat(b.remainingAmount));
            break;
        default:
            filteredPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    // Render the filtered and sorted patients
    renderDoctorPatientsGrid(filteredPatients);

    // Show filter summary for doctor patients
    showDoctorFilterSummary(filteredPatients.length, allDoctorPatients.length, paymentFilter, searchTerm);
}

function showDoctorFilterSummary(filteredCount, totalCount, paymentFilter, searchTerm) {
    const container = document.getElementById('patientsGrid');
    if (!container) return;

    if (filteredCount === 0 && (paymentFilter !== 'all' || searchTerm)) {
        let message = 'No patients found';
        if (searchTerm) {
            message += ` matching "${searchTerm}"`;
        }
        if (paymentFilter === 'paid') {
            message += ' with payments completed';
        } else if (paymentFilter === 'remaining') {
            message += ' with remaining payments';
        } else if (paymentFilter === 'not_paid') {
            message += ' who have not paid yet';
        }

        container.innerHTML = `<p class="text-center text-muted">${message}</p>`;
    }
}

function clearAllDoctorPatientFilters() {
    // Clear search
    const searchInput = document.getElementById('patientSearchDoctor');
    if (searchInput) searchInput.value = '';

    // Reset filters
    const paymentFilter = document.getElementById('doctorPaymentStatusFilter');
    if (paymentFilter) paymentFilter.value = 'all';

    const sortFilter = document.getElementById('doctorSortOrderFilter');
    if (sortFilter) sortFilter.value = 'name';

    // Reload all doctor patients
    loadDoctorPatients();
}

// ===== CLEAR SEARCH FUNCTIONS =====
function clearPatientSearch() {
    const searchInput = document.getElementById('patientSearch');
    if (searchInput) {
        searchInput.value = '';
        applyPatientFilters(); // Apply filters without search term
    }
}

function clearDoctorPatientSearch() {
    const searchInput = document.getElementById('patientSearchDoctor');
    if (searchInput) {
        searchInput.value = '';
        applyDoctorPatientFilters(); // Apply filters without search term
    }
}

// ===== REMINDER SYSTEM =====
let reminderInterval;
let sessionCheckInterval;

function startReminderCheck() {
    // Poll for due reminders frequently (every 15 seconds for doctors, 60s for admins)
    const pollInterval = currentUserType === 'doctor' ? 15000 : 60000;
    reminderInterval = setInterval(checkReminders, pollInterval);
    // Immediately check once on start
    checkReminders();
    // Start session validation every 5 minutes
    startSessionValidation();
}

function startSessionValidation() {
    sessionCheckInterval = setInterval(async () => {
        if (isLoggedIn) {
            try {
                const user = await checkSession();
                if (!user) {
                    // Session expired - redirect to login
                    showNotification('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        logout();
                    }, 2000);
                }
            } catch (error) {
                console.error('Session validation error:', error);
                // Don't logout on network errors
            }
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
}

async function checkReminders() {
    try {
        // Get due reminders - use appropriate endpoint based on user type
        let dueRemindersEndpoint = '/api/reminders/due';

        if (currentUserType === 'doctor' && currentUser?.id) {
            dueRemindersEndpoint = `/api/doctor/${currentUser.id}/reminders/due`;
        }

        const dueReminders = await apiCall(dueRemindersEndpoint);

        // Also refresh the full reminders list for the UI
        await loadReminders();

        // Refresh the reminders display if user is viewing that section
        refreshRemindersIfActive();

        if (dueReminders.length > 0) {
            // Update notification count in sidebar
            const countEl = document.getElementById('notificationCount');
            if (countEl) {
                countEl.textContent = dueReminders.length;
                countEl.style.display = 'inline'; // Make sure it's visible
            }

            // Show browser notification for each new reminder
            dueReminders.forEach(reminder => {
                // Show in-app notification
                showNotification(
                    `Upcoming appointment: ${reminder.patientName} with Dr. ${reminder.doctorName} at ${formatTime(reminder.time)}`,
                    'warning'
                );

                // Show browser notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Zanko Clinic - Appointment Reminder', {
                        body: `${reminder.patientName} has an appointment with Dr. ${reminder.doctorName} at ${formatTime(reminder.time)}`,
                        icon: '/favicon.ico',
                        tag: `reminder-${reminder.id}` // Prevent duplicate notifications
                    });
                }
            });
        } else {
            // No due reminders, hide notification count
            const countEl = document.getElementById('notificationCount');
            if (countEl) {
                countEl.style.display = 'none';
            }
        }

        // Update reminders badge in navigation
        updateRemindersBadge(dueReminders.length);


    } catch (error) {
        console.error('Error checking reminders:', error);
    }
}

// Update the reminders navigation badge
function updateRemindersBadge(count) {
    const reminderNav = document.querySelector('[data-section="reminders"]');
    if (reminderNav) {
        // Remove existing badge
        const existingBadge = reminderNav.querySelector('.nav-badge');
        if (existingBadge) {
            existingBadge.remove();
        }



        // Add new badge if there are reminders
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = count;
            badge.style.cssText = `
                background: #ef4444;
                color: white;
                               border-radius: 50%;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: bold;
                margin-left: 5px;
                min-width: 16px;
                text-align: center;
            `;
            reminderNav.appendChild(badge);
        }
    }
}

// Request notification permission when app loads
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification('Browser notifications enabled for appointment reminders', 'success');
            }
        });
    }
}

// Enhanced function to refresh reminders when the section is active
function refreshRemindersIfActive() {
    const reminderSection = document.getElementById('reminders');
    if (reminderSection && reminderSection.classList.contains('active')) {
        // If user is currently viewing reminders, refresh the display
        loadReminders();
    }
}

// ===== FORM HANDLERS =====
function setupFormHandlers() {
    // Admin login form
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginAdminEmail').value;
            const password = document.getElementById('loginAdminPassword').value;
            const remember = document.getElementById('rememberMeAdmin')?.checked;
            try {
                await login(email, password, 'admin');
                if (remember) {
                    localStorage.setItem('rememberMe', JSON.stringify({ email, password, userType: 'admin' }));
                } else {
                    localStorage.removeItem('rememberMe');
                }
            } catch { }
        });
    }

    // Doctor login form
    const doctorLoginForm = document.getElementById('doctorLoginForm');
    if (doctorLoginForm) {
        doctorLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('doctorEmail').value;
            const password = document.getElementById('doctorPassword').value;
            const remember = document.getElementById('rememberMeDoctor')?.checked;
            try {
                await login(email, password, 'doctor');
                if (remember) {
                    localStorage.setItem('rememberMe', JSON.stringify({ email, password, userType: 'doctor' }));
                } else {
                    localStorage.removeItem('rememberMe');
                }
            } catch { }
        });
    }

    // Add admin form
    const addAdminForm = document.getElementById('addAdminForm');
    if (addAdminForm) {
        addAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                name: document.getElementById('adminName').value,
                email: document.getElementById('adminEmail').value,
                password: document.getElementById('adminPassword').value
            };

            try {
                await apiCall('/api/admins', 'POST', formData);
                showNotification('Admin added successfully!', 'success');
                closeModal('addAdminModal');
                addAdminForm.reset();
                loadAdmins();
                loadAdminStats();
            } catch (error) {
                console.error('Add admin error:', error);
                showNotification(error.message || 'Failed to add admin', 'error');
            }
        });
    }

    // Add doctor form
    const addDoctorForm = document.getElementById('addDoctorForm');
    if (addDoctorForm) {
        addDoctorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                name: document.getElementById('doctorName').value,
                email: document.getElementById('doctorEmail').value,
                password: document.getElementById('doctorPassword').value
            };

            try {
                await apiCall('/api/doctors', 'POST', formData);
                showNotification('Doctor added successfully!', 'success');
                closeModal('addDoctorModal');
                addDoctorForm.reset();
                loadDoctors();
            } catch (error) {
                console.error('Add doctor error:', error);
                showNotification(error.message || 'Failed to add doctor', 'error');
            }
        });
    }

    // Add patient form
    const addPatientForm = document.getElementById('addPatientForm');
    if (addPatientForm) {
        addPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Gather multiple selected cases and include custom 'Other' if provided
            const selectedOptions = Array.from(document.getElementById('patientProblem').selectedOptions).map(o => o.value);
            if (selectedOptions.includes('Other')) {
                const custom = document.getElementById('patientProblemOther').value.trim();
                if (custom) {
                    // Replace 'Other' with custom case text
                    const idx = selectedOptions.indexOf('Other');
                    selectedOptions[idx] = custom;
                }
            }
            const problemValue = selectedOptions.join(', ');
            const formData = {
                fullName: document.getElementById('patientFullName').value,
                phone: document.getElementById('patientPhone').value,
                problem: problemValue,
                assignedDoctorId: document.getElementById('assignedDoctor').value,
                totalCost: parseFloat(document.getElementById('totalCost').value),
                remainingAmount: parseFloat(document.getElementById('remainingAmount').value),
                currency: document.getElementById('patientCurrency').value
            };
            // If Implant is selected, add implant fields
            if (selectedOptions.includes('Implant')) {
                formData.implantBrand = document.getElementById('implantBrand').value;
                formData.implantFormer = document.getElementById('implantFormer').value;
                formData.implantCrownType = document.getElementById('implantCrownType').value;
            }

            try {
                await apiCall('/api/patients', 'POST', formData);
                showNotification('Patient added successfully!', 'success');
                closeModal('addPatientModal');
                addPatientForm.reset();
                loadPatients();
                loadAdminStats();
            } catch (error) {
                console.error('Add patient error:', error);
                showNotification(error.message || 'Failed to add patient', 'error');
            }
        });
    }

    // Add appointment form
    const addAppointmentForm = document.getElementById('addAppointmentForm');
    if (addAppointmentForm) {
        addAppointmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                patientId: document.getElementById('appointmentPatient').value,
                doctorId: document.getElementById('appointmentDoctor').value,
                date: document.getElementById('appointmentDate').value,
                time: document.getElementById('appointmentTime').value
            };

            try {
                await apiCall('/api/appointments', 'POST', formData);
                showNotification('Appointment scheduled successfully!', 'success');
                closeModal('addAppointmentModal');
                addAppointmentForm.reset();
                // Clear search when form is reset
                const searchInput = document.getElementById('appointmentPatientSearch');
                const dropdown = document.getElementById('appointmentPatientDropdown');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.style.borderColor = '';
                    searchInput.style.backgroundColor = '';
                }
                if (dropdown) {
                    dropdown.classList.remove('show');
                }
                clearSelectedPatient();
                loadAppointments();
                loadReminders(); // Reload reminders list
                checkReminders(); // Trigger notifications immediately for due reminders
                // Update dashboard stats based on user type
                if (currentUserType === 'admin') {
                    loadAdminStats();
                } else if (currentUserType === 'doctor') {
                    loadDoctorStats();
                }
            } catch (error) {
                // Error handled in apiCall
            }
        });
    }

    // Edit admin form
    const editAdminForm = document.getElementById('editAdminForm');
    if (editAdminForm) {
        editAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminId = document.getElementById('editAdminId').value;
            const formData = {
                name: document.getElementById('editAdminName').value,
                email: document.getElementById('editAdminEmail').value,
                password: document.getElementById('editAdminPassword').value
            };

            try {
                await apiCall(`/api/admins/${adminId}`, 'PUT', formData);
                showNotification('Admin updated successfully!', 'success');
                closeModal('editAdminModal');
                editAdminForm.reset();
                loadAdmins();
            } catch (error) {
                console.error('Edit admin error:', error);
                showNotification(error.message || 'Failed to update admin', 'error');
            }
        });
    }

    // Edit doctor form
    const editDoctorForm = document.getElementById('editDoctorForm');
    if (editDoctorForm) {
        editDoctorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const doctorId = document.getElementById('editDoctorId').value;
            const formData = {
                name: document.getElementById('editDoctorName').value,
                email: document.getElementById('editDoctorEmail').value,
                password: document.getElementById('editDoctorPassword').value
            };

            try {
                await apiCall(`/api/doctors/${doctorId}`, 'PUT', formData);
                showNotification('Doctor updated successfully!', 'success');
                closeModal('editDoctorModal');
                editDoctorForm.reset();
                loadDoctors();
            } catch (error) {
                console.error('Edit doctor error:', error);
                showNotification(error.message || 'Failed to update doctor', 'error');
            }
        });
    }

    // Edit patient form
    const editPatientForm = document.getElementById('editPatientForm');
    if (editPatientForm) {
        editPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const patientId = document.getElementById('editPatientId').value;
            // Gather multiple selected cases and include custom 'Other' if provided
            const editSelectedOptions = Array.from(document.getElementById('editPatientProblem').selectedOptions).map(o => o.value);
            if (editSelectedOptions.includes('Other')) {
                const customEdit = document.getElementById('editPatientProblemOther').value.trim();
                if (customEdit) {
                    const idx = editSelectedOptions.indexOf('Other');
                    editSelectedOptions[idx] = customEdit;
                }
            }
            const editProblemValue = editSelectedOptions.join(', ');
            const formData = {
                fullName: document.getElementById('editPatientFullName').value,
                phone: document.getElementById('editPatientPhone').value,
                problem: editProblemValue,
                assignedDoctorId: document.getElementById('editAssignedDoctor').value,
                totalCost: parseFloat(document.getElementById('editTotalCost').value),
                remainingAmount: parseFloat(document.getElementById('editRemainingAmount').value),
                currency: document.getElementById('editPatientCurrency').value
            };
            // If Implant is selected, add implant fields
            if (editSelectedOptions.includes('Implant')) {
                formData.implantBrand = document.getElementById('editImplantBrand').value;
                formData.implantFormer = document.getElementById('editImplantFormer').value;
                formData.implantCrownType = document.getElementById('editImplantCrownType').value;
            }

            try {
                await apiCall(`/api/patients/${patientId}`, 'PUT', formData);
                showNotification('Patient updated successfully!', 'success');
                closeModal('editPatientModal');
                editPatientForm.reset();
                loadPatients();
                loadAdminStats();
            } catch (error) {
                console.error('Edit patient error:', error);
                showNotification(error.message || 'Failed to update patient', 'error');
            }
        });
    }

    // Edit appointment form
    const editAppointmentForm = document.getElementById('editAppointmentForm');
    if (editAppointmentForm) {
        editAppointmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const appointmentId = document.getElementById('editAppointmentId').value;
            const formData = {
                patientId: document.getElementById('editAppointmentPatient').value,
                doctorId: document.getElementById('editAppointmentDoctor').value,
                date: document.getElementById('editAppointmentDate').value,
                time: document.getElementById('editAppointmentTime').value
            };

            try {
                await apiCall(`/api/appointments/${appointmentId}`, 'PUT', formData);
                showNotification('Appointment updated successfully!', 'success');
                closeModal('editAppointmentModal');
                editAppointmentForm.reset();
                loadAppointments();
                loadReminders(); // Reload reminders when appointment is updated
                loadAdminStats();
            } catch (error) {
                // Error handled in apiCall
            }
        });
    }

    // Setup appointment patient search
    setupAppointmentPatientSearch();

    // Setup case selection for Add Patient form
    const patientProblemSelect = document.getElementById('patientProblem');
    const patientProblemOtherGroup = document.getElementById('patientProblemOtherGroup');
    const patientProblemOtherInput = document.getElementById('patientProblemOther');
    if (patientProblemSelect && patientProblemOtherGroup) {
        patientProblemSelect.addEventListener('change', () => {
            const selected = Array.from(patientProblemSelect.selectedOptions).map(o => o.value);
            if (selected.includes('Other')) {
                patientProblemOtherGroup.style.display = '';
            } else {
                patientProblemOtherGroup.style.display = 'none';
                if (patientProblemOtherInput) patientProblemOtherInput.value = '';
            }
            // Show/hide implant-specific fields
            handlePatientProblemChange(patientProblemSelect);
        });
    }
    // Setup case selection for Edit Patient form
    const editProblemSelect = document.getElementById('editPatientProblem');
    const editProblemOtherGroup = document.getElementById('editPatientProblemOtherGroup');
    const editProblemOtherInput = document.getElementById('editPatientProblemOther');
    if (editProblemSelect && editProblemOtherGroup) {
        editProblemSelect.addEventListener('change', () => {
            const selected = Array.from(editProblemSelect.selectedOptions).map(o => o.value);
            if (selected.includes('Other')) {
                editProblemOtherGroup.style.display = '';
            } else {
                editProblemOtherGroup.style.display = 'none';
                if (editProblemOtherInput) editProblemOtherInput.value = '';
            }
            // Toggle implant details in Edit Patient form
            handlePatientProblemChange(editProblemSelect);
        });
    }

    // Show implant details when case includes Implant
    function handlePatientProblemChange(selectEl) {
        const selected = Array.from(selectEl.selectedOptions).map(o => o.value);
        const implantDetails = document.querySelectorAll('.implant-details');
        if (selected.includes('Implant')) {
            implantDetails.forEach(el => el.classList.remove('hidden'));
        } else {
            implantDetails.forEach(el => el.classList.add('hidden'));
        }
    }
}

// ===== CRUD OPERATIONS =====
async function deleteAdmin(id) {
    if (confirm('Are you sure you want to delete this admin? This action cannot be undone.')) {
        try {
            await apiCall(`/api/admins/${id}`, 'DELETE');
            showNotification('Admin deleted successfully!', 'success');
            loadAdmins();
            loadAdminStats();
        } catch (error) {
            console.error('Delete admin error:', error);
            showNotification(error.message || 'Failed to delete admin', 'error');
        }
    }
}

async function deleteDoctor(id) {
    if (confirm('Are you sure you want to delete this doctor?')) {
        try {
            await apiCall(`/api/doctors/${id}`, 'DELETE');
            showNotification('Doctor deleted successfully!', 'success');
            loadDoctors();
            loadAdminStats();
        } catch (error) {
            console.error('Delete doctor error:', error);
            showNotification(error.message || 'Failed to delete doctor', 'error');
        }
    }
}

async function deletePatient(id) {
    if (confirm('Are you sure you want to delete this patient?')) {
        try {
            await apiCall(`/api/patients/${id}`, 'DELETE');
            showNotification('Patient deleted successfully!', 'success');
            loadPatients();
            loadAdminStats();
        } catch (error) {
            console.error('Delete patient error:', error);
            showNotification(error.message || 'Failed to delete patient', 'error');
        }
    }
}

async function deleteAppointment(id) {
    if (confirm('Are you sure you want to delete this appointment?')) {
        try {
            await apiCall(`/api/appointments/${id}`, 'DELETE');
            showNotification('Appointment deleted successfully!', 'success');
            loadAppointments();
            loadReminders(); // Reload reminders when appointment is deleted
            loadAdminStats();
        } catch (error) {
            // Error handled in apiCall
        }
    }
}

// Placeholder functions for edit operations
async function editAdmin(id) {
    try {
        const admin = await apiCall(`/api/admins/${id}`);

        // Fill the edit form with current data
        document.getElementById('editAdminId').value = admin.id;
        document.getElementById('editAdminName').value = admin.name;
        document.getElementById('editAdminEmail').value = admin.email;
        document.getElementById('editAdminPassword').value = ''; // Always empty for security

        openModal('editAdminModal');
    } catch (error) {
        console.error('Error loading admin for edit:', error);
    }
}

async function editDoctor(id) {
    try {
        const doctor = await apiCall(`/api/doctors/${id}`);

        // Fill the edit form with current data
        document.getElementById('editDoctorId').value = doctor.id;
        document.getElementById('editDoctorName').value = doctor.name;
        document.getElementById('editDoctorEmail').value = doctor.email;
        document.getElementById('editDoctorPassword').value = ''; // Always empty for security

        openModal('editDoctorModal');
    } catch (error) {
        console.error('Error loading doctor for edit:', error);
    }
}

async function editPatient(id) {
    // Open the Edit Patient modal immediately
    openModal('editPatientModal');
    try {
        const patient = await apiCall(`/api/patients/${id}`);

        // Load doctors for the dropdown
        await loadDoctors();

        // Fill the edit form with current data
        document.getElementById('editPatientId').value = patient.id;
        document.getElementById('editPatientFullName').value = patient.fullName;
        document.getElementById('editPatientPhone').value = patient.phone;
        // Populate multi-case selection and custom 'Other' input for editing
        const editProblemSelect = document.getElementById('editPatientProblem');
        const editProblemOtherGroup = document.getElementById('editPatientProblemOtherGroup');
        const editProblemOtherInput = document.getElementById('editPatientProblemOther');
        const problems = patient.problem ? patient.problem.split(',').map(s => s.trim()) : [];
        Array.from(editProblemSelect.options).forEach(option => {
            option.selected = problems.includes(option.value);
        });
        // Determine custom cases not in standard options
        const standardValues = Array.from(editProblemSelect.options).map(o => o.value);
        const customValues = problems.filter(v => !standardValues.includes(v));
        if (customValues.length > 0) {
            const otherOption = editProblemSelect.querySelector('option[value="Other"]');
            if (otherOption) otherOption.selected = true;
            editProblemOtherGroup.style.display = '';
            if (editProblemOtherInput) editProblemOtherInput.value = customValues.join(', ');
        } else {
            editProblemOtherGroup.style.display = 'none';
            if (editProblemOtherInput) editProblemOtherInput.value = '';
        }
        document.getElementById('editAssignedDoctor').value = patient.assignedDoctorId || '';
        document.getElementById('editTotalCost').value = patient.totalCost || 0;
        document.getElementById('editRemainingAmount').value = patient.remainingAmount || 0;

        // Set payment status based on current data
        const paymentStatusField = document.getElementById('editPatientPaymentStatus');
        if (parseFloat(patient.remainingAmount) === 0) {
            paymentStatusField.value = 'paid';
        } else if (parseFloat(patient.remainingAmount) === parseFloat(patient.totalCost)) {
            paymentStatusField.value = 'not_paid';
        } else {
            paymentStatusField.value = 'partial';
        }

        // Update the remaining amount field state
        updateEditRemainingAmount();
        // Populate implant-specific fields if present
        const editBrandField = document.getElementById('editImplantBrand');
        const editFormerField = document.getElementById('editImplantFormer');
        const editCrownField = document.getElementById('editImplantCrownType');
        if (patient.implantBrand && editBrandField) editBrandField.value = patient.implantBrand;
        if (patient.implantFormer && editFormerField) editFormerField.value = patient.implantFormer;
        if (patient.implantCrownType && editCrownField) editCrownField.value = patient.implantCrownType;
        // Open Edit Patient modal
        openModal('editPatientModal');
        // Show/hide implant details based on current selection
        try {
            handlePatientProblemChange(editProblemSelect);
        } catch (error) {
            console.error('Error toggling implant fields:', error);
        }
    } catch (error) {
        console.error('Error loading patient for edit:', error);
    }
}

async function editAppointment(id) {
    try {
        const appointment = await apiCall(`/api/appointments/${id}`);

        // Load patients and doctors for the dropdowns
        await loadPatients();
        await loadDoctors();

        // Fill the edit form with current data
        document.getElementById('editAppointmentId').value = appointment.id;
        document.getElementById('editAppointmentPatient').value = appointment.patientId;
        document.getElementById('editAppointmentDoctor').value = appointment.doctorId;
        document.getElementById('editAppointmentDate').value = appointment.date;
        document.getElementById('editAppointmentTime').value = appointment.time;

        openModal('editAppointmentModal');
    } catch (error) {
        console.error('Error loading appointment for edit:', error);
    }
}

// Export Patients Data to XLSX for Excel with Enhanced Styling
function exportPatientsData() {
    if (!allPatients || allPatients.length === 0) {
        showNotification('No patient data to export', 'warning');
        return;
    }

    // Prepare data array with formatted values
    const data = allPatients.map(p => ({
        ID: p.id,
        'Full Name': p.fullName,
        Phone: p.phone,
        Case: p.problem,
        'Assigned Doctor': p.doctorName || 'Unassigned',
        'Total Cost': `${p.currency} ${p.totalCost}`,
        'Remaining Amount': `${p.currency} ${p.remainingAmount}`,
        'Payment Status': p.remainingAmount > 0 ?
            (p.remainingAmount == p.totalCost ? 'Not Paid' : 'Partial') : 'Paid'
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Define border style
    const borderStyle = {
        top: { style: 'thin', color: { rgb: 'FF000000' } },
        bottom: { style: 'thin', color: { rgb: 'FF000000' } },
        left: { style: 'thin', color: { rgb: 'FF000000' } },
        right: { style: 'thin', color: { rgb: 'FF000000' } }
    };

    // Apply styles to all cells
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
            if (!ws[cellAddress]) continue;

            // Initialize cell style if it doesn't exist
            if (!ws[cellAddress].s) ws[cellAddress].s = {};

            // Apply borders to all cells
            ws[cellAddress].s.border = borderStyle;

            // Header row styling (row 0)
            if (R === 0) {
                ws[cellAddress].s.font = { bold: true, color: { rgb: 'FFFFFFFF' }, size: 12 };
                ws[cellAddress].s.fill = { fgColor: { rgb: 'FF2563EB' } }; // Blue background
                ws[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
            } else {
                // Data rows styling
                ws[cellAddress].s.font = { size: 10 };
                ws[cellAddress].s.alignment = { vertical: 'center' };

                // Alternate row colors for better readability
                if (R % 2 === 0) {
                    ws[cellAddress].s.fill = { fgColor: { rgb: 'FFF8FAFC' } }; // Light gray
                } else {
                    ws[cellAddress].s.fill = { fgColor: { rgb: 'FFFFFFFF' } }; // White
                }

                // Special styling for payment status column
                if (C === 7) { // Payment Status column
                    const cellValue = ws[cellAddress].v;
                    if (cellValue === 'Paid') {
                        ws[cellAddress].s.font.color = { rgb: 'FF10B981' }; // Green
                        ws[cellAddress].s.font.bold = true;
                    } else if (cellValue === 'Not Paid') {
                        ws[cellAddress].s.font.color = { rgb: 'FFEF4444' }; // Red
                        ws[cellAddress].s.font.bold = true;
                    } else if (cellValue === 'Partial') {
                        ws[cellAddress].s.font.color = { rgb: 'FFF59E0B' }; // Orange
                        ws[cellAddress].s.font.bold = true;
                    }
                }

                // Center align ID column
                if (C === 0) {
                    ws[cellAddress].s.alignment.horizontal = 'center';
                }

                // Right align monetary columns
                if (C === 5 || C === 6) {
                    ws[cellAddress].s.alignment.horizontal = 'right';
                }
            }
        }
    }

    // Set column widths
    ws['!cols'] = [
        { wch: 6 },   // ID
        { wch: 25 },  // Full Name
        { wch: 15 },  // Phone
        { wch: 25 },  // Case
        { wch: 20 },  // Assigned Doctor
        { wch: 15 },  // Total Cost
        { wch: 18 },  // Remaining Amount
        { wch: 15 }   // Payment Status
    ];

    // Set row heights for better appearance
    ws['!rows'] = [];
    for (let i = 0; i <= range.e.r; i++) {
        ws['!rows'][i] = { hpt: i === 0 ? 25 : 20 }; // Header row taller
    }

    // Create workbook and add worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients Data');

    // Add a second sheet with summary statistics
    const summaryData = [
        { Metric: 'Total Patients', Value: allPatients.length },
        { Metric: 'Patients with USD Currency', Value: allPatients.filter(p => p.currency === 'USD').length },
        { Metric: 'Patients with IQD Currency', Value: allPatients.filter(p => p.currency === 'IQD').length },
        { Metric: 'Fully Paid Patients', Value: allPatients.filter(p => p.remainingAmount == 0).length },
        { Metric: 'Patients with Remaining Balance', Value: allPatients.filter(p => p.remainingAmount > 0).length },
        { Metric: 'Total USD Revenue', Value: `USD ${allPatients.filter(p => p.currency === 'USD').reduce((sum, p) => sum + (parseFloat(p.totalCost) - parseFloat(p.remainingAmount)), 0).toFixed(2)}` },
        { Metric: 'Total IQD Revenue', Value: `IQD ${allPatients.filter(p => p.currency === 'IQD').reduce((sum, p) => sum + (parseFloat(p.totalCost) - parseFloat(p.remainingAmount)), 0).toFixed(2)}` }
    ];

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    const summaryRange = XLSX.utils.decode_range(summaryWs['!ref']);

    // Style summary sheet
    for (let R = summaryRange.s.r; R <= summaryRange.e.r; ++R) {
        for (let C = summaryRange.s.c; C <= summaryRange.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
            if (!summaryWs[cellAddress]) continue;

            if (!summaryWs[cellAddress].s) summaryWs[cellAddress].s = {};
            summaryWs[cellAddress].s.border = borderStyle;

            if (R === 0) {
                summaryWs[cellAddress].s.font = { bold: true, color: { rgb: 'FFFFFFFF' }, size: 12 };
                summaryWs[cellAddress].s.fill = { fgColor: { rgb: 'FF10B981' } }; // Green background
                summaryWs[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
            } else {
                summaryWs[cellAddress].s.font = { size: 11 };
                summaryWs[cellAddress].s.alignment = { vertical: 'center' };
                if (C === 0) {
                    summaryWs[cellAddress].s.font.bold = true;
                }
            }
        }
    }

    summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Write workbook with styles
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });

    // Create blob and trigger download
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Zanko_Clinic_Patients_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`Excel file exported successfully! (${allPatients.length} patients)`, 'success');
}

// ===== TEMPORARY DEBUG FUNCTION =====
// Temporary debug function to check database contents
async function debugCheckDatabase() {
    try {
        const result = await apiCall('/api/debug/users');
        console.log('Current database contents:', result);

        console.log('Admins in database:', result.admins);
        console.log('Doctors in database:', result.doctors);

        showNotification(`Found ${result.admins.length} admins and ${result.doctors.length} doctors in database`, 'info');
    } catch (error) {
        console.error('Debug check failed:', error);
        showNotification('Debug check failed: ' + error.message, 'error');
    }
}

// Add debug button click handler
document.addEventListener('DOMContentLoaded', function () {
    // Create and add a debug button temporarily
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug: Check Database';
    debugButton.className = 'btn btn-secondary';
    debugButton.onclick = debugCheckDatabase;

    // Add it to the admin section header
    const adminSection = document.getElementById('admins');
    if (adminSection) {
        const header = adminSection.querySelector('.section-header');
        if (header) {
            header.appendChild(debugButton);
        }
    }
});

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function () {
    // Setup form handlers
    setupFormHandlers();

    // Setup search functionality
    setupSearch();

    // Setup navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) {
                showSection(section);
            } else if (link.classList.contains('logout-btn')) {
                logout();
            }
        });
    });

    // Setup modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = closeBtn.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            // Prevent closing login modal when clicking outside
            if (modal.id === 'loginModal') return;
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Setup date filter for doctor appointments
    const dateFilter = document.getElementById('appointmentDateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', () => {
            // Filter appointments by date
            loadDoctorAppointments();
        });
    }

    setupActivityTracking();
});

// Setup activity tracking to refresh session
function setupActivityTracking() {
    const activityEvents = ['click', 'keypress', 'scroll', 'mousemove'];
    let lastActivity = Date.now();
    let lastSessionRefresh = Date.now();

    activityEvents.forEach(event => {
        document.addEventListener(event, () => {
            const now = Date.now();
            lastActivity = now;

            // Refresh session if it's been more than 10 minutes since last refresh
            // and user is still active (less than 2 minutes since last activity)
            if (now - lastSessionRefresh > 10 * 60 * 1000 &&
                now - lastActivity < 2 * 60 * 1000 &&
                isLoggedIn) {
                lastSessionRefresh = now;
                // Make a lightweight API call to refresh session
                fetch('http://localhost:3000/api/auth/check', {
                    method: 'GET',
                    credentials: 'include'
                }).catch(() => {
                    // Ignore errors - will be handled by periodic session check
                });
            }
        }, { passive: true });
    });
}

// ===== PAGE-SPECIFIC INITIALIZATION =====
// This will be called based on the current page
if (window.location.pathname.includes('admin.html')) {
    // Admin page specific initialization
    document.addEventListener('DOMContentLoaded', async () => {
        // No automatic session check - let the user log in normally
        // Session will be checked after successful login
    });
} else if (window.location.pathname.includes('doctor.html')) {
    // Doctor page specific initialization
    document.addEventListener('DOMContentLoaded', async () => {
        // No automatic session check - let the user log in normally
        // Session will be checked after successful login
    });
}
