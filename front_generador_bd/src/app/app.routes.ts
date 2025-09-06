import { Routes } from '@angular/router';
import { Diagram } from './diagram/diagram';

export const routes: Routes = [
    { path: '', redirectTo: 'diagram', pathMatch: 'full' }, 
    { path: 'diagram', component: Diagram },
];
