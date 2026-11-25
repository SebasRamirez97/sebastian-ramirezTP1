import { Injectable } from '@angular/core';
import { formatearFechaLocal, obtenerHoyLocal } from '../utils/fechas.util';

export interface EstadoPreventa {
  enPreventa: boolean;
  porcentajePreventa: number;
  multiplicador: number;
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
    const precioBasePesos = Number(funcion?.precio_pesos ?? pelicula?.precio_pesos ?? 0);
    const precioBasePuntos = Number(funcion?.precio_puntos ?? pelicula?.precio_puntos ?? 0);

    const estrenoRaw = pelicula?.fecha_estreno || funcion?.fecha_estreno;
    const preventaActiva = Boolean(pelicula?.preventa_activa);
    const diasPreventa = Number(pelicula?.dias_preventa ?? 7);
    const pctRaw = Number(pelicula?.porcentaje_preventa ?? 50);
    const porcentajePreventa = Number.isFinite(pctRaw) && pctRaw >= 0 ? pctRaw : 50;

    if (!estrenoRaw) {
      return {
        enPreventa: false,
        porcentajePreventa: 0,
        multiplicador: 1,
        fechaInicioPreventa: null,
        fechaEstreno: null,
        precioPesosEfectivo: precioBasePesos,
        precioPuntosEfectivo: precioBasePuntos,
      };
    }

    const hoy = obtenerHoyLocal();
    const estrenoStr = formatearFechaLocal(estrenoRaw);
    const [anio, mes, dia] = estrenoStr.split('-').map(Number);
    const fechaEstrenoDate = new Date(anio, mes - 1, dia);
    const fechaInicioDate = new Date(anio, mes - 1, dia - diasPreventa);
    const inicioStr = formatearFechaLocal(fechaInicioDate);

    const enPreventa =
      Boolean(estrenoStr) &&
      preventaActiva &&
      hoy >= inicioStr &&
      hoy < estrenoStr;

    const multiplicador = enPreventa ? 1 + porcentajePreventa / 100 : 1;

    return {
      enPreventa,
      porcentajePreventa: enPreventa ? porcentajePreventa : 0,
      multiplicador,
      fechaInicioPreventa: fechaInicioDate,
      fechaEstreno: fechaEstrenoDate,
      precioPesosEfectivo: Math.round(precioBasePesos * multiplicador),
      precioPuntosEfectivo: Math.round(precioBasePuntos * multiplicador),
    };
  }
}