import requests
import json

# Test the Django API login
def test_login():
    url = "http://localhost:8000/api/auth/login/"
    data = {
        "email": "admin@iams.edu",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            access_token = result['tokens']['access']
            print(f"✅ Login successful!")
            print(f"Access Token: {access_token[:50]}...")
            
            # Test authenticated request
            headers = {'Authorization': f'Bearer {access_token}'}
            students_url = "http://localhost:8000/api/students/"
            students_response = requests.get(students_url, headers=headers)
            print(f"Students API Status: {students_response.status_code}")
            if students_response.status_code == 200:
                students = students_response.json()
                print(f"✅ Found {len(students.get('results', students))} students")
            
        else:
            print("❌ Login failed")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_login()