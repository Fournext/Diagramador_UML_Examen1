import { Injectable } from '@angular/core';
import { P2PService } from './p2p.service';
import { DiagramApi } from './diagram-api';

type Op = 
  | { t: 'add_class'; id: string; payload: any }
  | { t: 'edit_text'; id: string; field: 'name' | 'attributes' | 'methods'; value: string }
  | { t: 'move'; id: string; x: number; y: number }
  | { t: 'resize'; id: string; w: number; h: number }
  | { t: 'add_link'; id: string; sourceId: string; targetId: string; payload?: any }
  | { t: 'edit_label'; linkId: string; index: number; text: string }
  | { t: 'add_label'; linkId: string; index: number; label: any }
  | { t: 'del_label'; linkId: string; index: number }
  | { t: 'move_label'; linkId: string; index: number; position: { distance: number; offset?: number } }
  | { t: 'move_link'; id: string; sourceId: string; targetId: string }
  | { t: 'update_vertices'; id: string; vertices: any[] }
  | { t: 'delete'; id: string };

@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private api?: DiagramApi;
  private ready = false;
  constructor(private p2p: P2PService) {}

  registerDiagramApi(api: DiagramApi) {
    this.api = api;
  }

  init(roomId: string) {
    this.p2p.onData = (_: string | undefined, data: Op) => {
      if (!this.api?.getGraph()) return;
      this.applyRemoteOp(data);
    };
    this.p2p.init(roomId);
    this.ready = true;
  }

  broadcast(op: Op) {
    if (!this.ready) return;
    this.p2p.sendToAll(op);
  }

  private applyRemoteOp(op: Op) {
    try {
      const graph = this.api!.getGraph();
      const joint = this.api!.getJoint();
      switch (op.t) {
        case 'add_class': {
          if (graph.getCell(op.id)) break;
          this.api!.createUmlClass({ ...op.payload, id: op.id }, true);
          break;
        }
        case 'edit_text': {
          const m = graph.getCell(op.id);
          if (!m) break;
          const map = {
            name: '.uml-class-name-text',
            attributes: '.uml-class-attrs-text',
            methods: '.uml-class-methods-text',
          } as const;
          m.attr(`${map[op.field]}/text`, op.value);
          m.trigger('change:attrs', m, {});
          break;
        }
        case 'move': {
          const m = graph.getCell(op.id);
          if (!m) break;
          m.position(op.x, op.y);
          break;
        }
        case 'resize': {
          const m = graph.getCell(op.id);
          if (!m) break;
          m.resize(op.w, op.h);
          break;
        }
        case 'add_link': {
          if (graph.getCell(op.id)) break;

          const link = this.api?.buildLinkForRemote?.(op.sourceId, op.targetId)
                    ?? new joint.dia.Link({
                          source: { id: op.sourceId },
                          target: { id: op.targetId },
                          attrs: { '.connection': { stroke: '#333', 'stroke-width': 2 } }
                        });

          link.set('id', op.id);

          // 👉 Aplica los labels iniciales que envió el otro peer
          if (op.payload?.labels) {
            link.set('labels', op.payload.labels);
          }

          graph.addCell(link);
          break;
        }


        case 'add_label': { 
          const link = graph.getCell(op.linkId); 
          if (!link) break; 
          link.insertLabel(op.index, op.label); 
          link.trigger('change:labels', link, link.labels()); 
          break; 
        }


        case 'edit_label': { 
          const link = graph.getCell(op.linkId); 
          if (!link) break; 
          const labels = link.labels() || []; 
          if (op.index < 0 || op.index >= labels.length) { 
            console.warn('[Collab] edit_label ignorado, índice inválido', op); 
            break; 
          } 
          const lbl = labels[op.index]; 
          link.label(op.index, { ...lbl, attrs: { text: { text: op.text } } }); 
          link.trigger('change:labels', link, link.labels()); 
          break; 
        }

        case 'move_label': { 
          const link = graph.getCell(op.linkId); 
          if (!link) break; 
          const labels = link.labels() || []; 
          if (op.index < 0 || op.index >= labels.length) { 
            console.warn('[Collab] move_label ignorado, índice inválido', op); 
            break; 
          } 
          const lbl = labels[op.index]; 
          link.label(op.index, { ...lbl, position: op.position }); 
          link.trigger('change:labels', link, link.labels()); 
          break; 
        }

        case 'del_label': { 
          const link = graph.getCell(op.linkId); 
          if (!link) break; 
          const labels = link.labels() || []; 
          if (op.index < 0 || op.index >= labels.length) { 
            console.warn('[Collab] del_label ignorado, índice inválido', op); 
            break; 
          } 
          link.removeLabel(op.index); 
          link.trigger('change:labels', link, link.labels()); 
          break; 
        }

        case 'move_link': {
          const link = graph.getCell(op.id);
          if (!link) break;
          link.set('source', { id: op.sourceId });
          link.set('target', { id: op.targetId });
          break;
        }
        case 'update_vertices': {
          const link = graph.getCell(op.id);
          if (!link) break;
          link.set('vertices', op.vertices);
          break;
        }
        case 'delete': {  
          const m = graph.getCell(op.id);
          if (m) m.remove({ remote: true }); // 👈 marca para no rebroadcast
          break;
        }

      }
    } catch (err) {
      console.error('[Collab] applyRemoteOp error', op, err);
    }
  }
}
