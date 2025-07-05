// ===== IMPORTS =====
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const { pool, testConnection } = require('./config/database');

// ===== APP CONFIGURATION =====
const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET || 'zanko-clinic-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Refresh session on activity
    name: 'zanko.session',
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours (increased from 24 hours for better UX)
        sameSite: 'lax' // Important for cross-origin requests
    }
}));

// ===== DATABASE INITIALIZATION =====
async function initializeDatabase() {
    try {
        // Test connection
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Unable to connect to MySQL database');
        }

        // Create tables if they don't exist
        await createTables();

        // Create default admin if not exists
        await createDefaultAdmin();

        // Create sample data (only if enabled)
        if (process.env.CREATE_SAMPLE_DATA === 'true') {
            await createSampleData();
        } else {
            console.log('ℹ️  Sample data creation disabled (CREATE_SAMPLE_DATA=false)');
        }

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        process.exit(1);
    }
}

async function createTables() {
    const connection = await pool.getConnection();

    try {
        // Doctors table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS doctors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Patients table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fullName VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                problem TEXT NOT NULL,
                assignedDoctorId INT,
                totalCost DECIMAL(10, 2) DEFAULT 0.00,
                remainingAmount DECIMAL(10, 2) DEFAULT 0.00,
                currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                note TEXT,
                implantBrand VARCHAR(255),
                implantFormer VARCHAR(255),
                implantCrownType VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignedDoctorId) REFERENCES doctors(id) ON DELETE SET NULL
            )
        `);
        // --- Patient Note Endpoints ---
        // --- Implant Information Endpoints ---
        // Get implant info
        app.get('/api/patients/:id/implant-info', async (req, res) => {
            const { id } = req.params;
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.execute('SELECT implantBrand, implantFormer, implantCrownType FROM patients WHERE id = ?', [id]);
                if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
                res.json(rows[0]);
            } catch (err) {
                res.status(500).json({ error: 'Failed to fetch implant info' });
            } finally {
                connection.release();
            }
        });

        // Update implant info
        app.post('/api/patients/:id/implant-info', async (req, res) => {
            const { id } = req.params;
            const { implantBrand, implantFormer, implantCrownType } = req.body;
            const connection = await pool.getConnection();
            try {
                await connection.execute('UPDATE patients SET implantBrand = ?, implantFormer = ?, implantCrownType = ? WHERE id = ?', [implantBrand, implantFormer, implantCrownType, id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: 'Failed to update implant info' });
            } finally {
                connection.release();
            }
        });
        // Get patient note
        app.get('/api/patients/:id/note', async (req, res) => {
            const { id } = req.params;
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.execute('SELECT note FROM patients WHERE id = ?', [id]);
                if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
                res.json({ note: rows[0].note || '' });
            } catch (err) {
                res.status(500).json({ error: 'Failed to fetch note' });
            } finally {
                connection.release();
            }
        });

        // Update patient note
        app.post('/api/patients/:id/note', async (req, res) => {
            const { id } = req.params;
            const { note } = req.body;
            const connection = await pool.getConnection();
            try {
                await connection.execute('UPDATE patients SET note = ? WHERE id = ?', [note, id]);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: 'Failed to update note' });
            } finally {
                connection.release();
            }
        });

        // Appointments table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                doctorId INT NOT NULL,
                patientId INT NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                notified TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doctorId) REFERENCES doctors(id) ON DELETE CASCADE,
                FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
            )
        `);

        // Admins table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Orthodontics Schedule table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS orthodontics_schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patientId INT NOT NULL,
                upperSize VARCHAR(100) NOT NULL,
                lowerSize VARCHAR(100) NOT NULL,
                amountPaid DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        try {
            await connection.execute('CREATE INDEX idx_patients_doctor ON patients(assignedDoctorId)');
        } catch (e) { /* Index might already exist */ }

        try {
            await connection.execute('CREATE INDEX idx_appointments_doctor ON appointments(doctorId)');
        } catch (e) { /* Index might already exist */ }

        try {
            await connection.execute('CREATE INDEX idx_appointments_patient ON appointments(patientId)');
        } catch (e) { /* Index might already exist */ }

        try {
            await connection.execute('CREATE INDEX idx_appointments_date ON appointments(date)');
        } catch (e) { /* Index might already exist */ }

        try {
            await connection.execute('CREATE INDEX idx_appointments_notified ON appointments(notified)');
        } catch (e) { /* Index might already exist */ }

        try {
            await connection.execute('CREATE INDEX idx_orthodontics_schedules_patient ON orthodontics_schedules(patientId)');
        } catch (e) { /* Index might already exist */ }

        try {
            await connection.execute('CREATE INDEX idx_orthodontics_schedules_date ON orthodontics_schedules(date)');
        } catch (e) { /* Index might already exist */ }

    } finally {
        connection.release();
    }
}

