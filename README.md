# 🦷 Zanko Cleaning - Dental Clinic Management System

A modern, comprehensive web-based management system for dental clinics. Built for internal use by administrators and doctors to efficiently manage patients, appointments, and payments.

## ✨ Features

### 🔐 **Dual Authentication System**
- **Administrator Access**: Complete system management
- **Doctor Access**: Personal appointment and patient management

### 👨‍💼 **Admin Dashboard**
- Manage doctors (add, edit, delete)
- Manage patients (add, edit, delete, search)
- Schedule and manage appointments
- Manual payment tracking (total cost, remaining amount)
- Real-time appointment reminders
- Comprehensive statistics and analytics

### 👨‍⚕️ **Doctor Dashboard**
- Personal appointment schedule
- Today's appointments highlighted
- Patient management (view-only)
- Payment status monitoring
- Real-time reminder notifications

### 🔔 **Smart Reminder System**
- Automatic appointment reminders using node-cron
- Runs every minute for 100% reliability
- Prevents duplicate notifications
- Real-time notifications for both admin and doctors

### 📱 **Mobile-First Design**
- Fully responsive design
- Smooth animations and transitions
- Touch-friendly interface
- Modern UI/UX with professional styling

## 🛠 Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js + Express.js
- **Database**: MySQL (8.0+)
- **Authentication**: bcrypt + express-session
- **Scheduling**: node-cron for reliable reminders
- **Environment**: dotenv for configuration
- **Styling**: Custom CSS with CSS Grid and Flexbox

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm (Node Package Manager)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ZKCLINING
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
#### Create MySQL Database
```sql
mysql -u root -p
CREATE DATABASE zanko_clinic;
USE zanko_clinic;
```

#### Run the Schema
Execute the SQL commands from `database/schema.sql` or run the table creation commands manually.

### 4. Environment Configuration
Copy and configure the environment file:
```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=zanko_clinic
DB_PORT=3306

# Sample Data Configuration
# Set to 'true' for initial setup or development
# Set to 'false' in production to prevent sample data recreation
CREATE_SAMPLE_DATA=false
```

### 5. Start the Application
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

### 6. Access the Application
- Open your browser and navigate to: `http://localhost:3000`
- The application will automatically create default admin account on first run
- Sample data (Dr. Smith and patients) will only be created if `CREATE_SAMPLE_DATA=true` in your `.env` file

## 🔑 Default Login Credentials

### Administrator
- **Email**: `admin@zankoclinic.com`
- **Password**: `admin123`

### Sample Doctor
- **Email**: `dr.smith@zankoclinic.com`
- **Password**: `doctor123`
- **Note**: Only available if `CREATE_SAMPLE_DATA=true` in your `.env` file

## 🧪 Sample Data Configuration

The system includes optional sample data (Dr. Smith and sample patients) for development and testing:

- **For initial setup or development**: Set `CREATE_SAMPLE_DATA=true` in your `.env` file
- **For production use**: Set `CREATE_SAMPLE_DATA=false` to prevent sample data recreation
- **Important**: Once you delete sample data (like Dr. Smith), keep this setting as `false` to prevent it from reappearing on server restart

## 📊 Database Schema

The application uses MySQL with the following tables:

### `doctors`
```sql
CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `patients`
```sql
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    problem TEXT NOT NULL,
    assignedDoctorId INT,
    totalCost DECIMAL(10, 2) DEFAULT 0.00,
    remainingAmount DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignedDoctorId) REFERENCES doctors(id) ON DELETE SET NULL
);
```

### `appointments`
```sql
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
```

### `admins`
```sql
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🏥 Sample Data

The application comes with pre-populated sample data:

### Sample Patients
- **John Doe** - Cleaning ($150 total, $50 remaining)
- **Jane Smith** - Root Canal ($800 total, $0 remaining)
- **Mike Johnson** - Filling ($200 total, $100 remaining)

### Sample Appointments
- Today and tomorrow appointments for testing the reminder system

## 📱 Usage Guide

### For Administrators

1. **Login**: Use admin credentials to access the admin dashboard
2. **Manage Doctors**: Add new doctors with email and password
3. **Manage Patients**:
   - Add patients with complete information
   - Assign doctors to patients
   - Set total treatment cost and remaining amount
   - Search patients by name
4. **Schedule Appointments**: Assign patients to doctors with specific dates and times
5. **Monitor Payments**: Track total costs and remaining amounts manually
6. **View Reminders**: Get notified about upcoming and due appointments

### For Doctors

1. **Login**: Use doctor credentials to access the doctor dashboard
2. **View Today's Schedule**: See all appointments scheduled for today
3. **Manage Patients**: View assigned patients and their information
4. **Check Payment Status**: Monitor which patients have pending payments
5. **Get Reminders**: Receive automatic notifications for appointments

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/doctor/login` - Doctor login
- `POST /api/auth/logout` - Logout

### Admin Routes
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/doctors` - Get all doctors
- `POST /api/doctors` - Add new doctor
- `DELETE /api/doctors/:id` - Delete doctor

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get patient by ID
- `POST /api/patients` - Add new patient
- `DELETE /api/patients/:id` - Delete patient
- `GET /api/patients/search?q=` - Search patients

### Appointments
- `GET /api/appointments` - Get all appointments
- `POST /api/appointments` - Create appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Doctor-specific
- `GET /api/doctor/:id/stats` - Get doctor statistics
- `GET /api/doctor/:id/appointments/today` - Get today's appointments
- `GET /api/doctor/:id/appointments` - Get all doctor appointments
- `GET /api/doctor/:id/patients` - Get doctor's patients

### Reminders
- `GET /api/reminders` - Get all reminders
- `GET /api/reminders/due` - Get due reminders

## 🔒 Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **Session Management**: Secure session handling with express-session
- **Role-based Access**: Different access levels for admin and doctors
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries using SQLite

## 🎨 Customization

### Changing Colors
Edit the CSS variables in `styles.css`:

```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #10b981;
    --accent-color: #f59e0b;
    /* ... more colors */
}
```

### Adding New Features
1. Add API routes in `server.js`
2. Update frontend JavaScript in `app.js`
3. Modify HTML templates as needed
4. Update CSS styles in `styles.css`

## 📋 Project Structure

```
ZKCLINING/
├── package.json          # Node.js dependencies and scripts
├── server.js            # Express.js backend server
├── app.js               # Frontend JavaScript logic
├── styles.css           # Comprehensive styling
├── index.html           # Landing page
├── admin.html           # Administrator dashboard
├── doctor.html          # Doctor dashboard
├── clinic.db            # SQLite database (auto-created)
└── README.md            # This file
```

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. Set environment variables:
   ```bash
   export NODE_ENV=production
   export PORT=3000
   ```

2. Start the application:
   ```bash
   npm start
   ```

### Docker Deployment (Optional)
Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the port in `server.js` or kill the process using port 3000

2. **Database connection errors**
   - Ensure write permissions in the project directory
   - Check if `clinic.db` file is created

3. **Login issues**
   - Verify credentials match the default ones
   - Check browser console for errors

4. **Reminder system not working**
   - Ensure node-cron is installed
   - Check server logs for cron job execution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions:
- Email: support@zankoclinic.com
- Create an issue in the repository

## 🔮 Future Enhancements

- [ ] Email notifications for appointments
- [ ] SMS reminders
- [ ] Payment integration
- [ ] Report generation (PDF)
- [ ] Multi-language support
- [ ] Calendar integration
- [ ] Patient portal
- [ ] Insurance management
- [ ] Treatment history tracking
- [ ] Inventory management

---

**Made with ❤️ for Zanko Cleaning Dental Clinic**
