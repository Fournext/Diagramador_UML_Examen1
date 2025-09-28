import { AfterViewInit, Component, ElementRef, HostListener, Inject, NgZone, PLATFORM_ID, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CdkDragEnd, CdkDropListGroup, CdkDropList } from '@angular/cdk/drag-drop';
import { SidePanel } from "../side-panel/side-panel";
import { DiagramService } from '../../services/diagram/diagram.service';
import { FallbackService } from '../../services/diagram/fallback.service';
import { RelationshipService } from '../../services/diagram/relationship.service';
import { UmlClass, Attribute, Method } from '../../models/uml-class.model';
import { DiagramExportService } from '../../services/exports/diagram-export.service';
import { BackendGeneratorService } from '../../services/exports/backend-generator.service';
import { ChatbotService } from '../../services/IA/chatbot.service';
import { UmlValidationService } from '../../services/colaboration/uml-validation.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-diagram',
  standalone: true,
  templateUrl: './diagram.html',
  styleUrls: ['./diagram.css'],
  imports: [SidePanel, CdkDropListGroup, CdkDropList]
})
export class Diagram implements AfterViewInit {
  @ViewChild('paperContainer', { static: true }) paperContainer!: ElementRef;
  @ViewChild(SidePanel) sidePanel!: SidePanel;
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone,
    private diagramService: DiagramService,
    private fallbackService: FallbackService,
    private relationshipService: RelationshipService,
    private exportService: DiagramExportService,
    private backendGen: BackendGeneratorService,
    private chatbot: ChatbotService,
    private umlValidation: UmlValidationService,
    private route: ActivatedRoute
  ) {}
  
  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.run(async () => {
        try {
          const roomId = this.route.snapshot.paramMap.get('roomId') || 'default-room';
          await this.diagramService.initialize(this.paperContainer.nativeElement, roomId);
          
          this.sidePanel.elementDragged.subscribe((event: CdkDragEnd) => {
            this.onDragEnded(event);
          });

          this.sidePanel.saveClicked.subscribe(() => this.saveDiagram());

          this.sidePanel.generateClicked.subscribe((prompt: string) => {
            this.generateFromPrompt(prompt);
          });
          
          this.umlValidation.connect((result) => {
            this.sidePanel.updateValidationResult(result);
          });
          
          console.log('Diagrama inicializado correctamente');
        } catch (error) {
          console.error('Error al inicializar el diagrama:', error);
        }
      });
    }
  }
  saveDiagram() {
    const json = this.exportService.export(this.diagramService.getGraph());
    console.log('JSON exportado:', JSON.stringify(json, null, 2));

    // luego lo puedes enviar a backend
    this.backendGen.generateBackend(json, 'mi-backend.zip');
  }

  generateFromPrompt(prompt: string) {
    this.chatbot.generateDiagram(prompt).subscribe({
      next: (json) => {
        console.log('Respuesta del chatbot:', json);
        this.diagramService.loadFromJson(json,true);
      },
      error: (err) => {
        console.error('Error al generar diagrama desde chatbot', err);
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleEscape(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.diagramService.deleteSelected();
    }
    if (event.key === 'Escape') {
      this.diagramService.clearSelection();
    }
  }
  
  @HostListener('window:resize')
  onResize() {
    if (this.diagramService['paper'] && this.paperContainer) {
      const rect = this.paperContainer.nativeElement.getBoundingClientRect();
      this.diagramService['paper'].setDimensions(rect.width, rect.height);
    }
  }


  onDragEnded(event: CdkDragEnd) {
    // Ejecutamos dentro de ngZone para asegurar la detección de cambios
    this.ngZone.run(() => {
      const type = (event.source.data as any).type;
      const { x, y } = event.dropPoint; // posición absoluta en pantalla

      // Ajustar posición relativa al canvas
      const rect = this.paperContainer.nativeElement.getBoundingClientRect();
      const pos = { x: x - rect.left, y: y - rect.top };

      console.log('Elemento arrastrado:', type, 'Posición:', pos);

      if (type === 'class') {
        try {
          // Crear un modelo de clase UML
          const umlClassModel: UmlClass = {
            name: 'Entidad',
            position: pos,
            size: { width: 180, height: 110 },
            attributes: [
              { name: 'id', type: 'int' },
              { name: 'nombre', type: 'string' }
            ],
            methods: [
              { name: 'crear' },
              { name: 'eliminar' }
            ]
          };
          
          // Usar el servicio para crear la clase UML
          this.diagramService.createUmlClass(umlClassModel);
          console.log('Entidad UML creada correctamente');
        } catch (error) {
          console.error('Error al crear el elemento:', error);
          
          // Si falla, usamos el fallback HTML
          const fallbackClass: UmlClass = {
            name: 'Entidad',
            position: pos,
            attributes: [
              { name: 'id', type: 'int' },
              { name: 'nombre', type: 'string' }
            ],
            methods: [
              { name: 'crear' },
              { name: 'eliminar' }
            ]
          };
          
          this.fallbackService.createFallbackElement(
            this.paperContainer.nativeElement, 
            fallbackClass
          );
        }
      }

      if (['association','generalization','aggregation','composition','dependency'].includes(type)) {
        this.relationshipService.startLinkCreation(
          this.diagramService['paper'],
          this.paperContainer.nativeElement,
          type // 👈 pasamos el tipo
        );
        console.log(`Modo de creación de relación activado: ${type}`);
      }

    });
  }
  zoomIn() {
    this.diagramService.zoomIn();
  }

  zoomOut() {
    this.diagramService.zoomOut();
  }

  resetZoom() {
    this.diagramService.resetZoom();
  }
}

