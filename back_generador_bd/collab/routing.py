from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/canvas/(?P<room_name>[^/]+)/?$", consumers.CanvasConsumer.as_asgi()),
]
