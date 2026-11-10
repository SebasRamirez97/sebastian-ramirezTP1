import { CanDeactivateFn } from '@angular/router';

export interface ComponenteConAsientosPendientes {
  puedeSalir?: () => boolean | Promise<boolean>;
  liberarAsientosTemporales?: () => void | Promise<void>;
}

export const liberarAsientosGuard: CanDeactivateFn<ComponenteConAsientosPendientes> = async (component, currentRoute, currentState, nextState) => {
  const urlDestino = nextState.url;

  // Permitir libremente la navegación entre flujos internos de compra (Candy Bar, Seleccionar Asientos, Checkout)
  if (
    urlDestino.includes('/candybar') || 
    urlDestino.includes('/seleccionar-asientos') || 
    urlDestino.includes('/checkout')
  ) {
    return true;
  }

  // Si el componente indica que puede salir (ej. ya compró o no tiene asientos)
  if (component.puedeSalir && (await component.puedeSalir())) {
    return true;
  }

  // De lo contrario, alertamos al usuario antes de abandonar el proceso de compra
  const confirmar = window.confirm('¿Estás a punto de salir? Si sales perderás los asientos seleccionados.');
  
  if (confirmar) {
    if (component.liberarAsientosTemporales) {
      await component.liberarAsientosTemporales();
    }
    return true;
  } else {
    return false;
  }
};