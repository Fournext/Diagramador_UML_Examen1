import { Injectable } from '@angular/core';
import { UmlClass } from '../models/uml-class.model';
import { EditionService } from './edition.service';

@Injectable({
  providedIn: 'root'
})
export class DiagramService {
  private joint: any;
  private graph: any;
  private paper: any;
  private selectedCell: any = null;
  constructor(private edition: EditionService /* ... */) {}

  // === Constantes de tamaño mínimo ===
  private readonly MIN_W = 180;   // tu ancho estándar inicial
  private readonly NAME_H = 30;   // cabecera fija
  private readonly MIN_ATTRS_H = 40;
  private readonly MIN_METHS_H = 40;
  private readonly PAD_V = 10;    // padding vertical extra


  /**
   * Inicializa JointJS y configura el papel y grafo
   */
  async initialize(paperElement: HTMLElement): Promise<void> {
    try {
      // Importamos JointJS
      this.joint = await import('jointjs');
      
      // Creamos el grafo
      this.graph = new this.joint.dia.Graph();
      
      // Creamos el papel/canvas
      this.paper = new this.joint.dia.Paper({
        el: paperElement,
        model: this.graph,
        width: 800,
        height: 600,
        gridSize: 10,
        drawGrid: true,
        interactive: {
          elementMove: true,
          addLinkFromMagnet: true, 
          //vertexAdd: false //quitar vertice para mover linea
        },
        background: { color: '#f8f9fa' },
        defaultConnector: { name: 'rounded' },
        defaultLink: () => this.buildRelationship(),

        validateConnection: (cellViewS: any, magnetS: any, cellViewT: any, magnetT: any) => {
          return (cellViewS !== cellViewT);
        }
      });

      /**************************************************************************************************
      *                   EVENTOS INTERACTIVOS EN EL PAPER
      ***************************************************************************************************/ 

      //Seleccionar Una clase UML
      this.paper.on('cell:pointerclick', (cellView: any) => {
        if (this.selectedCell?.isElement?.()) {
          this.selectedCell.attr('.uml-outer/stroke', '#2196f3');
          this.selectedCell.attr('.uml-outer/stroke-width', 2);
          this.selectedCell.getPorts().forEach((p: any) => {
            this.selectedCell.portProp(p.id, 'attrs/circle/display', 'none');
          });
        }

        this.selectedCell = cellView.model;

        if (this.selectedCell?.isElement?.()) {
          this.selectedCell.attr('.uml-outer/stroke', '#ff9800');   // highlight
          this.selectedCell.attr('.uml-outer/stroke-width', 2);
          this.selectedCell.getPorts().forEach((p: any) => {
            this.selectedCell.portProp(p.id, 'attrs/circle/display', 'block');
          });
        }

      });


      //👉 Deselect al hacer click en el fondo
      this.paper.on('blank:pointerclick', () => {
        this.clearSelection();
      });

      this.paper.on('cell:pointerdblclick', (cellView: any, evt: any, x: number, y: number) => {
        this.clearSelection();
        const model = cellView.model;
        if (!model?.isElement?.()) return;

        // límites de zonas a partir de las líneas
        const bbox   = model.getBBox();
        const relY   = y - bbox.y;

        const nameH  = this.NAME_H;
        const sep1Y  = parseFloat(model.attr('.sep-name/y1'))  || (nameH + 0.5);
        const sep2Y  = parseFloat(model.attr('.sep-attrs/y1')) || (nameH + 40 + 0.5); // fallback

        let field: 'name' | 'attributes' | 'methods' | null = null;
        if (relY < sep1Y) field = 'name';
        else if (relY < sep2Y) field = 'attributes';
        else field = 'methods';

        //if (field) this.startEditing(model, field, x, y);
        if (field) this.edition.startEditing(model, this.paper, field, x, y);
      });


      //👉 Doble clic en una relación para editar su etiqueta
      this.paper.on('link:pointerdblclick',(linkView: any, evt: MouseEvent, x: number, y: number) => {
          const model = linkView.model;
          const labelIndex = this.getClickedLabelIndex(linkView, evt);

          const name = model.get('name');
          if (name!="Relacion") return;
          if (labelIndex === null) return; // no fue sobre una etiqueta

          // 🔹 Abrir editor solo si fue sobre un label
          const label = model.label(labelIndex);
          const currentValue = label?.attrs?.text?.text || '';
          this.edition.startEditingLabel(model, this.paper, labelIndex, currentValue, x, y);

          // Opcional: resaltar visualmente el label en edición
          const labelNode = linkView.findLabelNode(labelIndex) as SVGElement;
          if (labelNode) {
            labelNode.setAttribute('stroke', '#2196f3');
            labelNode.setAttribute('stroke-width', '1');
          }
        }
      );

      //👉 Clic derecho en una relación para añadir una nueva etiqueta
      this.paper.on('link:contextmenu', (linkView: any, evt: MouseEvent, x: number, y: number) => {
        evt.preventDefault();

        // ¿El click derecho fue sobre una etiqueta?
        const labelIndex = this.getClickedLabelIndex(linkView, evt);
        if (labelIndex !== null) {
          // 👉 eliminar la etiqueta directamente
          linkView.model.removeLabel(labelIndex);
          return;
        }

        // 👉 si no fue sobre una etiqueta, agregamos una nueva
        const model = linkView.model;
        const newLabel = {
          position: { distance: linkView.getClosestPoint(x, y).ratio, offset: -10 },
          attrs: { text: { text: 'label', fill: '#333', fontSize: 12 } }
        };
        model.appendLabel(newLabel);

        // Abrir editor inmediatamente
        const newIndex = model.labels().length - 1;
        this.edition.startEditingLabel(model, this.paper, newIndex, 'label', x, y);
      });


      console.log('JointJS inicializado correctamente');
      return Promise.resolve();
    } catch (error) {
      console.error('Error al inicializar JointJS:', error);
      return Promise.reject(error);
    }
  }

