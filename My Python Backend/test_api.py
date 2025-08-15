#!/usr/bin/env python
"""
API testing script to verify all endpoints work correctly
"""
import requests
import json

BASE_URL = 'http://localhost:8000'

def test_auth_endpoints():
    """Test authentication endpoints"""
    print("\n=== Testing Authentication Endpoints ===")
    
    # Test login
    login_data = {
        'email': 'admin@iams.edu',
        'password': 'admin123'
    }
    
    response = requests.post(f'{BASE_URL}/api/auth/login/', json=login_data)
    print(f"Login Status: {response.status_code}")
    
    if response.status_code == 200:
        auth_data = response.json()
        access_token = auth_data['tokens']['access']
        print("Login successful")
        print(f"User: {auth_data['user']['first_name']} {auth_data['user']['last_name']}")
        print(f"Role: {auth_data['user']['role']}")
        return access_token
    else:
        print("Login failed")
        print(response.text)
        return None

def test_api_endpoints(access_token):
    """Test all API endpoints"""
    if not access_token:
        print("Cannot test API endpoints without valid token")
        return
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    endpoints = [
        '/api/students/',
        '/api/supervisors/',
        '/api/companies/',
        '/api/attachments/',
        '/api/supervisor-assignments/',
        '/api/verification-status/',
        '/api/weekly-logs/',
        '/api/evaluations/',
        '/api/reimbursements/',
        '/api/messages/',
    ]
    
    print(f"\n=== Testing API Endpoints ===")
    
    for endpoint in endpoints:
        try:
            response = requests.get(f'{BASE_URL}{endpoint}', headers=headers)
            print(f"{endpoint:<30} Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'results' in data:  # Paginated response
                    count = data['count']
                    print(f"{'':30} Records: {count}")
                else:  # Direct list response
                    count = len(data) if isinstance(data, list) else 1
                    print(f"{'':30} Records: {count}")
            else:
                print(f"{'':30} Error: {response.text[:100]}")
                
        except requests.exceptions.ConnectionError:
            print(f"{endpoint:<30} Server not running")
        except Exception as e:
            print(f"{endpoint:<30} Error: {str(e)}")

def test_student_login():
    """Test student login and data access"""
    print(f"\n=== Testing Student Access ===")
    
    login_data = {
        'email': 'student1@student.iams.edu',
        'password': 'student123'
    }
    
    response = requests.post(f'{BASE_URL}/api/auth/login/', json=login_data)
    
    if response.status_code == 200:
        auth_data = response.json()
        access_token = auth_data['tokens']['access']
        print("Student login successful")
        
        headers = {'Authorization': f'Bearer {access_token}'}
        
        # Test student can access their own data
        response = requests.get(f'{BASE_URL}/api/students/', headers=headers)
        if response.status_code == 200:
            students = response.json()
            count = students['count'] if 'results' in students else len(students)
            print(f"Student can access {count} student record(s) (should be their own)")
        
        # Test weekly logs access
        response = requests.get(f'{BASE_URL}/api/weekly-logs/', headers=headers)
        if response.status_code == 200:
            logs = response.json()
            count = logs['count'] if 'results' in logs else len(logs)
            print(f"Student can access {count} weekly log(s)")
    else:
        print("Student login failed")

def main():
    """Run all tests"""
    print("Starting API Tests...")
    print(f"Testing server at: {BASE_URL}")
    
    try:
        # Test server is running
        response = requests.get(f'{BASE_URL}/admin/', timeout=5)
        print("Django server is running")
    except requests.exceptions.ConnectionError:
        print("Django server is not running!")
        print("Please run: python manage.py runserver 8000")
        return
    
    # Test authentication
    access_token = test_auth_endpoints()
    
    # Test API endpoints
    test_api_endpoints(access_token)
    
    # Test student access
    test_student_login()
    
    print(f"\nAPI testing completed!")
    print(f"\nNext steps:")
    print(f"   1. Visit http://localhost:8000/admin/ for Django admin")
    print(f"   2. Test API endpoints with Postman or curl")
    print(f"   3. Start updating your React frontend to use these endpoints")

if __name__ == '__main__':
    main()