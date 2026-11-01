import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Base da API, sem barra final (ex.: `http://localhost:5231/api`). */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
