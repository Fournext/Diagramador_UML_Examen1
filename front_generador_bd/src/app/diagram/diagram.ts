import { AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-diagram',
  standalone: true,
  templateUrl: './diagram.html',
  styleUrls: ['./diagram.css']
})
export class Diagram implements AfterViewInit {
  @ViewChild('paperContainer', { static: true }) paperContainer!: ElementRef;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const joint = await import('jointjs');
      console.log('shapes disponibles:', joint.shapes.uml);

      const graph = new joint.dia.Graph();
      const paper = new joint.dia.Paper({
        el: this.paperContainer.nativeElement,
        model: graph,
        width: 800,   // Fijo para pruebas
        height: 600,  // Fijo para pruebas
        gridSize: 10,
        drawGrid: true
      });

      const class1 = new joint.shapes.uml.Class({
        position: { x: 50, y: 50 },
        size: { width: 180, height: 120 },
        name: ['Usuario'], // 👈 string, no array
        attributes: ['+ id: number', '+ nombre: string'],
        methods: ['+ login()', '+ logout()']
      });

      graph.addCell(class1);
    }
  }
}
