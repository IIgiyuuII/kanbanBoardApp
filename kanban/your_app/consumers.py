from channels.generic.websocket import AsyncWebsocketConsumer
import json

class BoardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.board_id = self.scope['url_route']['kwargs']['board_id']
        self.room_group_name = f'board_{self.board_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        # просто рассылаем другим участникам (можно настроить логику обновлений)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "board_update",
                "message": data["message"]
            }
        )

    async def board_update(self, event):
        await self.send(text_data=json.dumps({
            "message": event["message"]
        }))
