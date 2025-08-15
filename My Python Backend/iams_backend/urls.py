"""
URL configuration for iams_backend project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls.auth')),
    path('api/', include('core.urls.api')),
    path('api/documents/', include('core.urls.document_verification')),
]