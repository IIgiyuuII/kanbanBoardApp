from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_invite_link(request, board_id):
    
    board = get_object_or_404(Board, id=board_id)
    membership = BoardMembership.objects.filter(board=board, user=request.user).first()

    if not membership or membership.role != "admin":
        return Response({"error": "Недостаточно прав"}, status=403)
    
    return Response({
        "invite_url": f"http://localhost:8000/?invite={board.invite_token}"
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def join_by_invite(request, token):
    board = get_object_or_404(Board, invite_token=token)
    BoardMembership.objects.get_or_create(user=request.user, board=board, defaults={'role': 'member'})
    return Response({"message": "Вы добавлены к доске!"})


from .models import Board, Column, Task, Comment, BoardMembership
from .serializers import (
    BoardSerializer,
    ColumnSerializer,
    TaskSerializer,
    RegisterSerializer,
    CommentSerializer,
)

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Пользователь создан"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class BoardViewSet(viewsets.ModelViewSet):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Board.objects.filter(memberships__user=self.request.user).distinct().order_by('-last_opened')\
            .prefetch_related(
                'columns__tasks__assignees',  # Добавляем prefetch
                'memberships__user'
            )

    def perform_create(self, serializer):
        board = serializer.save()
        BoardMembership.objects.create(user=self.request.user, board=board, role="admin")
        Column.objects.create(board=board, title="To Do")
    def destroy(self, request, *args, **kwargs):
        board = self.get_object()
    
        # удаляем текущего пользователя из участников
        BoardMembership.objects.filter(board=board, user=request.user).delete()

        # если больше нет админов — удаляем доску
        if not BoardMembership.objects.filter(board=board, role='admin').exists():
            board.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response({"message": "Вы удалены с доски"}, status=status.HTTP_204_NO_CONTENT)

    
    @action(detail=True, methods=["post"])
    def set_admin(self, request, pk=None):
        board = self.get_object()
        current_user = request.user
        if not BoardMembership.objects.filter(board=board, user=current_user, role="admin").exists():
            return Response({"error": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        target_user_id = request.data.get("user_id")
        target_user = get_object_or_404(User, id=target_user_id)
        membership, created = BoardMembership.objects.get_or_create(board=board, user=target_user)
        membership.role = "admin"
        membership.save()

        return Response({"message": f"Пользователь {target_user.username} назначен админом"})

    @action(detail=True, methods=["post"])
    def mark_opened(self, request, pk=None):
        board = self.get_object()
        board.last_opened = timezone.now()
        board.save()
        return Response({"status": "marked as opened"})
    
    @action(detail=True, methods=["post"])
    def remove_user(self, request, pk=None):
        board = self.get_object()
        current_user = request.user

        if not BoardMembership.objects.filter(board=board, user=current_user, role="admin").exists():
            return Response({"error": "Недостаточно прав"}, status=403)

        target_user_id = request.data.get("user_id")
        if not target_user_id:
            return Response({"error": "user_id обязателен"}, status=400)

        BoardMembership.objects.filter(board=board, user__id=target_user_id).delete()
        return Response({"message": "Пользователь удалён"})
    @action(detail=True, methods=["post"])
    def set_member(self, request, pk=None):
        board = self.get_object()
        current_user = request.user

        # Только админ может понижать других
        if not BoardMembership.objects.filter(board=board, user=current_user, role="admin").exists():
            return Response({"error": "Недостаточно прав"}, status=403)

        target_user_id = request.data.get("user_id")
        target_user = get_object_or_404(User, id=target_user_id)

        # Обновляем роль
        membership = BoardMembership.objects.filter(board=board, user=target_user).first()
        if membership:
            membership.role = "member"
            membership.save()

        return Response({"message": f"Пользователь {target_user.username} понижен до участника"})


class ColumnViewSet(viewsets.ModelViewSet):
    serializer_class = ColumnSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Column.objects.filter(board__memberships__user=self.request.user)

    def get_board_and_role(self, column=None):
        user = self.request.user
        board = column.board if column else Board.objects.get(id=self.request.data.get("board"))
        role = BoardMembership.objects.get(user=user, board=board).role
        return board, role

    def update(self, request, *args, **kwargs):
        column = self.get_object()
        _, role = self.get_board_and_role(column)
        if role != "admin":
            return Response({"error": "Недостаточно прав для редактирования колонки."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        column = self.get_object()
        _, role = self.get_board_and_role(column)
        if role != "admin":
            return Response({"error": "Недостаточно прав для удаления колонки."}, status=403)
        return super().destroy(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        _, role = self.get_board_and_role()
        if role != "admin":
            return Response({"error": "Недостаточно прав для создания колонки."}, status=403)
        return super().create(request, *args, **kwargs)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Task.objects.filter(column__board__memberships__user=self.request.user)

    def get_task_membership(self, task):
        board = task.column.board
        return BoardMembership.objects.filter(user=self.request.user, board=board).first()
    
    def perform_create(self, serializer):
        column = serializer.validated_data.get('column')
        board = column.board
        user = self.request.user
        membership = BoardMembership.objects.filter(board=board, user=user).first()
        if not membership or membership.role != "admin":
            raise PermissionDenied("Недостаточно прав для создания задачи.")
        serializer.save()

    def update(self, request, *args, **kwargs):
        task = self.get_object()
        membership = self.get_task_membership(task)

        if not membership or membership.role != "admin":
            raise PermissionDenied("Недостаточно прав для изменения задачи.")

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        task = self.get_object()
        membership = self.get_task_membership(task)

        if not membership or membership.role != "admin":
            raise PermissionDenied("Недостаточно прав для удаления задачи.")

        return super().destroy(request, *args, **kwargs)

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Comment.objects.all()
    
    def get_queryset(self):
        queryset = Comment.objects.all()  # или фильтруй по доступу, если нужно
        task_id = self.request.query_params.get('task')
        if task_id:
            queryset = queryset.filter(task__id=task_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
