# IAMS Django Backend

This is the Django backend for the Industrial Attachment Management System (IAMS), migrated from Supabase.

## Quick Setup (5 minutes)

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create Environment File**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup Database**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   python manage.py createsuperuser
   ```

4. **Migrate Existing Data (Optional)**
   ```bash
   python migrate_data.py
   ```

5. **Run Server**
   ```bash
   python manage.py runserver 8000
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/profile/` - Get user profile
- `POST /api/auth/refresh/` - Refresh JWT token

### Core Resources
- `/api/students/` - Student management
- `/api/supervisors/` - Supervisor management
- `/api/companies/` - Company management
- `/api/attachments/` - Attachment records
- `/api/supervisor-assignments/` - Supervisor assignments
- `/api/verification-status/` - Student verification status
- `/api/weekly-logs/` - Weekly logs
- `/api/evaluations/` - Student evaluations
- `/api/reimbursements/` - Travel reimbursements
- `/api/messages/` - Internal messaging

### Admin Interface
Visit `http://localhost:8000/admin/` to access the Django admin interface.

## Key Features

✅ **Complete Database Migration** - All 12 tables from Supabase schema
✅ **JWT Authentication** - Secure token-based auth
✅ **Role-Based Permissions** - Admin, Student, Supervisor roles
✅ **REST API** - Full CRUD operations for all models
✅ **Admin Interface** - Built-in Django admin for data management
✅ **Data Migration Script** - Transfer existing data from CSV files
✅ **CORS Support** - Ready for React frontend integration

## Migration from Supabase

### Frontend Changes Required

Replace Supabase client calls with HTTP requests:

**Before (Supabase):**
```javascript
import { supabase } from './supabase/client'

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
})

// Fetch data
const { data } = await supabase.from('students').select('*')
```

**After (Django API):**
```javascript
// Login
const response = await fetch('/api/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
const data = await response.json()
localStorage.setItem('access_token', data.tokens.access)

// Fetch data (with auth)
const response = await fetch('/api/students/', {
  headers: { 
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
})
const students = await response.json()
```

## Environment Variables

```env
SECRET_KEY=your-django-secret-key
DEBUG=True
DB_NAME=your_database_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
```

## Development

```bash
# Create new migrations after model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# Run tests
python manage.py test
```

## Deployment Ready

This setup is production-ready with:
- PostgreSQL database support
- JWT authentication
- CORS configuration
- Environment-based configuration
- Admin interface for data management

## Migration Timeline

- **Day 1**: Django setup ✅ (COMPLETED)
- **Day 2**: API endpoints and authentication
- **Day 3**: Frontend integration
- **Day 4**: Testing and refinement
- **Day 5**: Deployment

**Total Migration Time: 3-5 days vs 3-4 weeks with custom solution**