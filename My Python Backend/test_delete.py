import requests
import json

def test_delete_functionality():
    # Login first
    url = "http://localhost:8000/api/auth/login/"
    data = {"email": "admin@iams.edu", "password": "admin123"}
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            result = response.json()
            token = result['tokens']['access']
            headers = {'Authorization': f'Bearer {token}'}
            
            # Get students list to find an ID to test with
            students_response = requests.get('http://localhost:8000/api/students/', headers=headers)
            if students_response.status_code == 200:
                students = students_response.json()
                if 'results' in students and len(students['results']) > 0:
                    student_id = students['results'][0]['id']
                    print(f"Found student to test with: {student_id}")
                    
                    # Test delete by ID (this is what the frontend will call)
                    delete_url = f"http://localhost:8000/api/students/{student_id}/"
                    delete_response = requests.delete(delete_url, headers=headers)
                    print(f"Delete status: {delete_response.status_code}")
                    
                    if delete_response.status_code == 204:
                        print("✅ Delete successful!")
                    else:
                        print(f"❌ Delete failed: {delete_response.text}")
                else:
                    print("No students found to test with")
            else:
                print(f"Failed to get students: {students_response.status_code}")
        else:
            print(f"Login failed: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_delete_functionality()