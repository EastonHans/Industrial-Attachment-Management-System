# Security Guidelines

## Environment Variables

This project uses environment variables to keep sensitive information secure. **Never commit actual API keys, passwords, or credentials to version control.**

### Required Environment Variables

#### Frontend (.env)
```bash
# API Configuration
VITE_DJANGO_API_URL=your_backend_api_url
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Supabase (if using)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend (.env)
```bash
# Database
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=your_database_host
DB_PORT=your_database_port

# Django
SECRET_KEY=your_django_secret_key
DEBUG=False

# Email (if using)
EMAIL_HOST_USER=your_email
EMAIL_HOST_PASSWORD=your_email_password

# Frontend URL
FRONTEND_URL=your_frontend_url
```

## Setup Instructions

1. **Copy environment templates:**
   ```bash
   cp .env.example .env
   cp "My Python Backend/.env.example" "My Python Backend/.env"
   ```

2. **Fill in your actual values** in the `.env` files

3. **Never commit `.env` files** - they're already in `.gitignore`

## API Key Security

### Google Maps API Key
- Restrict by HTTP referrer (domains)
- Restrict by API (only enable needed APIs)
- Monitor usage in Google Cloud Console

### Database Credentials
- Use strong passwords
- Limit database user permissions
- Use SSL connections in production

## Production Deployment

- Set `DEBUG=False` in Django settings
- Use environment-specific CORS settings
- Enable HTTPS
- Use secure session cookies
- Implement rate limiting
- Regular security updates

## Reporting Security Issues

If you discover a security vulnerability, please email the maintainers directly instead of creating a public issue.