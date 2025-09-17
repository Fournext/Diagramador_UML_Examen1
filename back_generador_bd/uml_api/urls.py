from django.urls import path
from .views import GenerateUMLView

urlpatterns = [
    path('chatbot/', GenerateUMLView.as_view(), name='generate-uml'),
]
