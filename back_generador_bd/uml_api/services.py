import requests
from django.conf import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", None)

def call_gemini(prompt: str):
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}

    data = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"""
Convierte el siguiente prompt en un JSON UML válido. 
El JSON **debe seguir exactamente** esta estructura:

{{
  "classes": [
    {{
      "id": "uuid",
      "name": "NombreClase",
      "attributes": [
        {{"name": "atributo", "type": "tipo"}}
      ],
      "methods": [
        {{"name": "metodo", "parameters": "", "returnType": ""}}
      ]
    }}
  ],
  "relationships": [
    {{
      "id": "uuid",
      "type": "association | generalization | aggregation | composition",
      "sourceId": "uuid",
      "targetId": "uuid",
      "labels": ["1..*", "1"]
    }}
  ]
}}

Usa UUIDs generados aleatoriamente como 'id'.
NO devuelvas nada más, solo el JSON.

Prompt del usuario:
{prompt}
"""
                    }
                ]
            }
        ]
    }

    response = requests.post(GEMINI_API_URL, headers=headers, params=params, json=data)
    response.raise_for_status()
    result = response.json()

    try:
        text_output = result['candidates'][0]['content']['parts'][0]['text']
        return text_output
    except (KeyError, IndexError):
        return '{"error": "No se pudo parsear la respuesta de Gemini"}'