async function createDefaultAdmin() {
    const connection = await pool.getConnection();

    try {
        const [rows] = await connection.execute(
            'SELECT id FROM admins WHERE email = ?',
            ['admin@zankoclinic.com']
        );

        if (rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);

            await connection.execute(
                'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
                ['Administrator', 'admin@zankoclinic.com', hashedPassword]
            );

            console.log('✅ Default admin created: admin@zankoclinic.com / admin123');
        }
    } catch (error) {
        console.error('❌ Error creating default admin:', error);
    } finally {
        connection.release();
    }
}

async function createSampleData() {
    const connection = await pool.getConnection();

    try {
        console.log('🔧 Creating sample data...');

        // Check if sample doctor exists
        const [doctorRows] = await connection.execute(
            'SELECT id FROM doctors WHERE email = ?',
            ['dr.smith@zankoclinic.com']
        );

        if (doctorRows.length === 0) {
            const doctorPassword = await bcrypt.hash('doctor123', 10);

            const [result] = await connection.execute(
                'INSERT INTO doctors (name, email, password) VALUES (?, ?, ?)',
                ['Dr. Smith', 'dr.smith@zankoclinic.com', doctorPassword]
            );

            const doctorId = result.insertId;
            console.log('✅ Sample doctor created: dr.smith@zankoclinic.com / doctor123');

            // Create sample patients
            await createSamplePatients(connection, doctorId);
            console.log('✅ Sample patients and appointments created');
        } else {
            console.log('ℹ️  Sample doctor already exists, skipping sample data creation');
        }
    } catch (error) {
        console.error('❌ Error creating sample data:', error);
    } finally {
        connection.release();
    }
}

async function createSamplePatients(connection, doctorId) {
    const patients = [
        {
            fullName: 'John Doe',
            phone: '+1-555-0101',
            problem: 'Cleaning',
            totalCost: 150.00,
            remainingAmount: 50.00
        },
        {
            fullName: 'Jane Smith',
            phone: '+1-555-0102',
            problem: 'Root Canal',
            totalCost: 800.00,
            remainingAmount: 0.00
        },
        {
            fullName: 'Mike Johnson',
            phone: '+1-555-0103',
            problem: 'Filling',
            totalCost: 200.00,
            remainingAmount: 100.00
        }
    ];

    for (let i = 0; i < patients.length; i++) {
        const patient = patients[i];

        const [result] = await connection.execute(
            'INSERT INTO patients (fullName, phone, problem, assignedDoctorId, totalCost, remainingAmount, currency) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [patient.fullName, patient.phone, patient.problem, doctorId, patient.totalCost, patient.remainingAmount, 'USD']
        );

        // Create sample appointments for the first patient
        if (i === 0) {
            await createSampleAppointments(connection, doctorId, result.insertId);
        }
    }
}

async function createSampleAppointments(connection, doctorId, patientId) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = [
        {
            date: today.toISOString().split('T')[0],
            time: '14:30:00'
        },
        {
            date: tomorrow.toISOString().split('T')[0],
            time: '10:00:00'
        }
    ];

    for (const appointment of appointments) {
        await connection.execute(
            'INSERT INTO appointments (doctorId, patientId, date, time) VALUES (?, ?, ?, ?)',
            [doctorId, patientId, appointment.date, appointment.time]
        );
    }
}

