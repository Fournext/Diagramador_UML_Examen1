// collab/diagram-api.ts
export interface DiagramApi {
  getGraph(): any;
  getJoint(): any;

  // crea y añade una clase (o devuélvela, según tu factory; ver abajo)
  createUmlClass(payload: any, remote?: boolean): any;

  // opcional: para construir links remotos sin añadirlos aún
  buildLinkForRemote?(sourceId?: string, targetId?: string): any;
}
