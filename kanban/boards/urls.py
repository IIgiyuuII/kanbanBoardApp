from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings
import os
from .views import BoardViewSet, ColumnViewSet, TaskViewSet, CommentViewSet, RegisterView, get_invite_link, join_by_invite
PROJECT_ROOT = os.path.dirname(settings.BASE_DIR)

router = DefaultRouter()
router.register(r'boards', BoardViewSet, basename='boards')
router.register(r'columns', ColumnViewSet, basename='columns')
router.register(r'tasks', TaskViewSet, basename='tasks')
router.register(r'comments', CommentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('invite-link/<int:board_id>/', get_invite_link, name='get_invite_link'),
    path('join/<uuid:token>/', join_by_invite, name='join_by_invite'),
    re_path(r'^$', serve, {'path': 'index.html', 'document_root': os.path.join(settings.BASE_DIR, 'frontend')}),
    # Путь ко всем статическим файлам
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR, 'frontend')}),
]

