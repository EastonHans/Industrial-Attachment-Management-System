# Student Industrial Attachment Management System (IAMS)

A comprehensive web application for managing student industrial attachments, built with React frontend and Django backend.

## 🚀 Features

- **Student Management**: Registration, verification, and profile management
- **Attachment Tracking**: Company placements and supervision
- **Evaluation System**: Multi-criteria assessment by supervisors
- **Reimbursement Management**: Travel and expense claims
- **Document Management**: Upload and verification system
- **Real-time Communication**: Messaging between users
- **Admin Dashboard**: Comprehensive system administration

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Shadcn/ui** components
- **React Router** for navigation
- **React Query** for data fetching

### Backend
- **Django 5.2** with Django REST Framework
- **PostgreSQL** database
- **JWT Authentication**
- **CORS** enabled for frontend integration

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)
- **PostgreSQL** (v12 or higher)
- **Git**

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd student-attachment-system
```

### 2. Environment Configuration
```bash
# Copy environment templates
cp .env.example .env
cp "My Python Backend/.env.example" "My Python Backend/.env"

# Edit the .env files with your actual values
# See SECURITY.md for detailed configuration guide
```

### 3. Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Backend Setup
```bash
cd "My Python Backend"

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

## 🔒 Security

**Important**: This project uses environment variables for sensitive configuration. 

- **Never commit** `.env` files or API keys to version control
- See `SECURITY.md` for detailed security guidelines
- Use the provided `.env.example` templates

## 📊 Database Schema

The system includes comprehensive ERD documentation:
- `ERD_Diagram.md` - Mermaid format
- `ERD_PlantUML.puml` - PlantUML format
- `ERD_PlantUML_CrowsFoot.puml` - Crow's Foot notation


## 🚀 Deployment

### Database Options
1. **PostgreSQL** (recommended for production)

### Environment Variables
Ensure all required environment variables are set in production:
- Database credentials
- API keys (Google Maps, etc.)
- Django secret key
- Frontend/backend URLs

## 📁 Project Structure

```
├── src/                    # Frontend React application
├── My Python Backend/      # Django backend API
├── supabase_*.sql         # Database schema files
├── ERD_*.puml            # Database diagrams
├── .env.example          # Environment template
└── SECURITY.md           # Security guidelines
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow security guidelines in `SECURITY.md`
4. Submit a pull request


## 🆘 Support

For security issues, please refer to `SECURITY.md`.
For general support, create an issue in the repository.
