from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.validators import validate_email
from django.utils.translation import gettext_lazy as _
from .models import Board, Column, Task, Comment, BoardMembership

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=9, error_messages={
        "min_length": "Пароль должен содержать минимум 9 символов.",
        "blank": "Введите пароль.",
        "required": "Введите пароль."
    })
    password2 = serializers.CharField(write_only=True, error_messages={
        "blank": "Повторите пароль.",
        "required": "Повторите пароль."
    })
    email = serializers.EmailField(error_messages={
        "invalid": "Введите корректный email.",
        "required": "Укажите email.",
        "blank": "Укажите email."
    })

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Имя пользователя уже занято.")
        if len(value) < 6:
            raise serializers.ValidationError("Имя пользователя должно содержать минимум 6 символов.")
        return value

    def validate_email(self, value):
        try:
            validate_email(value)
        except:
            raise serializers.ValidationError("Введите корректный email.")
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с такой почтой уже зарегистрирован.")
        return value

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password2": "Пароли не совпадают."})
        if len(data['password']) < 9:
            raise serializers.ValidationError({"password": "Пароль должен содержать минимум 9 символов."})
        return data

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class TaskSerializer(serializers.ModelSerializer):
    comments_count = serializers.SerializerMethodField()
    assignees = UserSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, write_only=True, source='assignees'
    )
    
    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'start_date', 'due_date', 'priority', 'column', 'created_at', 'comments_count', 'assignees', 'assignee_ids', 'is_done']
    
    def get_comments_count(self, obj):
        return obj.comments.count()    
       


class ColumnSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(many=True, read_only=True)

    class Meta:
        model = Column
        fields = ["id", "title", "board", "tasks", "order"]


class BoardSerializer(serializers.ModelSerializer):
    columns = ColumnSerializer(many=True, read_only=True)
    role = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    current_user_id = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = ['id', 'title', 'invite_token', 'columns', 'role', 'members', 'current_user_id']
        depth = 1
        
    def get_role(self, board):
        user = self.context["request"].user
        try:
            membership = BoardMembership.objects.get(user=user, board=board)
            return membership.role
        except BoardMembership.DoesNotExist:
            return None
    def get_members(self, board):
        memberships = BoardMembership.objects.filter(board=board).select_related("user")
        return [
            {
                "id": m.user.id,
                "username": m.user.username,
                "role": m.role,
            }
            for m in memberships
        ]
    def get_current_user_id(self, board):
        return self.context["request"].user.id


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'task', 'text', 'created_at', 'author_name']
        
        
    def get_author_name(self, obj):
        return obj.author.username if obj.author else "Неизвестный"
    