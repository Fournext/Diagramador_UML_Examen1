import { Component, Output, EventEmitter, PLATFORM_ID, Inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DiagramService } from '../../services/diagram/diagram.service';
import { UmlValidationService } from '../../services/colaboration/uml-validation.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-side-panel',
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.css'
})
export class SidePanel {
  @Output() elementDragged = new EventEmitter<CdkDragEnd>();
  @Output() saveClicked = new EventEmitter<void>(); 
  @Output() generateClicked = new EventEmitter<string>();

  prompt: string = '';
  validationCollapsed = true;
  validationResult: any = null;
  analyzingModel = false;
  roomId: string | null = null;
  copied = signal<boolean>(false);
  recognizing = signal<boolean>(false);
  recognition: any;
  isBrowser: boolean;

  constructor(
    private diagramService: DiagramService,
    private umlValidation: UmlValidationService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId); // ✅ detecta si estamos en navegador
    this.roomId = this.route.snapshot.paramMap.get('roomId');

    if (this.isBrowser) {
      this.configVoiceRecognition();
    }
  }

  onDragEnded(event: CdkDragEnd) {
    this.elementDragged.emit(event);
    event.source.reset();
  }
  onSaveClicked() {
    this.saveClicked.emit(); // 👈 dispara evento al padre
  }
  onGenerate() {
    if (this.prompt.trim()) {
      this.generateClicked.emit(this.prompt.trim());
      this.prompt = ''; // limpiar input
    }
  }
  // 👉 para colapsar el panel
  toggleValidationPanel() {
    this.validationCollapsed = !this.validationCollapsed;
  }

  analyzeNow() {
    this.analyzingModel = true;
    const umlJson = this.diagramService.exportToJson(); // 👈 exporta modelo actual
    // Simulación de análisis asíncrono, reemplaza por tu lógica real si es necesario
    this.umlValidation.validateModel(umlJson);
  }

  // 👉 para recibir resultados desde el padre (diagram)
  updateValidationResult(result: any) {
    this.validationResult = result;
    this.validationCollapsed = false; // auto-expandir al recibir
    this.analyzingModel = false;
  }
  goHome() {
    this.diagramService.clearStorage(); // Limpia el diagrama guardado
    this.diagramService.closeDiagram(this.roomId!); // Cierra conexiones y limpia estado
    this.router.navigate(['/']); // redirige al inicio
  }
  copyRoomCode() {
    const roomId = this.route.snapshot.paramMap.get('roomId');
    if (!roomId) return;

    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

    if (isSecure && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomId).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      }).catch(() => this.fallbackCopy(roomId));
    } else {
      this.fallbackCopy(roomId);
    }
  }

  private fallbackCopy(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
  }

  configVoiceRecognition() {
    if (!this.isBrowser) return;
    this.recognition = null;
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.interimResults = true;
      this.recognition.continuous = false;

      this.recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        this.prompt = transcript;
      };

      this.recognition.onend = () => {
        this.recognizing.set(true);
      };
    }
  }
  toggleVoiceInput() {
    if (!this.recognition) {
      alert('Tu navegador no soporta reconocimiento de voz');
      return;
    }

    if (this.recognizing()) {
      this.recognition.stop();
      this.recognizing.set(false);
    } else {
      this.recognition.start();
      this.recognizing.set(true);
    }
  }

}
