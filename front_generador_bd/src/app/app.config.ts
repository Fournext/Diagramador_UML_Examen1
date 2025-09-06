import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { DiagramService } from '../services/diagram.service';
import { FallbackService } from '../services/fallback.service';
import { RelationshipService } from '../services/relationship.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    // Servicios para el diagrama
    DiagramService,
    FallbackService,
    RelationshipService
  ]
};
