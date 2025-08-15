from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from ..views.auth_views import (
    RegisterView, LoginView, LogoutView, UserProfileView,
    ForgotPasswordView, ResetPasswordView, get_authenticated_user
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('user/', get_authenticated_user, name='get_authenticated_user'),  # GET /api/auth/user/
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),
]