  /**************************************************************************************************
  *                   EDICIÓN DE RELACIONES
  ***************************************************************************************************/ 
  
  // Crea una relación entre dos elementos y la añade al grafo
  createRelationship(sourceId: string, targetId: string, labelText: string = '1:n'): any {
    const link = this.buildRelationship(sourceId, targetId);
    this.graph.addCell(link);
    return link;
  }

  // Construye una relación (link) con configuración por defecto
  private buildRelationship(sourceId?: string, targetId?: string) {
    return new this.joint.dia.Link({
      name: 'Relacion',
      source: sourceId ? { id: sourceId } : undefined,
      target: targetId ? { id: targetId } : undefined,
      attrs: {
        '.connection': { stroke: '#333333', 'stroke-width': 2 },
        '.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' }
      },
      labels: [
        { position: { distance: 20, offset: -10 }, attrs: { text: { text: '0..1', fill: '#333' } } }, // origen
        { position: { distance: -20, offset: -10 }, attrs: { text: { text: '1..*', fill: '#333' } } } // destino
      ]
    });
  }

  /**************************************************************************************************
  *                  FUNCIONES AUXILIARES
  ***************************************************************************************************/ 

  deleteSelected(): void {
    if (this.selectedCell) {
      this.selectedCell.remove();
      this.selectedCell = null;
    }
  }

  clearSelection(): void {
    if (this.selectedCell?.isElement?.()) {
      this.selectedCell.attr('.uml-outer/stroke', '#2196f3');
      this.selectedCell.attr('.uml-outer/stroke-width', 2);
      this.selectedCell.getPorts().forEach((p: any) => {
        this.selectedCell.portProp(p.id, 'attrs/circle/display', 'none');
      });
    }
    this.selectedCell = null;

  }

  // ========= Obtener índice de etiqueta clicada =========
  private getClickedLabelIndex(linkView: any, evt: MouseEvent): number | null {
    const labels = linkView.model.labels();
    if (!labels || labels.length === 0) return null;

    for (let i = 0; i < labels.length; i++) {
      const labelNode = linkView.findLabelNode(i);

      // Verificar si el target o alguno de sus ancestros pertenece al nodo del label
      if (labelNode && (evt.target === labelNode || labelNode.contains(evt.target as Node))) {
        return i;
      }
    }

    return null; // 👉 No fue sobre una etiqueta
  }

  /**************************************************************************************************
  *                  CONFIFURACIÓN Y CREACIÓN DE UML
  ***************************************************************************************************/ 

  // ========= Crea una clase UML con la estructura de tres compartimentos =========
  createUmlClass(classModel: UmlClass): any {
    try {
      if (!this.joint || !this.graph) {
        throw new Error('JointJS no está inicializado');
      }

      // 👇 Forzar la creación del namespace custom
      this.createUmlNamespace();

      const attributesText = classModel.attributes
        .map(attr => `${attr.name}: ${attr.type}`)
        .join('\n');

      const methodsText = classModel.methods
        .map(method => {
          const params = method.parameters ? `(${method.parameters})` : '()';
          const returnType = method.returnType ? `: ${method.returnType}` : '';
          return `${method.name}${params}${returnType}`;
        })
        .join('\n');

      // 👇 Usar la clase custom
      const umlClass = new this.joint.shapes.custom.UMLClass({
        position: classModel.position,
        size: classModel.size || { width: 180, height: 110 },
        name: classModel.name,
        attributes: attributesText,
        methods: methodsText
      });

      // 🔹 Añadimos 4 puertos (uno por cada lado)
      umlClass.addPort({ group: 'inout', id: 'top' });
      umlClass.addPort({ group: 'inout', id: 'bottom' });
      umlClass.addPort({ group: 'inout', id: 'left' });
      umlClass.addPort({ group: 'inout', id: 'right' });

      umlClass.on('change:size',  () => this.edition.updatePorts(umlClass));
      umlClass.on('change:attrs', () => this.edition.scheduleAutoResize(this.paper,umlClass));

      this.graph.addCell(umlClass);
      this.edition.scheduleAutoResize(this.paper, umlClass);      // ✅ tamaño inicial
      umlClass.toFront();

      return umlClass;

    } catch (error) {
      console.error('Error al crear clase UML personalizada:', error);
      throw error;
    }
  }
  
  // ========= Configura los eventos interactivos para un elemento =========
  setupClassInteraction(element: any): void {
    try {
      const elementView = this.paper.findViewByModel(element);
      
      if (elementView) {
        // elementView.on('element:pointerdblclick', () => {
        //   console.log('Doble clic en elemento - editar propiedades');
        //   // Aquí podríamos abrir un diálogo para editar propiedades
        // });
      }
    } catch (error) {
      console.error('Error al configurar interacción:', error);
    }
  }
  
  
  // ========= Crea un namespace UML personalizado si no existe en JointJS =========
  private createUmlNamespace(): void {
    if (!this.joint) return;
    if (this.joint.shapes.custom && this.joint.shapes.custom.UMLClass) {
      return;
    }

    this.joint.shapes.custom = this.joint.shapes.custom || {};

    this.joint.shapes.custom.UMLClass = this.joint.dia.Element.define('custom.UMLClass', {
      size: { width: 180, height: 110 },
      name: 'Entidad',
      attributes: '',
      methods: '',
      attrs: {
        // Borde exterior único
        '.uml-outer': {
          strokeWidth: 2, stroke: '#2196f3', fill: '#ffffff',
          width: '100%', height: '100%'
        },

        // Header sin stroke (solo fondo)
        '.uml-class-name-rect': { refWidth: '100%', height: 30, fill: '#e3f2fd' },

        // Separadores como líneas de 1px nítidas
        '.sep-name':  { stroke: '#2196f3', strokeWidth: 1, shapeRendering: 'crispEdges' },
        '.sep-attrs': { stroke: '#2196f3', strokeWidth: 1, shapeRendering: 'crispEdges' },

        // Textos
        '.uml-class-name-text': {
          ref: '.uml-class-name-rect', refY: .5, refX: .5,
          textAnchor: 'middle', yAlignment: 'middle',
          fontWeight: 'bold', fontSize: 14, fill: '#000', text: 'Entidad'
        },
        '.uml-class-attrs-text': {
          fontSize: 12, fill: '#000', text: '',
          textWrap: { width: -20, height: 'auto' }, whiteSpace: 'pre-wrap'
        },
        '.uml-class-methods-text': {
          fontSize: 12, fill: '#000', text: '',
          textWrap: { width: -20, height: 'auto' }, whiteSpace: 'pre-wrap'
        }
      },

      ports: {
        groups: {
          inout: {
            position: { name: 'absolute' },
            attrs: { circle: { r: 5, magnet: true, stroke: '#2196f3', fill: '#fff', 'stroke-width': 2, display: 'none' } }
          }
        }
      }
    }, {
      markup: [
        '<g class="rotatable">',
          '<g class="scalable">',                 // ⬅️ solo el borde
            '<rect class="uml-outer"/>',
          '</g>',
          '<rect class="uml-class-name-rect"/>',  // ⬅️ fuera del scalable
          '<line class="sep-name"/>',             // ⬅️ fuera
          '<line class="sep-attrs"/>',            // ⬅️ fuera
          '<text class="uml-class-name-text"/>',
          '<text class="uml-class-attrs-text"/>',
          '<text class="uml-class-methods-text"/>',
          '<g class="ports"/>',
        '</g>'
      ].join('')


    });

    // 🔹 Método updateRectangles para refrescar textos
    this.joint.shapes.custom.UMLClass.prototype.updateRectangles = function() {
      this.attr({
        '.uml-class-name-text': { text: this.get('name') || '' },
        '.uml-class-attrs-text': { text: this.get('attributes') || '' },
        '.uml-class-methods-text': { text: this.get('methods') || '' }
      });
    };

    this.joint.shapes.custom.UMLClass.prototype.initialize = function() {
      this.on('change:name change:attributes change:methods', this.updateRectangles, this);
      this.updateRectangles();
      this.constructor.__super__.initialize.apply(this, arguments);
    }; 
  }
}