import json
from channels.generic.websocket import AsyncWebsocketConsumer

class CanvasConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("[CanvasConsumer.connect] scope:", self.scope)
        print("[CanvasConsumer.connect] url_route:", self.scope.get("url_route"))
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"canvas_{self.room_name}"

        # Unir al grupo
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Notificar presencia
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence",
                "action": "join",
                "peer": self.channel_name
            }
        )

    async def disconnect(self, close_code):
        # Salir del grupo
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Notificar salida
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence",
                "action": "leave",
                "peer": self.channel_name
            }
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        # Si es un broadcast → enviar a todos
        if data["type"] == "broadcast":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_message",
                    "from": self.channel_name,
                    "payload": data["payload"]
                }
            )

        # Si es una señal directa → mandar a un peer específico
        elif data["type"] == "signal":
            to = data["to"]
            await self.channel_layer.send(
                to,
                {
                    "type": "signal_message",
                    "from": self.channel_name,
                    "payload": data["payload"]
                }
            )

    # Handlers para los eventos enviados
    async def broadcast_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "broadcast",
            "from": event["from"],
            "payload": event["payload"]
        }))

    async def signal_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "signal",
            "from": event["from"],
            "payload": event["payload"]
        }))

    async def presence(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence",
            "action": event["action"],
            "peer": event["peer"]
        }))
