import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DiagramService } from '../../services/diagram/diagram.service';
import { UmlValidationService } from '../../services/colaboration/uml-validation.service';

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
  
  constructor(
    private diagramService: DiagramService,
    private umlValidation: UmlValidationService
  ) {}

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
    const umlJson = this.diagramService.exportToJson(); // 👈 exporta modelo actual
    this.umlValidation.validateModel(umlJson);
  }

  // 👉 para recibir resultados desde el padre (diagram)
  updateValidationResult(result: any) {
    this.validationResult = result;
    //console.log('Resultado de validación recibido:', result);
    this.validationCollapsed = false; // auto-expandir al recibir
  }
}
