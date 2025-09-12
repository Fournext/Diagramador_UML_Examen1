import { Injectable } from '@angular/core';
import { UmlClass } from '../models/uml-class.model';
import { EditionService } from './edition.service';
import { v4 as uuid } from 'uuid';
import { CollaborationService } from './colaboration/collaboration.service';
import { RemoteApplicationService } from './colaboration/remote-application.service';

@Injectable({ providedIn: 'root' })
export class DiagramService {
	private joint: any;
	private graph: any;
	private paper: any;
	private selectedCell: any = null;

	constructor(
		private edition: EditionService,
		private collab: CollaborationService
	) {}

	// === Constantes de tamaño mínimo ===
	private readonly MIN_W = 180; // tu ancho estándar inicial
	private readonly NAME_H = 30; // cabecera fija
	private readonly MIN_ATTRS_H = 40;
	private readonly MIN_METHS_H = 40;
	private readonly PAD_V = 10; // padding vertical extra

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
				interactive: { elementMove: true, addLinkFromMagnet: true },
				background: { color: '#f8f9fa' },
				defaultConnector: { name: 'rounded' },
				defaultLink: () => this.buildRelationship(),
				validateConnection: (cvS: any, _mS: any, cvT: any, _mT: any) => cvS !== cvT,
			});

			/**************************************************************************************************
			 * EVENTOS INTERACTIVOS EN EL PAPER (COLABORATIVO)
			 ***************************************************************************************************/
			let pendingPos: { id: string; x: number; y: number } | null = null;
			const flushMove = () => {
				if (pendingPos) {
					this.collab.broadcast({ t: 'move', ...pendingPos });
					pendingPos = null;
				}
				requestAnimationFrame(flushMove);
			};
			requestAnimationFrame(flushMove);
			this.paper.on('element:pointermove', (view: any) => {
				const m = view.model;
				const p = m.position();
				pendingPos = { id: m.id, x: p.x, y: p.y };
			});
			this.paper.on('element:pointerup', (view: any) => {
				const m = view.model;
				const p = m.position();
				this.collab.broadcast({ t: 'move', id: m.id, x: p.x, y: p.y });
				pendingPos = null; // limpiar
			});

      
      this.graph.on('remove', (cell: any, opt: any = {}) => {
        // Si la remoción vino de la red, no re-emitas
        if (opt?.remote) return;
        this.collab.broadcast({ t: 'delete', id: cell.id });
      });

			//👉 Difundir movimiento y redimensionamiento
			this.paper.on('link:connect', (linkView: any) => {
				const link = linkView.model;
				const src = link.get('source')?.id;
				const trg = link.get('target')?.id;
				if (src && trg) {
					this.collab.broadcast({ t: 'add_link', id: link.id, sourceId: src, targetId: trg });
				}
			});
			this.paper.on('element:pointerup', (view: any) => {
				const m = view.model;
				const p = m.position();
				this.collab.broadcast({ t: 'move', id: m.id, x: p.x, y: p.y });
			});
			// Si tienes resize interactivo, algo como:
			this.paper.on('element:resize:pointerup', (view: any) => {
				const m = view.model;
				const s = m.size();
				this.collab.broadcast({ t: 'resize', id: m.id, w: s.width, h: s.height });
			});
			// Difundir edición de etiquetas en links
			this.paper.on('link:label:pointerup', (linkView: any, evt: any, x: number, y: number) => {
				const model = linkView.model;
				const idx = this.getClickedLabelIndex(linkView, evt);
				if (idx == null) return;
				const lbl = model.label(idx);
				if (!lbl) return;
				this.collab.broadcast({ t: 'move_label', linkId: model.id, index: idx, position: lbl.position });
			});

			/*COLABORACION DE RELACIONES*/
			// Problema de loop al mover relacion
			let pendingLabelMove: { linkId: string; index: number; position: { distance: number; offset?: number } } | null = null;
			// loop para enviar como máximo 1 update por frame (~60fps)
			const flushLabelMove = () => {
				if (pendingLabelMove) {
					this.collab.broadcast({ t: 'move_label', ...pendingLabelMove });
					pendingLabelMove = null;
				}
				requestAnimationFrame(flushLabelMove);
			};
			requestAnimationFrame(flushLabelMove);
			this.paper.on('link:connect', (linkView: any) => {
				const link = linkView.model;
				const src = link.get('source')?.id;
				const trg = link.get('target')?.id;
				if (src && trg) {
					if (!link.has('alreadyBroadcasted')) {
						// primera vez → difundir creación
						link.set('alreadyBroadcasted', true);
						this.collab.broadcast({ t: 'add_link', id: link.id, sourceId: src, targetId: trg, payload: { labels: link.get('labels') } });
					} else {
						// siguientes → difundir solo movimiento
						this.collab.broadcast({ t: 'move_link', id: link.id, sourceId: src, targetId: trg });
					}
				}
			});
			this.paper.on('link:label:pointermove', (linkView: any, evt: any, x: number, y: number) => {
				const model = linkView.model;
				const idx = this.getClickedLabelIndex(linkView, evt);
				if (idx == null) return;
				const lbl = model.label(idx);
				if (!lbl) return;
				pendingLabelMove = { linkId: model.id, index: idx, position: lbl.position };
			});
			// al soltar, enviamos una última confirmación
			this.paper.on('link:label:pointerup', (linkView: any, evt: any, x: number, y: number) => {
				const model = linkView.model;
				const idx = this.getClickedLabelIndex(linkView, evt);
				if (idx == null) return;
				const lbl = model.label(idx);
				if (!lbl) return;
				this.collab.broadcast({ t: 'move_label', linkId: model.id, index: idx, position: lbl.position });
				pendingLabelMove = null;
			});

			// 👉 Vertices
			this.graph.on('change:vertices', (link: any) => {
				this.collab.broadcast({ t: 'update_vertices', id: link.id, vertices: link.get('vertices') || [] });
			});

			// Problema de loop al mover clase
			let pendingResize: { id: string; w: number; h: number } | null = null;
			const flushResize = () => {
				if (pendingResize) {
					this.collab.broadcast({ t: 'resize', ...pendingResize });
					pendingResize = null;
				}
				requestAnimationFrame(flushResize);
			};
			requestAnimationFrame(flushResize);
			this.paper.on('element:resize', (view: any) => {
				const m = view.model;
				const s = m.size();
				pendingResize = { id: m.id, w: s.width, h: s.height };
			});
			this.paper.on('element:resize:pointerup', (view: any) => {
				const m = view.model;
				const s = m.size();
				this.collab.broadcast({ t: 'resize', id: m.id, w: s.width, h: s.height });
				pendingResize = null;
			});

			/**************************************************************************************************
			 * EVENTOS INTERACTIVOS EN EL PAPER (MODICACION LOCAL)
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
					this.selectedCell.attr('.uml-outer/stroke', '#ff9800');
					this.selectedCell.attr('.uml-outer/stroke-width', 2);
					this.selectedCell.getPorts().forEach((p: any) => {
						this.selectedCell.portProp(p.id, 'attrs/circle/display', 'block');
					});
				}
			});
			//👉 Deselect al hacer click en el fondo
			this.paper.on('blank:pointerclick', () => this.clearSelection());
			this.paper.on('cell:pointerdblclick', (cellView: any, _evt: any, x: number, y: number) => {
				this.clearSelection();
				const model = cellView.model;
				if (!model?.isElement?.()) return;
				// lee posiciones de separadores (puestas por autoResize)
				const bbox = model.getBBox();
				const relY = y - bbox.y;
				const sep1 = parseFloat(model.attr('.sep-name/y1')) || (this.edition.NAME_H + 0.5);
				const sep2 = parseFloat(model.attr('.sep-attrs/y1')) || (this.edition.NAME_H + 40 + 0.5);
				let field: 'name' | 'attributes' | 'methods' = 'methods';
				if (relY < sep1) field = 'name';
				else if (relY < sep2) field = 'attributes';
				this.edition.startEditing(model, this.paper, field, x, y, this.collab);
			});
			//👉 Doble clic en una relación para editar su etiqueta
			this.paper.on('link:pointerdblclick', (linkView: any, evt: MouseEvent, x: number, y: number) => {
				const model = linkView.model;
				if (model.get('name') !== 'Relacion') return;
				const labelIndex = this.getClickedLabelIndex(linkView, evt);
				if (labelIndex === null) return;
				const label = model.label(labelIndex);
				const currentValue = label?.attrs?.text?.text || '';
				this.edition.startEditingLabel(model, this.paper, labelIndex, currentValue, x, y, this.collab);
				const node = linkView.findLabelNode(labelIndex) as SVGElement;
				if (node) {
					node.setAttribute('stroke', '#2196f3');
					node.setAttribute('stroke-width', '1');
				}
			});
			//👉 Clic derecho en una relación para añadir una nueva etiqueta
      this.paper.on('link:contextmenu', (linkView: any, evt: MouseEvent, x: number, y: number) => {
        evt.preventDefault();
        const labelIndex = this.getClickedLabelIndex(linkView, evt);

        if (labelIndex !== null) {
          // si clicaste encima de un label existente → lo eliminas
          linkView.model.removeLabel(labelIndex);
          this.collab.broadcast({
            t: 'del_label',
            linkId: linkView.model.id,
            index: labelIndex
          });
          return;
        }

        // si no hay label → crear uno nuevo
        const model = linkView.model;
        const newLabel = {
          position: { distance: linkView.getClosestPoint(x, y).ratio, offset: -10 },
          attrs: { text: { text: 'label', fill: '#333', fontSize: 12 } },
          markup: [{ tagName: 'text', selector: 'text' }]
        };

        model.appendLabel(newLabel);
        const idx = model.labels().length - 1;

        // 🔹 Difundir la creación a los demás peers
        this.collab.broadcast({
          t: 'add_label',
          linkId: model.id,
          index: idx,
          label: newLabel
        });

        // 🔹 Activar edición local
        this.edition.startEditingLabel(model, this.paper, idx, 'label', x, y, this.collab);
      });


			// 👉 inicializa colaboración **ANTES** de salir
					this.collab.registerDiagramApi({
						getGraph: () => this.graph,
						getJoint: () => this.joint,
						createUmlClass: (payload) => this.createUmlClass(payload),
						buildLinkForRemote: this.buildLinkForRemote,
						createRelationship: (sourceId: string, targetId: string, remote: boolean = false) => this.createRelationship(sourceId, targetId, remote),
					});
			this.collab.init('room-123');
			console.log('JointJS inicializado correctamente');
			return Promise.resolve();
		} catch (error) {
			console.error('Error al inicializar JointJS:', error);
			return Promise.reject(error);
		}
	}

	/**************************************************************************************************
	 * EDICIÓN DE RELACIONES
	 ***************************************************************************************************/
	// Crea una relación entre dos elementos y la añade al grafo
	createRelationship(sourceId: string, targetId: string, remote = false) {
		const link = this.buildRelationship(sourceId, targetId);
		this.graph.addCell(link);
		if (!remote) {
			this.collab.broadcast({
				t: 'add_link',
				id: link.id,
				sourceId,
				targetId,
				payload: { labels: link.get('labels') }, // 👈 difundir labels
			});
		}
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
        '.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' },
      },
      labels: [
        {
          position: { distance: 20, offset: -10 },
          attrs: { text: { text: '0..1', fill: '#333' } },
          markup: [{ tagName: 'text', selector: 'text' }]
        },
        {
          position: { distance: -20, offset: -10 },
          attrs: { text: { text: '1..*', fill: '#333'} },
          markup: [{ tagName: 'text', selector: 'text' }]
        }
      ]
    });
  }


	/**************************************************************************************************
	 * FUNCIONES AUXILIARES
	 ***************************************************************************************************/
	deleteSelected() {
		if (!this.selectedCell) return;
		const id = this.selectedCell.id;
		this.selectedCell.remove();
		this.collab.broadcast({ t: 'delete', id });
		this.selectedCell = null;
	}

	clearSelection() {
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
			const node = linkView.findLabelNode(i);
			if (node && (evt.target === node || node.contains(evt.target as Node))) return i;
		}
		return null;
	}

	/**************************************************************************************************
	 * CONFIFURACIÓN Y CREACIÓN DE UML
	 ***************************************************************************************************/
	// ========= Crea una clase UML con la estructura de tres compartimentos =========
	createUmlClass(classModel: UmlClass, remote: boolean = false): any {
		try {
			if (!this.joint || !this.graph) {
				throw new Error('JointJS no está inicializado');
			}
			// 👇 Forzar la creación del namespace custom
			this.createUmlNamespace();
			// 🔹 Normalizar atributos/métodos a texto multilinea
			const attributesText = Array.isArray(classModel.attributes)
				? classModel.attributes.map(a => `${a.name}: ${a.type}`).join('\n')
				: (classModel.attributes || '');
			const methodsText = Array.isArray(classModel.methods)
				? classModel.methods.map(m => {
						const params = m.parameters ? `(${m.parameters})` : '()';
						const ret = m.returnType ? `: ${m.returnType}` : '';
						return `${m.name}${params}${ret};`;
					}).join('\n')
				: (classModel.methods || '');
			// 👇 Usar la clase custom
			const umlClass = new this.joint.shapes.custom.UMLClass({
				position: classModel.position,
				size: classModel.size || { width: 180, height: 110 },
				name: classModel.name || 'Entidad',
				attributes: attributesText,
				methods: methodsText,
			});
			// 🔹 Asignar ID remoto si viene del payload
			if (classModel.id) {
				umlClass.set('id', classModel.id);
			} else {
				umlClass.set('id', uuid());
			}
			// 🔹 Añadimos 4 puertos (uno por cada lado)
			umlClass.addPort({ group: 'inout', id: 'top' });
			umlClass.addPort({ group: 'inout', id: 'bottom' });
			umlClass.addPort({ group: 'inout', id: 'left' });
			umlClass.addPort({ group: 'inout', id: 'right' });
			umlClass.on('change:size', () => this.edition.updatePorts(umlClass));
			umlClass.on('change:attrs', () => this.edition.scheduleAutoResize(this.paper, umlClass));
			// 🔹 Añadir al grafo SOLO UNA VEZ
			this.graph.addCell(umlClass);
			this.edition.scheduleAutoResize(umlClass, this.paper);
			umlClass.toFront();
			// 🔹 Difundir creación SOLO si fue local
			if (!remote) {
				this.collab.broadcast({
					t: 'add_class',
					id: umlClass.id,
					payload: {
						name: classModel.name,
						position: classModel.position,
						size: classModel.size,
						attributes: classModel.attributes,
						methods: classModel.methods,
					},
				});
			}
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
		if (this.joint.shapes.custom?.UMLClass) return;
		this.joint.shapes.custom = this.joint.shapes.custom || {};
		this.joint.shapes.custom.UMLClass = this.joint.dia.Element.define('custom.UMLClass', {
			size: { width: 180, height: 110 },
			name: 'Entidad',
			attributes: '',
			methods: '',
			attrs: {
				'.uml-outer': {
					strokeWidth: 2,
					stroke: '#2196f3',
					fill: '#ffffff',
					width: '100%',
					height: '100%',
				},
				'.uml-class-name-rect': { refWidth: '100%', height: 30, fill: '#e3f2fd' },
				'.sep-name': { stroke: '#2196f3', strokeWidth: 1, shapeRendering: 'crispEdges' },
				'.sep-attrs': { stroke: '#2196f3', strokeWidth: 1, shapeRendering: 'crispEdges' },
				'.uml-class-name-text': {
					ref: '.uml-class-name-rect',
					refY: .5,
					refX: .5,
					textAnchor: 'middle',
					yAlignment: 'middle',
					fontWeight: 'bold',
					fontSize: 14,
					fill: '#000',
					text: 'Entidad',
				},
				'.uml-class-attrs-text': {
					fontSize: 12,
					fill: '#000',
					text: '',
					textWrap: { width: -20, height: 'auto' },
					whiteSpace: 'pre-wrap',
				},
				'.uml-class-methods-text': {
					fontSize: 12,
					fill: '#000',
					text: '',
					textWrap: { width: -20, height: 'auto' },
					whiteSpace: 'pre-wrap',
				},
			},
			ports: {
				groups: {
					inout: {
						position: { name: 'absolute' },
						attrs: {
							circle: {
								r: 5,
								magnet: true,
								stroke: '#2196f3',
								fill: '#fff',
								'stroke-width': 2,
								display: 'none',
							},
						},
					},
				},
			},
		}, {
			markup: [
				'<g class="rotatable">',
				'<g class="scalable">',
				'<rect class="uml-outer"/>',
				'</g>',
				'<rect class="uml-class-name-rect"/>',
				'<line class="sep-name"/>',
				'<line class="sep-attrs"/>',
				'<text class="uml-class-name-text"/>',
				'<text class="uml-class-attrs-text"/>',
				'<text class="uml-class-methods-text"/>',
				'<g class="ports"/>',
				'</g>',
			].join(''),
		});
		// Sync textos → attrs
		this.joint.shapes.custom.UMLClass.prototype.updateRectangles = function () {
			this.attr({
				'.uml-class-name-text': { text: this.get('name') || '' },
				'.uml-class-attrs-text': { text: this.get('attributes') || '' },
				'.uml-class-methods-text': { text: this.get('methods') || '' },
			});
		};
		this.joint.shapes.custom.UMLClass.prototype.initialize = function () {
			this.on('change:name change:attributes change:methods', this.updateRectangles, this);
			this.updateRectangles();
			this.constructor.__super__.initialize.apply(this, arguments);
		};
	}

	private buildLinkForRemote = (sourceId?: string, targetId?: string) =>
		new this.joint.dia.Link({
			name: 'Relacion',
			source: sourceId ? { id: sourceId } : undefined,
			target: targetId ? { id: targetId } : undefined,
			attrs: {
				'.connection': { stroke: '#333333', 'stroke-width': 2 },
				'.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' },
			},
			labels: [
				{
					position: { distance: 20, offset: -10 },
					attrs: { text: { text: '0..1', fill: '#333' } },
				},
				{
					position: { distance: -20, offset: -10 },
					attrs: { text: { text: '1..*', fill: '#333' } },
				},
			],
		});

	// Expose para otros servicios (collab)
	getGraph() {
		return this.graph;
	}
	getJoint() {
		return this.joint;
	}
}