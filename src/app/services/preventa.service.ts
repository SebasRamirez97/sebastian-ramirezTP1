import { Injectable } from '@angular/core';

export interface EstadoPreventa {
  enPreventa: boolean;
  fechaInicioPreventa: Date | null;
  fechaEstreno: Date | null;
  precioPesosEfectivo: number;
  precioPuntosEfectivo: number;
}

@Injectable({
  providedIn: 'root',
})
export class PreventaService {
  evaluarPeliculaYFuncion(pelicula: any, funcion: any): EstadoPreventa {
    const precioNormalPesos = Number(funcion?.precio_pesos ?? pelicula?.precio_pesos ?? 0);
    const precioNormalPuntos = Number(funcion?.precio_puntos ?? pelicula?.precio_puntos ?? 0);

    const estrenoRaw = pelicula?.fecha_estreno || funcion?.fecha_estreno;
    const preventaActiva = Boolean(pelicula?.preventa_activa ?? true);
    const diasPreventa = Number(pelicula?.dias_preventa ?? 7);

    if (!estrenoRaw || !preventaActiva) {
      return {
        enPreventa: false,
        fechaInicioPreventa: null,
        fechaEstreno: estrenoRaw ? new Date(estrenoRaw) : null,
        precioPesosEfectivo: precioNormalPesos,
        precioPuntosEfectivo: precioNormalPuntos,
      };
    }

    const ahora = new Date();
    const fechaEstreno = new Date(estrenoRaw);
    const fechaInicioPreventa = new Date(
      fechaEstreno.getTime() - diasPreventa * 24 * 60 * 60 * 1000,
    );

    const enPreventa =
      !isNaN(fechaEstreno.getTime()) &&
      ahora >= fechaInicioPreventa &&
      ahora < fechaEstreno;

    const precioPesosPreventa =
      pelicula?.precio_preventa_pesos != null
        ? Number(pelicula.precio_preventa_pesos)
        : precioNormalPesos;

    const precioPuntosPreventa =
      pelicula?.precio_preventa_puntos != null
        ? Number(pelicula.precio_preventa_puntos)
        : precioNormalPuntos;

    return {
      enPreventa,
      fechaInicioPreventa,
      fechaEstreno,
      precioPesosEfectivo: enPreventa ? precioPesosPreventa : precioNormalPesos,
      precioPuntosEfectivo: enPreventa ? precioPuntosPreventa : precioNormalPuntos,
    };
  }
}