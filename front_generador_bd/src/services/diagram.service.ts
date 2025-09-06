import { Injectable } from '@angular/core';
import { UmlClass } from '../models/uml-class.model';

@Injectable({
  providedIn: 'root'
})
export class DiagramService {
  private joint: any;
  private graph: any;
  private paper: any;

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
          addLinkFromMagnet: true
        },
        background: { color: '#f8f9fa' },
        defaultConnector: { name: 'rounded' },
        defaultLink: () => {
          return new this.joint.dia.Link({
            attrs: {
              '.connection': { 
                stroke: '#333333', 
                'stroke-width': 2 
              },
              '.marker-target': { 
                fill: '#333333', 
                d: 'M 10 0 L 0 5 L 10 10 z' 
              }
            }
          });
        },
        validateConnection: (cellViewS: any, magnetS: any, cellViewT: any, magnetT: any) => {
          // Evitar conexiones al mismo elemento
          return (cellViewS !== cellViewT);
        }
      });
      
      console.log('JointJS inicializado correctamente');
      return Promise.resolve();
    } catch (error) {
      console.error('Error al inicializar JointJS:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Crea una clase UML con la estructura de tres compartimentos
   */
  createUmlClass(classModel: UmlClass): any {
    try {
      // Si no tenemos jointjs o el grafo inicializados
      if (!this.joint || !this.graph) {
        throw new Error('JointJS no está inicializado');
      }

      // Verificamos si existe la namespace shapes.uml
      if (!this.joint.shapes.uml) {
        // Si no existe, creamos nuestra propia forma UML
        this.createUmlNamespace();
      }
      
      // Formateamos los atributos y métodos como texto
      const attributesText = classModel.attributes
        .map(attr => `${attr.name}: ${attr.type}`)
        .join('\\n');
        
      const methodsText = classModel.methods
        .map(method => {
          const params = method.parameters ? `(${method.parameters})` : '()';
          const returnType = method.returnType ? `: ${method.returnType}` : '';
          return `${method.name}${params}${returnType}`;
        })
        .join('\\n');

      // Creamos la clase UML
      let umlClass;
      
      try {
        // Intentamos usar la clase UML predefinida de JointJS
        umlClass = new this.joint.shapes.uml.Class({
          position: classModel.position,
          size: classModel.size || { width: 180, height: 110 },
          name: classModel.name,
          attributes: attributesText,
          methods: methodsText,
          attrs: {
            '.uml-class-name-rect': { 
              fill: '#e3f2fd',
              stroke: '#2196f3',
              'stroke-width': 2
            },
            '.uml-class-attrs-rect': { 
              fill: '#ffffff',
              stroke: '#2196f3',
              'stroke-width': 2
            },
            '.uml-class-methods-rect': { 
              fill: '#ffffff',
              stroke: '#2196f3',
              'stroke-width': 2
            }
          }
        });
      } catch (error) {
        console.error('Error al crear clase UML estándar:', error);
        
        // Si falla, usamos nuestra implementación personalizada
        umlClass = new this.joint.shapes.devs.UMLClass({
          position: classModel.position,
          size: classModel.size || { width: 180, height: 110 },
          name: classModel.name,
          attributes: attributesText,
          methods: methodsText
        });
      }

      // Añadimos al grafo
      this.graph.addCell(umlClass);
      umlClass.toFront();
      
      // Configuramos eventos de interacción
      this.setupClassInteraction(umlClass);
      
      return umlClass;
    } catch (error) {
      console.error('Error al crear clase UML:', error);
      throw error;
    }
  }

  /**
   * Crea una relación entre dos elementos
   */
  createRelationship(sourceId: string, targetId: string, labelText: string = '1:n'): any {
    const link = new this.joint.dia.Link({
      source: { id: sourceId },
      target: { id: targetId },
      attrs: {
        '.connection': { 
          stroke: '#333333', 
          'stroke-width': 2 
        },
        '.marker-target': { 
          fill: '#333333', 
          d: 'M 10 0 L 0 5 L 10 10 z' 
        }
      },
      labels: [
        { position: .5, attrs: { text: { text: labelText } } }
      ]
    });
    
    this.graph.addCell(link);
    return link;
  }
  
  /**
   * Configura los eventos interactivos para un elemento
   */
  setupClassInteraction(element: any): void {
    try {
      const elementView = this.paper.findViewByModel(element);
      
      if (elementView) {
        elementView.on('element:pointerdblclick', () => {
          console.log('Doble clic en elemento - editar propiedades');
          // Aquí podríamos abrir un diálogo para editar propiedades
        });
      }
    } catch (error) {
      console.error('Error al configurar interacción:', error);
    }
  }
  
  /**
   * Crea un namespace UML personalizado si no existe en JointJS
   */
  private createUmlNamespace(): void {
    // Si ya existe, no hacemos nada
    if (this.joint.shapes.devs && this.joint.shapes.devs.UMLClass) {
      return;
    }

    // Creamos un namespace para UML
    this.joint.shapes.devs = this.joint.shapes.devs || {};
    
    // Definir una clase UML personalizada
    this.joint.shapes.devs.UMLClass = this.joint.dia.Element.extend({
      defaults: Object.assign({}, this.joint.dia.Element.prototype.defaults, {
        type: 'devs.UMLClass',
        attrs: {
          rect: { 'width': 180, 'height': 110, 'rx': 2, 'ry': 2, 'stroke': '#2196f3', 'stroke-width': 2, 'fill': '#ffffff' },
          
          '.uml-class-name-rect': { 'height': 30, 'transform': 'translate(0,0)', 'fill': '#e3f2fd', 'stroke': '#2196f3' },
          '.uml-class-attrs-rect': { 'height': 40, 'transform': 'translate(0,30)', 'fill': '#ffffff', 'stroke': '#2196f3' },
          '.uml-class-methods-rect': { 'height': 40, 'transform': 'translate(0,70)', 'fill': '#ffffff', 'stroke': '#2196f3' },
          
          '.uml-class-name-text': {
            'ref': '.uml-class-name-rect',
            'ref-y': .5, 'ref-x': .5,
            'text-anchor': 'middle',
            'y-alignment': 'middle',
            'font-weight': 'bold',
            'font-size': 14,
            'fill': '#000000'
          },
          '.uml-class-attrs-text': {
            'ref': '.uml-class-attrs-rect',
            'ref-y': 10, 'ref-x': 10,
            'text-anchor': 'start',
            'font-size': 12,
            'fill': '#000000'
          },
          '.uml-class-methods-text': {
            'ref': '.uml-class-methods-rect',
            'ref-y': 10, 'ref-x': 10,
            'text-anchor': 'start',
            'font-size': 12,
            'fill': '#000000'
          }
        },
        name: 'Entidad',
        attributes: '',
        methods: ''
      }),
      
      markup: [
        '<g class="rotatable">',
          '<g class="scalable">',
            '<rect class="uml-class-name-rect"/><rect class="uml-class-attrs-rect"/><rect class="uml-class-methods-rect"/>',
          '</g>',
          '<text class="uml-class-name-text"/><text class="uml-class-attrs-text"/><text class="uml-class-methods-text"/>',
        '</g>'
      ].join(''),
      
      initialize: function() {
        this.on('change:name change:attributes change:methods', () => {
          this.updateRectangles();
          this.trigger('uml-update');
        }, this);
        
        this.updateRectangles();
        this.joint.dia.Element.prototype.initialize.apply(this, arguments);
      },
      
      updateRectangles: function() {
        const attrs = this.get('attrs');
        
        // Actualizar textos
        attrs['.uml-class-name-text'].text = this.get('name');
        attrs['.uml-class-attrs-text'].text = this.get('attributes');
        attrs['.uml-class-methods-text'].text = this.get('methods');
      }
    });
  }
}
