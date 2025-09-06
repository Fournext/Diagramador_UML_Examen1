import { Injectable } from '@angular/core';
import { DiagramService } from './diagram.service';

@Injectable({
  providedIn: 'root'
})
export class RelationshipService {
  private sourceElement: any = null;
  private paper: any = null;
  private clickHandler: any = null;
  
  constructor(private diagramService: DiagramService) {}
  
  /**
   * Inicia el modo de creación de relación
   */
  startLinkCreation(paper: any, containerElement: HTMLElement): void {
    this.paper = paper;
    this.sourceElement = null;
    
    // Cambiamos el cursor para indicar el modo de creación
    containerElement.style.cursor = 'crosshair';
    
    // Activamos el listener para la selección de elementos
    this.clickHandler = (cellView: any) => {
      if (!this.sourceElement) {
        // Primera selección
        this.sourceElement = cellView.model;
        console.log('Primer elemento seleccionado');
      } else {
        // Segunda selección, creamos la relación
        this.diagramService.createRelationship(
          this.sourceElement.id, 
          cellView.model.id,
          '1:n'
        );
        
        // Limpiamos estado y desactivamos el modo de creación
        this.paper.off('cell:pointerclick', this.clickHandler);
        containerElement.style.cursor = 'default';
        this.sourceElement = null;
        this.clickHandler = null;
        
        console.log('Relación creada');
      }
    };
    
    this.paper.on('cell:pointerclick', this.clickHandler);
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
    }
  }
}
