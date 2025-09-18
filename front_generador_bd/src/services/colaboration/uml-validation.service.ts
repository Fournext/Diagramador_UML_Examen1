import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UmlValidationService {
  private socket?: WebSocket;

    connect(onResult: (data: any) => void) {
    this.socket = new WebSocket('ws://127.0.0.1:8000/ws/uml/');

    this.socket.onmessage = (msg) => {
        try {
        const data = JSON.parse(msg.data);
        if (data.action === 'validation_result') {
            onResult(data);
        }
        } catch (e) {
        console.error('Error parseando mensaje de validación', e);
        }
    };
    }


  validateModel(umlJson: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[UML Validation] WebSocket no conectado todavía');
      return;
    }

    const payload = {
      action: 'validate_model',
      uml: umlJson
    };
    this.socket.send(JSON.stringify(payload));
  }
}
