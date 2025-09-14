import { AfterViewInit, Component, ElementRef, HostListener, Inject, NgZone, PLATFORM_ID, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CdkDragEnd, CdkDropListGroup, CdkDropList } from '@angular/cdk/drag-drop';
import { SidePanel } from "../side-panel/side-panel";
import { DiagramService } from '../../services/diagram.service';
import { FallbackService } from '../../services/fallback.service';
import { RelationshipService } from '../../services/relationship.service';
import { UmlClass, Attribute, Method } from '../../models/uml-class.model';
import { DiagramExportService } from '../../services/diagram-export.service';
import { BackendGeneratorService } from '../../services/backend-generator.service';

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
    private backendGen: BackendGeneratorService
  ) {}

  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      // Ejecutamos dentro de ngZone para asegurar la detección de cambios
      this.ngZone.run(async () => {
        try {
          // Inicializar el servicio de diagrama con el elemento del canvas
          await this.diagramService.initialize(this.paperContainer.nativeElement);
          
          // Escuchar el evento de arrastre desde el panel lateral
          this.sidePanel.elementDragged.subscribe((event: CdkDragEnd) => {
            this.onDragEnded(event);
          });

          this.sidePanel.saveClicked.subscribe(() => this.saveDiagram());
          
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


  @HostListener('document:keydown', ['$event'])
  handleEscape(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.diagramService.deleteSelected();
    }
    if (event.key === 'Escape') {
      this.diagramService.clearSelection();
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
}

