import { Injectable } from '@angular/core';
import { DiagramService } from './diagram.service';

@Injectable({
  providedIn: 'root'
})
export class RelationshipService {
  private sourceElement: any = null;
  private paper: any = null;
  private clickHandler: any = null;
  private currentType: string = 'association'; // por defecto

  constructor(private diagramService: DiagramService) {}

  /**
   * Inicia el modo de creación de relación con un tipo específico
   */
  startLinkCreation(paper: any, containerElement: HTMLElement, type: string = 'association'): void {
    this.paper = paper;
    this.sourceElement = null;
    this.currentType = type;

    // Cambiamos el cursor para indicar el modo de creación
    containerElement.style.cursor = 'crosshair';

    // Activamos el listener para la selección de elementos
    this.clickHandler = (cellView: any) => {
      if (!this.sourceElement) {
        // Primera selección
        this.sourceElement = cellView.model;
        console.log(`Primer elemento seleccionado para relación (${this.currentType})`);
      } else {
        // Segunda selección, creamos la relación
        this.createTypedRelationship(this.sourceElement.id, cellView.model.id, this.currentType);

        // Limpiamos estado y desactivamos el modo de creación
        this.paper.off('cell:pointerclick', this.clickHandler);
        containerElement.style.cursor = 'default';
        this.sourceElement = null;
        this.clickHandler = null;

        console.log(`Relación creada (${this.currentType})`);
      }
    };

    this.paper.on('cell:pointerclick', this.clickHandler);
  }

  /**
   * Crea una relación del tipo solicitado entre dos elementos
   */
  private createTypedRelationship(sourceId: string, targetId: string, type: string) {
    switch (type) {
      case 'association':
        this.diagramService.createRelationship(sourceId, targetId);
        break;

      case 'generalization': // Herencia
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': { stroke: '#333', 'stroke-width': 2 },
              '.marker-target': {
                d: 'M 20 0 L 0 10 L 20 20 z',
                fill: '#fff',
                stroke: '#333'
              }
            }
          })
        );
        break;

      case 'aggregation':
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': { stroke: '#333', 'stroke-width': 2 },
              '.marker-source': {
                d: 'M 0 10 L 10 0 L 20 10 L 10 20 z',
                fill: '#fff',
                stroke: '#333'
              }
            }
          })
        );
        break;

      case 'composition':
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': { stroke: '#333', 'stroke-width': 2 },
              '.marker-source': {
                d: 'M 0 10 L 10 0 L 20 10 L 10 20 z',
                fill: '#333'
              }
            }
          })
        );
        break;

      case 'dependency':
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': {
                stroke: '#333',
                'stroke-width': 2,
                'stroke-dasharray': '4 2'
              },
              '.marker-target': {
                d: 'M 10 0 L 0 5 L 10 10 z',
                fill: '#333'
              }
            }
          })
        );
        break;

      default:
        console.warn(`Tipo de relación desconocido: ${type}, usando asociación.`);
        this.diagramService.createRelationship(sourceId, targetId);
    }
  }

  /**
   * Cancela el modo de creación de relación
   */
  cancelLinkCreation(containerElement: HTMLElement): void {
    if (this.paper && this.clickHandler) {
      this.paper.off('cell:pointerclick', this.clickHandler);
      containerElement.style.cursor = 'default';
      this.sourceElement = null;
      this.clickHandler = null;
      this.currentType = 'association';
    }
  }
}
