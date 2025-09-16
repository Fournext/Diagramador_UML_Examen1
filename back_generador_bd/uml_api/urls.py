from django.urls import path
from .views import GenerateUMLView

urlpatterns = [
    path('generate-uml/', GenerateUMLView.as_view(), name='generate-uml'),
]
