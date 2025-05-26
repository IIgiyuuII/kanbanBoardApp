from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid

# Модель доски
class Board(models.Model):
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    invite_token = models.UUIDField(default=uuid.uuid4, unique=True)
    last_opened = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title
    
class BoardMembership(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Админ'),
        ('member', 'Участник'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')

    class Meta:
        unique_together = ('user', 'board')

    def __str__(self):
        return f"{self.user.username} — {self.board.title} ({self.role})"

# Модель колонки
class Column(models.Model):
    title = models.CharField(max_length=255)
    board = models.ForeignKey(Board, related_name="columns", on_delete=models.CASCADE)
    order = models.IntegerField(default=0)


    def __str__(self):
        return self.title

# Модель задачи
class Task(models.Model):
    title = models.CharField(max_length=255)
    column = models.ForeignKey(Column, related_name="tasks", on_delete=models.CASCADE)
    description = models.TextField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')], default='medium')
    assignees = models.ManyToManyField(User, related_name="assigned_tasks", blank=True)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    
    def __str__(self):
        return self.title
    
    
class Comment(models.Model):
    task = models.ForeignKey('Task', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)