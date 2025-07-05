-- ===== ZANKO CLINIC DATABASE SCHEMA FOR MYSQL =====

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS zanko_clinic;
USE zanko_clinic;

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS orthodontics_schedules;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS admins;

-- Doctors table
CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    problem TEXT NOT NULL,
    assignedDoctorId INT,
    totalCost DECIMAL(10, 2) DEFAULT 0.00,
    remainingAmount DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignedDoctorId) REFERENCES doctors(id) ON DELETE SET NULL
);

-- Appointments table
CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctorId INT NOT NULL,
    patientId INT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    notified TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctorId) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
);

-- Admins table
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orthodontics Schedules table
CREATE TABLE orthodontics_schedules (
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
);

-- Add indexes for better performance
CREATE INDEX idx_patients_doctor ON patients(assignedDoctorId);
CREATE INDEX idx_appointments_doctor ON appointments(doctorId);
CREATE INDEX idx_appointments_patient ON appointments(patientId);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_notified ON appointments(notified);

SHOW TABLES;
