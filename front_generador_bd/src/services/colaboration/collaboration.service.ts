import { Injectable } from '@angular/core';
import { P2PService } from './p2p.service';
import { DiagramApi } from './diagram-api';

type Op =
  | { t: 'add_class'; id: string; payload: any }
  | { t: 'edit_text'; id: string; field: 'name'|'attributes'|'methods'; value: string }
  | { t: 'move'; id: string; x: number; y: number }
  | { t: 'resize'; id: string; w: number; h: number }
  | { t: 'add_link'; id: string; sourceId: string; targetId: string; payload?: any }
  | { t: 'edit_label'; linkId: string; index: number; text: string }
  | { t: 'del_label'; id: string; index: number }
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

// collaboration.service.ts
// collaboration.service.ts
private applyRemoteOp(op: Op) {
  try {
    const graph = this.api!.getGraph();
    const joint = this.api!.getJoint();

    switch (op.t) {
      case 'add_class': {
        if (graph.getCell(op.id)) {
          console.warn('[Collab] Clase ya existe, ignorando', op.id);
          break;
        }
        this.api!.createUmlClass({ ...op.payload, id: op.id }, true);
        break;
      }


      case 'edit_text': {
        const m = graph.getCell(op.id);
        if (!m) break;
        const map = {
          name: '.uml-class-name-text',
          attributes: '.uml-class-attrs-text',
          methods: '.uml-class-methods-text'
        } as const;
        m.attr(`${map[op.field]}/text`, op.value);
        // disparará change:attrs -> autoResize ya está suscrito en DiagramService
        break;
      }
      case 'move': {
        const m = graph.getCell(op.id);
        if (!m) break;
        m.position(op.x, op.y, { silent: true }); // evita eco
        break;
      }
      case 'resize': {
        const m = graph.getCell(op.id);
        if (!m) break;
        m.resize(op.w, op.h, { silent: true }); // evita eco
        break;
      }
      case 'add_link': {
        if (graph.getCell(op.id)) break;
        const link = new joint.dia.Link({
          name: 'Relacion',
          source: { id: op.sourceId },
          target: { id: op.targetId },
          attrs: {
            '.connection': { stroke: '#333', 'stroke-width': 2 },
            '.marker-target': { fill: '#333', d: 'M 10 0 L 0 5 L 10 10 z' }
          },
          labels: [
            { position: { distance: 20,  offset: -10 }, attrs: { text: { text: '0..1', fill: '#333' } } },
            { position: { distance: -20, offset: -10 }, attrs: { text: { text: '1..*', fill: '#333' } } }
          ]
        });
        link.set('id', op.id);
        graph.addCell(link);
        break;
      }
      case 'edit_label': {
        const link = graph.getCell(op.linkId);
        if (!link) break;
        link.label(op.index, { ...link.label(op.index), attrs: { text: { text: op.text } } });
        break;
      }
      case 'del_label': {
        const link = graph.getCell(op.id);
        if (!link) break;
        link.removeLabel(op.index);
        break;
      }
      case 'delete': {
        const m = graph.getCell(op.id);
        if (m) m.remove({ silent: true });
        break;
      }
    }
  } catch (err) {
    console.error('[Collab] applyRemoteOp error', op, err);
  }
}


}
