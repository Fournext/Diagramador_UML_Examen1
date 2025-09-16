from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import call_gemini
import json
import re

class GenerateUMLView(APIView):
    def post(self, request):
        prompt = request.data.get("prompt")
        if not prompt:
            return Response({"error": "El campo 'prompt' es requerido"}, status=status.HTTP_400_BAD_REQUEST)

        output = call_gemini(prompt)

        # 🧹 Limpiar bloque de código Markdown si viene envuelto en ```json ... ```
        if isinstance(output, str):
            output = re.sub(r"^```json\s*|\s*```$", "", output.strip(), flags=re.MULTILINE)

        try:
            parsed_json = json.loads(output)
        except Exception as e:
            return Response({
                "error": "Gemini devolvió un formato inválido",
                "raw": output,
                "exception": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(parsed_json, status=status.HTTP_200_OK)
