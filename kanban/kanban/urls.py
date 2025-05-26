from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
import os

PROJECT_ROOT = os.path.dirname(settings.BASE_DIR)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('boards.urls')),
    path('o/', include('oauth2_provider.urls', namespace='oauth2_provider')),

    re_path(r'^$', serve, {
        'path': 'index.html',
        'document_root': os.path.join(PROJECT_ROOT, 'frontend')
    }),
    re_path(r'^static/(?P<path>.*)$', serve, {
        'document_root': os.path.join(PROJECT_ROOT, 'frontend')
    }),
]