// ===== AUTHENTICATION MIDDLEWARE =====
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.type === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
}

function requireDoctor(req, res, next) {
    if (req.session.user && req.session.user.type === 'doctor') {
        next();
    } else {
        res.status(403).json({ error: 'Doctor access required' });
    }
}


// ===== AUTHENTICATION ROUTES =====

// Admin login
app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT * FROM admins WHERE email = ?',
                [email]
            );

            if (rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const admin = rows[0];

            const passwordMatch = await bcrypt.compare(password, admin.password);

            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            req.session.user = {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                type: 'admin'
            };

            res.json({
                success: true,
                user: {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Doctor login
app.post('/api/auth/doctor/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT * FROM doctors WHERE email = ?',
                [email]
            );

            if (rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const doctor = rows[0];
            const passwordMatch = await bcrypt.compare(password, doctor.password);

            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            req.session.user = {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email,
                type: 'doctor'
            };

            res.json({
                success: true,
                user: {
                    id: doctor.id,
                    name: doctor.name,
                    email: doctor.email
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Doctor login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true });
    });
});

// Check session validity
app.get('/api/auth/check', (req, res) => {
    if (req.session.user) {
        res.json({
            success: true,
            user: {
                id: req.session.user.id,
                name: req.session.user.name,
                email: req.session.user.email,
                type: req.session.user.type
            }
        });
    } else {
        res.status(401).json({ error: 'No active session' });
    }
});

// ===== ADMIN ROUTES =====

// Get admin statistics
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const stats = {};

            // Get total admins
            const [adminRows] = await connection.execute('SELECT COUNT(*) as count FROM admins');
            stats.totalAdmins = adminRows[0].count;

            // Get total doctors
            const [doctorRows] = await connection.execute('SELECT COUNT(*) as count FROM doctors');
            stats.totalDoctors = doctorRows[0].count;

            // Get total patients
            const [patientRows] = await connection.execute('SELECT COUNT(*) as count FROM patients');
            stats.totalPatients = patientRows[0].count;

            // Get today's appointments
            const today = new Date().toISOString().split('T')[0];
            const [appointmentRows] = await connection.execute(
                'SELECT COUNT(*) as count FROM appointments WHERE date = ?', [today]
            );
            stats.todayAppointments = appointmentRows[0].count;

            // Compute revenue broken out by currency
            const [revenueRows] = await connection.execute(
                `SELECT
                    SUM(CASE WHEN currency = 'USD' THEN (totalCost - remainingAmount) ELSE 0 END) AS usdRevenue,
                    SUM(CASE WHEN currency = 'IQD' THEN (totalCost - remainingAmount) ELSE 0 END) AS iqdRevenue
                  FROM patients`
            );
            stats.usdRevenue = revenueRows[0].usdRevenue || 0;
            stats.iqdRevenue = revenueRows[0].iqdRevenue || 0;

            // Return both currency revenues
            res.json({
                totalAdmins: stats.totalAdmins,
                totalDoctors: stats.totalDoctors,
                totalPatients: stats.totalPatients,
                todayAppointments: stats.todayAppointments,
                usdRevenue: stats.usdRevenue,
                iqdRevenue: stats.iqdRevenue
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Debug endpoint to check current admins and doctors
app.get('/api/debug/users', requireAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [admins] = await connection.execute('SELECT id, name, email FROM admins');
            const [doctors] = await connection.execute('SELECT id, name, email FROM doctors');

            res.json({
                admins: admins,
                doctors: doctors,
                message: 'Current users in database'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching debug users:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Temporary public debug endpoint (remove after debugging)
app.get('/api/debug/check-emails/:email', async (req, res) => {
    const { email } = req.params;
    console.log('Checking email:', email);

    try {
        const connection = await pool.getConnection();

        try {
            const [admins] = await connection.execute(
                'SELECT id, email FROM admins WHERE LOWER(email) = LOWER(?)',
                [email]
            );
            const [doctors] = await connection.execute(
                'SELECT id, email FROM doctors WHERE LOWER(email) = LOWER(?)',
                [email]
            );

            console.log('Found admins with this email:', admins);
            console.log('Found doctors with this email:', doctors);

            res.json({
                email: email,
                foundInAdmins: admins,
                foundInDoctors: doctors,
                totalFound: admins.length + doctors.length
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error checking email:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== DOCTORS ROUTES =====

// Get all doctors
app.get('/api/doctors', requireAuth, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT id, name, email, created_at FROM doctors ORDER BY name'
            );
            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctors:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get doctor by ID
app.get('/api/doctors/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT id, name, email, created_at FROM doctors WHERE id = ?',
                [id]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            res.json(rows[0]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add new doctor
app.post('/api/doctors', requireAdmin, async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const [result] = await connection.execute(
                'INSERT INTO doctors (name, email, password) VALUES (?, ?, ?)',
                [name, email, hashedPassword]
            );

            res.json({
                success: true,
                doctor: {
                    id: result.insertId,
                    name,
                    email
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error('Error creating doctor:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete doctor
app.delete('/api/doctors/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'DELETE FROM doctors WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Edit doctor
app.put('/api/doctors/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            if (password && password.trim() !== '') {
                // Update with new password
                const hashedPassword = await bcrypt.hash(password, 10);

                const [result] = await connection.execute(
                    'UPDATE doctors SET name = ?, email = ?, password = ? WHERE id = ?',
                    [name, email, hashedPassword, id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Doctor not found' });
                }
            } else {
                // Update without changing password
                const [result] = await connection.execute(
                    'UPDATE doctors SET name = ?, email = ? WHERE id = ?',
                    [name, email, id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Doctor not found' });
                }
            }

            res.json({ success: true, message: 'Doctor updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error('Error updating doctor:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== ADMINS ROUTES =====

// Get all admins
app.get('/api/admins', requireAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT id, name, email, created_at
                FROM admins
                ORDER BY name
            `);
            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting admins:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get specific admin
app.get('/api/admins/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT id, name, email, created_at FROM admins WHERE id = ?',
                [id]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Admin not found' });
            }

            res.json(rows[0]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting admin:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add admin
app.post('/api/admins', requireAdmin, async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Check if email already exists (case insensitive)
            const [existingAdmin] = await connection.execute(
                'SELECT id, email FROM admins WHERE LOWER(email) = LOWER(?)',
                [email]
            );

            if (existingAdmin.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            // Also check if email exists in doctors table
            const [existingDoctor] = await connection.execute(
                'SELECT id, email FROM doctors WHERE LOWER(email) = LOWER(?)',
                [email]
            );

            if (existingDoctor.length > 0) {
                return res.status(400).json({ error: 'Email already exists in doctors' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const [result] = await connection.execute(
                'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
                [name, email.toLowerCase(), hashedPassword]
            );

            res.status(201).json({
                success: true,
                message: 'Admin added successfully',
                adminId: result.insertId
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adding admin:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete admin
app.delete('/api/admins/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Check if this is the last admin
            const [adminCount] = await connection.execute('SELECT COUNT(*) as count FROM admins');
            if (adminCount[0].count <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last admin account' });
            }

            const [result] = await connection.execute('DELETE FROM admins WHERE id = ?', [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Admin not found' });
            }

            res.json({ success: true, message: 'Admin deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update admin
app.put('/api/admins/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            // Check if email already exists for another admin (case insensitive)
            const [existingAdmin] = await connection.execute(
                'SELECT id FROM admins WHERE LOWER(email) = LOWER(?) AND id != ?',
                [email, id]
            );

            if (existingAdmin.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            // Also check if email exists in doctors table
            const [existingDoctor] = await connection.execute(
                'SELECT id FROM doctors WHERE LOWER(email) = LOWER(?)',
                [email]
            );

            if (existingDoctor.length > 0) {
                return res.status(400).json({ error: 'Email already exists in doctors' });
            }

            if (password && password.trim() !== '') {
                // Update with new password
                const hashedPassword = await bcrypt.hash(password, 10);

                const [result] = await connection.execute(
                    'UPDATE admins SET name = ?, email = ?, password = ? WHERE id = ?',
                    [name, email.toLowerCase(), hashedPassword, id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Admin not found' });
                }
            } else {
                // Update without changing password
                const [result] = await connection.execute(
                    'UPDATE admins SET name = ?, email = ? WHERE id = ?',
                    [name, email.toLowerCase(), id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Admin not found' });
                }
            }

            res.json({ success: true, message: 'Admin updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating admin:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== PATIENTS ROUTES =====

// Get all patients
app.get('/api/patients', requireAuth, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT p.*, d.name as doctorName
                FROM patients p
                LEFT JOIN doctors d ON p.assignedDoctorId = d.id
                ORDER BY p.fullName
            `);
            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting patients:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Search patients
app.get('/api/patients/search', requireAuth, async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.json([]);
    }

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT p.*, d.name as doctorName
                FROM patients p
                LEFT JOIN doctors d ON p.assignedDoctorId = d.id
                WHERE p.fullName LIKE ? OR p.phone LIKE ?
                ORDER BY p.fullName
            `, [`%${q}%`, `%${q}%`]);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error searching patients:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get patient by ID
app.get('/api/patients/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT p.*, d.name as doctorName
                FROM patients p
                LEFT JOIN doctors d ON p.assignedDoctorId = d.id
                WHERE p.id = ?
            `, [id]);

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            res.json(rows[0]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting patient:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add new patient
app.post('/api/patients', requireAdmin, async (req, res) => {
    const { fullName, phone, problem, assignedDoctorId, totalCost, remainingAmount, currency, implantBrand, implantFormer, implantCrownType } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            // Insert implant fields if present
            const fields = ['fullName', 'phone', 'problem', 'assignedDoctorId', 'totalCost', 'remainingAmount', 'currency'];
            const values = [fullName, phone, problem, assignedDoctorId, totalCost, remainingAmount, currency];
            if (implantBrand !== undefined) {
                fields.push('implantBrand');
                values.push(implantBrand);
            }
            if (implantFormer !== undefined) {
                fields.push('implantFormer');
                values.push(implantFormer);
            }
            if (implantCrownType !== undefined) {
                fields.push('implantCrownType');
                values.push(implantCrownType);
            }
            const placeholders = fields.map(() => '?').join(', ');
            const [result] = await connection.execute(
                `INSERT INTO patients (${fields.join(', ')}) VALUES (${placeholders})`,
                values
            );
            res.json({
                success: true,
                patient: {
                    id: result.insertId,
                    fullName,
                    phone,
                    problem,
                    assignedDoctorId,
                    totalCost,
                    remainingAmount,
                    currency,
                    implantBrand,
                    implantFormer,
                    implantCrownType
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creating patient:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete patient
app.delete('/api/patients/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'DELETE FROM patients WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Edit patient
app.put('/api/patients/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { fullName, phone, problem, assignedDoctorId, totalCost, remainingAmount, currency, implantBrand, implantFormer, implantCrownType } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            // Update implant fields if present, otherwise leave unchanged
            const updateFields = [
                'fullName = ?',
                'phone = ?',
                'problem = ?',
                'assignedDoctorId = ?',
                'totalCost = ?',
                'remainingAmount = ?',
                'currency = ?'
            ];
            const updateValues = [fullName, phone, problem, assignedDoctorId, totalCost, remainingAmount, currency];
            if (implantBrand !== undefined) {
                updateFields.push('implantBrand = ?');
                updateValues.push(implantBrand);
            }
            if (implantFormer !== undefined) {
                updateFields.push('implantFormer = ?');
                updateValues.push(implantFormer);
            }
            if (implantCrownType !== undefined) {
                updateFields.push('implantCrownType = ?');
                updateValues.push(implantCrownType);
            }
            updateValues.push(id);
            const [result] = await connection.execute(
                `UPDATE patients SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Patient not found' });
            }
            res.json({ success: true, message: 'Patient updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get patient appointments
app.get('/api/patients/:id/appointments', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                WHERE a.patientId = ?
                AND a.date >= CURDATE()
                ORDER BY a.date, a.time
            `, [id]);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting patient appointments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== APPOINTMENTS ROUTES =====

// Get all appointments
app.get('/api/appointments', requireAuth, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                ORDER BY a.date DESC, a.time DESC
            `);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting appointments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get appointment by ID
app.get('/api/appointments/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                WHERE a.id = ?
            `, [id]);

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json(rows[0]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting appointment:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add new appointment
app.post('/api/appointments', requireAdmin, async (req, res) => {
    const { patientId, doctorId, date, time } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'INSERT INTO appointments (patientId, doctorId, date, time) VALUES (?, ?, ?, ?)',
                [patientId, doctorId, date, time]
            );

            res.json({
                success: true,
                appointment: {
                    id: result.insertId,
                    patientId,
                    doctorId,
                    date,
                    time
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete appointment
app.delete('/api/appointments/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'DELETE FROM appointments WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Edit appointment
app.put('/api/appointments/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { patientId, doctorId, date, time } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'UPDATE appointments SET patientId = ?, doctorId = ?, date = ?, time = ?, notified = 0 WHERE id = ?',
                [patientId, doctorId, date, time, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json({ success: true, message: 'Appointment updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== DOCTOR-SPECIFIC ROUTES =====

// Get doctor statistics
app.get('/api/doctor/:id/stats', requireAuth, async (req, res) => {
    const { id } = req.params;

    // Verify doctor can only access their own data
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            const stats = {};
            const today = new Date().toISOString().split('T')[0];

            // Get today's appointments count
            const [todayRows] = await connection.execute(
                'SELECT COUNT(*) as count FROM appointments WHERE doctorId = ? AND date = ?',
                [id, today]
            );
            stats.todayAppointments = todayRows[0].count;

            // Get total patients count
            const [patientRows] = await connection.execute(
                'SELECT COUNT(*) as count FROM patients WHERE assignedDoctorId = ?',
                [id]
            );
            stats.totalPatients = patientRows[0].count;

            // Get next appointment time
            const [nextRows] = await connection.execute(`
                SELECT time FROM appointments
                WHERE doctorId = ? AND date = ? AND time > CURTIME()
                ORDER BY time LIMIT 1
            `, [id, today]);
            stats.nextAppointmentTime = nextRows.length > 0 ? formatTime(nextRows[0].time) : '--:--';

            // Get pending payments per currency
            const [pendingUSDRows] = await connection.execute(
                'SELECT SUM(remainingAmount) as pending FROM patients WHERE assignedDoctorId = ? AND currency = ?',
                [id, 'USD']
            );
            stats.pendingPaymentsUSD = pendingUSDRows[0].pending || 0;
            const [pendingIQDRows] = await connection.execute(
                'SELECT SUM(remainingAmount) as pending FROM patients WHERE assignedDoctorId = ? AND currency = ?',
                [id, 'IQD']
            );
            stats.pendingPaymentsIQD = pendingIQDRows[0].pending || 0;

            res.json(stats);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor stats:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get doctor's today appointments
app.get('/api/doctor/:id/appointments/today', requireAuth, async (req, res) => {
    const { id } = req.params;

    // Verify doctor can only access their own data
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            const today = new Date().toISOString().split('T')[0];

            const [rows] = await connection.execute(`
                SELECT a.*, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN patients p ON a.patientId = p.id
                WHERE a.doctorId = ? AND a.date = ?
                ORDER BY a.time
            `, [id, today]);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor today appointments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get doctor's all appointments
app.get('/api/doctor/:id/appointments', requireAuth, async (req, res) => {
    const { id } = req.params;

    // Verify doctor can only access their own data
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT a.*, p.fullName as patientName, p.problem, p.remainingAmount
                FROM appointments a
                JOIN patients p ON a.patientId = p.id
                WHERE a.doctorId = ?
                ORDER BY a.date DESC, a.time DESC
            `, [id]);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor appointments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get doctor's patients
app.get('/api/doctor/:id/patients', requireAuth, async (req, res) => {
    const { id } = req.params;

    // Verify doctor can only access their own data
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT * FROM patients WHERE assignedDoctorId = ? ORDER BY fullName',
                [id]
            );

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor patients:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Search doctor's patients
app.get('/api/doctor/:id/patients/search', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { q } = req.query;

    // Verify doctor can only access their own data
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (!q) {
        return res.json([]);
    }

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT * FROM patients WHERE assignedDoctorId = ? AND (fullName LIKE ? OR phone LIKE ?) ORDER BY fullName',
                [id, `%${q}%`, `%${q}%`]
            );

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error searching doctor patients:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== REMINDERS ROUTES =====

// Get all reminders
app.get('/api/reminders', requireAuth, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                WHERE a.date >= CURDATE()
                ORDER BY a.date, a.time
            `);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting reminders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get due reminders
app.get('/api/reminders/due', requireAuth, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 8);

            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                WHERE ((a.date = ? AND a.time <= ? AND a.notified = 0)
                OR (a.date < ? AND a.notified = 0))
            `, [currentDate, currentTime, currentDate]);

            // Mark as notified
            if (rows.length > 0) {
                const ids = rows.map(row => row.id);
                const placeholders = ids.map(() => '?').join(',');

                await connection.execute(
                    `UPDATE appointments SET notified = 1 WHERE id IN (${placeholders})`,
                    ids
                );
            }

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting due reminders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get doctor's reminders
app.get('/api/doctor/:id/reminders', requireAuth, async (req, res) => {
    const { id } = req.params;

    // Verify doctor can only access their own reminders
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                WHERE a.doctorId = ? AND a.date >= CURDATE()
                ORDER BY a.date, a.time
            `, [id]);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor reminders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get doctor's due reminders
app.get('/api/doctor/:id/reminders/due', requireAuth, async (req, res) => {
    const { id } = req.params;

    // Verify doctor can only access their own reminders
    if (req.session.user.type === 'doctor' && req.session.user.id != id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 8);

            const [rows] = await connection.execute(`
                SELECT a.*, d.name as doctorName, p.fullName as patientName, p.problem
                FROM appointments a
                JOIN doctors d ON a.doctorId = d.id
                JOIN patients p ON a.patientId = p.id
                WHERE a.doctorId = ? AND ((a.date = ? AND a.time <= ? AND a.notified = 0)
                OR (a.date < ? AND a.notified = 0))
            `, [id, currentDate, currentTime, currentDate]);

            // Mark as notified for this doctor's appointments
            if (rows.length > 0) {
                const ids = rows.map(row => row.id);
                const placeholders = ids.map(() => '?').join(',');

                await connection.execute(
                    `UPDATE appointments SET notified = 1 WHERE id IN (${placeholders})`,
                    ids
                );
            }

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting doctor due reminders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== ORTHODONTICS SCHEDULE ENDPOINTS =====

// Get orthodontics schedule for a patient
app.get('/api/patients/:patientId/orthodontics-schedule', requireAuth, async (req, res) => {
    const { patientId } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(`
                SELECT * FROM orthodontics_schedules
                WHERE patientId = ?
                ORDER BY date DESC, created_at DESC
            `, [patientId]);

            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error getting orthodontics schedule:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add orthodontics schedule entry
app.post('/api/patients/:patientId/orthodontics-schedule', requireAdmin, async (req, res) => {
    const { patientId } = req.params;
    const { upperSize, lowerSize, amountPaid, currency, date } = req.body;

    // Validate required fields
    if (!upperSize || !lowerSize || !amountPaid || !currency || !date) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate amount is a positive number
    if (isNaN(amountPaid) || parseFloat(amountPaid) < 0) {
        return res.status(400).json({ error: 'Amount paid must be a positive number' });
    }

    // Validate currency
    if (!['USD', 'IQD'].includes(currency)) {
        return res.status(400).json({ error: 'Currency must be USD or IQD' });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Check if patient exists
            const [patientRows] = await connection.execute(
                'SELECT id FROM patients WHERE id = ?',
                [patientId]
            );

            if (patientRows.length === 0) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            // Insert orthodontics schedule entry
            const [result] = await connection.execute(`
                INSERT INTO orthodontics_schedules (patientId, upperSize, lowerSize, amountPaid, currency, date)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [patientId, upperSize, lowerSize, parseFloat(amountPaid), currency, date]);

            // Get the created entry
            const [newEntry] = await connection.execute(
                'SELECT * FROM orthodontics_schedules WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json(newEntry[0]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adding orthodontics schedule entry:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update orthodontics schedule entry
app.put('/api/orthodontics-schedule/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { upperSize, lowerSize, amountPaid, currency, date } = req.body;

    // Validate required fields
    if (!upperSize || !lowerSize || !amountPaid || !currency || !date) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate amount is a positive number
    if (isNaN(amountPaid) || parseFloat(amountPaid) < 0) {
        return res.status(400).json({ error: 'Amount paid must be a positive number' });
    }

    // Validate currency
    if (!['USD', 'IQD'].includes(currency)) {
        return res.status(400).json({ error: 'Currency must be USD or IQD' });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Check if entry exists
            const [existingRows] = await connection.execute(
                'SELECT id FROM orthodontics_schedules WHERE id = ?',
                [id]
            );

            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Orthodontics schedule entry not found' });
            }

            // Update the entry
            await connection.execute(`
                UPDATE orthodontics_schedules
                SET upperSize = ?, lowerSize = ?, amountPaid = ?, currency = ?, date = ?
                WHERE id = ?
            `, [upperSize, lowerSize, parseFloat(amountPaid), currency, date, id]);

            // Get the updated entry
            const [updatedEntry] = await connection.execute(
                'SELECT * FROM orthodontics_schedules WHERE id = ?',
                [id]
            );

            res.json(updatedEntry[0]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating orthodontics schedule entry:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete orthodontics schedule entry
app.delete('/api/orthodontics-schedule/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();

        try {
            // Check if entry exists
            const [existingRows] = await connection.execute(
                'SELECT id FROM orthodontics_schedules WHERE id = ?',
                [id]
            );

            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Orthodontics schedule entry not found' });
            }

            // Delete the entry
            await connection.execute(
                'DELETE FROM orthodontics_schedules WHERE id = ?',
                [id]
            );

            res.json({ message: 'Orthodontics schedule entry deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting orthodontics schedule entry:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===== UTILITY FUNCTIONS =====
function formatTime(timeString) {
    if (!timeString) return '--:--';

    // If it's already in HH:MM format, return as is
    if (timeString.length === 5) return timeString;

    // If it's in HH:MM:SS format, extract HH:MM
    if (timeString.length === 8) return timeString.substring(0, 5);

    return timeString;
}

// ===== REMINDER CRON JOB =====
cron.schedule('* * * * *', () => {
    // This runs every minute to check for due reminders
    // The actual reminder checking is handled by the client calling /api/reminders/due
    console.log('Reminder check cycle completed at', new Date().toISOString());
});

// ===== STATIC FILE SERVING =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/doctor', (req, res) => {
    res.sendFile(path.join(__dirname, 'doctor.html'));
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// ===== START SERVER =====
async function startServer() {
    try {
        // Initialize database first
        await initializeDatabase();

        // Start the server
        app.listen(PORT, () => {
            console.log(`🦷 Zanko Cleaning Clinic Management System`);
            console.log(`🌐 Server running on http://localhost:${PORT}`);
            console.log(`📋 Admin Login: admin@zankoclinic.com / admin123`);
            if (process.env.CREATE_SAMPLE_DATA === 'true') {
                console.log(`👨‍⚕️ Doctor Login: dr.smith@zankoclinic.com / doctor123`);
            }
            console.log(`⏰ Reminder system active - checking every minute`);
            console.log(`🗄️  Database: MySQL (${process.env.DB_NAME || 'zanko_clinic'})`);
            console.log(`📊 Sample Data: ${process.env.CREATE_SAMPLE_DATA === 'true' ? 'Enabled' : 'Disabled'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    try {
        await pool.end();
        console.log('✅ Database connection pool closed');
    } catch (error) {
        console.error('❌ Error closing database pool:', error);
    }
    process.exit(0);
});

// Start the server
startServer();
